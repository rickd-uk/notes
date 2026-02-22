const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const db = require("../db");
const { authenticate } = require("../middleware/auth");
const router = express.Router();
require("dotenv").config();

const JWT_SECRET = process.env.JWT_SECRET;
// For backward compatibility (allows admin login defined in .env to still work)
const ADMIN_USERNAME = process.env.AUTH_USERNAME;
const ADMIN_PASSWORD_HASH = process.env.AUTH_PASSWORD_HASH;

const SIGNUPS_ENABLED = process.env.SIGNUPS_ENABLED !== "false";

// Register a new user
router.post("/register", async (req, res) => {
  if (!SIGNUPS_ENABLED) {
    return res
      .status(403)
      .json({ error: "Signups are currently not allowed." });
  }
  try {
    const { username, email, password } = req.body;

    // Debug logging
    console.log("Registration attempt:", {
      username,
      email,
      password: password ? "***" : undefined,
    });

    // Validate inputs
    if (!username || !password) {
      return res.status(400).json({ error: "All fields are required" });
    }

    if (username.length < 3 || username.length > 20) {
      return res
        .status(400)
        .json({ error: "Username must be between 3 and 20 characters" });
    }

    if (password.length < 8) {
      return res
        .status(400)
        .json({ error: "Password must be at least 8 characters long" });
    }

    // Check if username already exists
    const existingUserByUsername = await db.getUserByUsername(username);
    if (existingUserByUsername) {
      return res.status(400).json({ error: "Username already taken" });
    }

    // Check if email already exists, but only if an email is provided
    if (email) {
      const existingUserByEmail = await db.getUserByEmail(email);
      if (existingUserByEmail) {
        return res.status(400).json({ error: "Email already registered" });
      }
    }

    // --- Start of Security Update ---
    // Load security config from environment variables
    const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS, 10) || 12;
    const pepper = process.env.BCRYPT_PEPPER;

    if (!pepper) {
      console.error(
        "CRITICAL: BCRYPT_PEPPER is not set. Halting registration.",
      );
      return res
        .status(500)
        .json({ error: "Server security misconfiguration" });
    }

    // Add the pepper to the password before hashing
    const passwordWithPepper = password + pepper;
    // --- End of Security Update ---

    // Hash the peppered password
    const passwordHash = await bcrypt.hash(passwordWithPepper, saltRounds);

    // Create user
    const newUser = await db.createUser(username, email, passwordHash);

    // Generate token
    const token = jwt.sign(
      { userId: newUser.id, username: newUser.username },
      JWT_SECRET,
      { expiresIn: "180d" },
    );

    // Set HTTP-only cookie with token
    res.cookie("auth_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 180 * 24 * 60 * 60 * 1000, // 180 days
    });

    // Return user info (without password)
    return res.status(201).json({
      success: true,
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        created_at: newUser.created_at,
      },
    });
  } catch (error) {
    console.error("Registration error:", error);
    if (error.stack) console.error(error.stack);
    return res.status(500).json({ error: "Server error during registration" });
  }
});

