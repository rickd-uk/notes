const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const db = require("../db");
const router = express.Router();
require("dotenv").config();

const JWT_SECRET = process.env.JWT_SECRET;
// For backward compatibility (allows admin login defined in .env to still work)
const ADMIN_USERNAME = process.env.AUTH_USERNAME;
const ADMIN_PASSWORD_HASH = process.env.AUTH_PASSWORD_HASH;

// Register a new user
router.post("/register", async (req, res) => {
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

    // Check if email already exists
    const existingUserByEmail = await db.getUserByEmail(email);
    if (existingUserByEmail) {
      return res.status(400).json({ error: "Email already registered" });
    }

    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

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
    const passwordMatch = await bcrypt.compare(password, user.password_hash);

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
