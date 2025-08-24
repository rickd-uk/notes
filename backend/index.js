const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const history = require("connect-history-api-fallback");
const path = require("path");
require("dotenv").config();

// Import the db object which initializes the pool
const db = require("./db");

// Import route modules
const authRoutes = require("./routes/auth");
const notesRoutes = require("./routes/notes");
const categoriesRoutes = require("./routes/categories");

// Error handling for uncaught exceptions
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});

const app = express();
const port = process.env.PORT || 3012;

// Middleware
app.use(cors());
app.use(express.json());
app.use(cookieParser());

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/notes", notesRoutes);
app.use("/api/categories", categoriesRoutes);

// Static files and history middleware for single-page application routing
app.use(express.static(path.join(__dirname, "../frontend")));
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/index.html"));
});

// --- Improved Server Startup ---
async function startServer() {
  try {
    // Test the database connection
    await db.query("SELECT NOW()");
    console.log("✅ Database connected successfully");

    // Start the Express server
    app
      .listen(port, () => {
        console.log(`🚀 Server running on http://localhost:${port}`);
      })
      .on("error", (err) => {
        if (err.code === "EADDRINUSE") {
          console.error(
            `❌ Port ${port} is already in use. Try a different port.`,
          );
          process.exit(1);
        } else {
          console.error("Server error:", err);
        }
      });
  } catch (err) {
    console.error("❌ Could not connect to the database.", err);
    process.exit(1);
  }
}

startServer();