// Login route
router.post("/login", async (req, res) => {
  const { username, password } = req.body;
  console.log("Login attempt:", { username, password: "***" });

  if (!username || !password) {
    return res
      .status(400)
      .json({ error: "Username and password are required" });
  }

  // --- Start of Security Update ---
  const pepper = process.env.BCRYPT_PEPPER;
  if (!pepper) {
    console.error("CRITICAL: BCRYPT_PEPPER is not set. Halting login.");
    return res.status(500).json({ error: "Server security misconfiguration" });
  }
  const passwordWithPepper = password + pepper;
  // --- End of Security Update ---

  try {
    // First try to match against .env admin credentials for backward compatibility
    if (ADMIN_USERNAME && ADMIN_PASSWORD_HASH && username === ADMIN_USERNAME) {
      const passwordMatch = await bcrypt.compare(password, ADMIN_PASSWORD_HASH);

      if (passwordMatch) {
        // Create token for admin user
        const token = jwt.sign(
          {
            userId: "admin",
            username: ADMIN_USERNAME,
            isAdmin: true,
          },
          JWT_SECRET,
          { expiresIn: "180d" },
        );

        // Set HTTP-only cookie with token
        res.cookie("auth_token", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          maxAge: 180 * 24 * 60 * 60 * 1000, // 180 days
        });

        console.log("Admin login successful");
        return res.json({
          success: true,
          user: {
            username: ADMIN_USERNAME,
            isAdmin: true,
          },
        });
      }
    }

    // Look up user in database
    const user = await db.getUserByUsername(username);

    if (!user) {
      console.log("Login failed - user not found");
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Verify password
    const passwordMatch = await bcrypt.compare(
      passwordWithPepper,
      user.password_hash,
    );

    if (!passwordMatch) {
      console.log("Login failed - password mismatch");
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Update last login timestamp
    await db.updateUserLastLogin(user.id);

    // Create token
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: "180d" },
    );

    // Set HTTP-only cookie with token
    res.cookie("auth_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 180 * 24 * 60 * 60 * 1000, // 180 days
    });

    console.log("User login successful");
    return res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ error: "Server error during login" });
  }
});

// Change password route (requires authentication)
router.post("/change-password", authenticate, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const userId = req.user.userId;

  // Validate inputs
  if (!currentPassword || !newPassword) {
    return res
      .status(400)
      .json({ error: "Current password and new password are required" });
  }

  if (newPassword.length < 8) {
    return res
      .status(400)
      .json({ error: "New password must be at least 8 characters long" });
  }

  const pepper = process.env.BCRYPT_PEPPER;
  if (!pepper) {
    console.error(
      "CRITICAL: BCRYPT_PEPPER is not set. Halting password change.",
    );
    return res.status(500).json({ error: "Server security misconfiguration" });
  }

  try {
    // Handle admin user from .env (cannot change password this way)
    if (userId === "admin") {
      return res.status(403).json({
        error:
          "Admin password is configured in .env file and cannot be changed here",
      });
    }

    // Get user from database
    const result = await db.query("SELECT * FROM users WHERE id = $1", [
      userId,
    ]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const user = result.rows[0];

    // Verify current password
    const currentPasswordWithPepper = currentPassword + pepper;
    const passwordMatch = await bcrypt.compare(
      currentPasswordWithPepper,
      user.password_hash,
    );

    if (!passwordMatch) {
      return res.status(401).json({ error: "Current password is incorrect" });
    }

    // Hash the new password
    const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS, 10) || 12;
    const newPasswordWithPepper = newPassword + pepper;
    const newPasswordHash = await bcrypt.hash(
      newPasswordWithPepper,
      saltRounds,
    );

    // Update password in database
    await db.query("UPDATE users SET password_hash = $1 WHERE id = $2", [
      newPasswordHash,
      userId,
    ]);

    console.log(`Password changed for user: ${user.username}`);
    return res.json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    console.error("Password change error:", error);
    return res
      .status(500)
      .json({ error: "Server error during password change" });
  }
});

// Logout route
router.post("/logout", (req, res) => {
  res.clearCookie("auth_token");
  res.json({ success: true });
});

// Get current user information
router.get("/me", async (req, res) => {
  const token = req.cookies.auth_token;

  if (!token) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    // Check if admin user from .env
    if (decoded.isAdmin) {
      return res.json({
        success: true,
        user: {
          username: decoded.username,
          isAdmin: true,
        },
      });
    }

    // For regular users, get fresh data from database
    const user = await db.query(
      "SELECT id, username, email, created_at, last_login FROM users WHERE id = $1",
      [decoded.userId],
    );

    if (user.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.json({
      success: true,
      user: user.rows[0],
    });
  } catch (error) {
    console.error("Auth check error:", error);
    return res.status(401).json({ error: "Invalid token" });
  }
});

module.exports = router;
