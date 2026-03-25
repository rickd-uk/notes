const express = require("express");
const cors = require("cors");
const compression = require("compression");
const cookieParser = require("cookie-parser");
const morgan = require("morgan");
const history = require("connect-history-api-fallback");
const path = require("path");
require("dotenv").config();

// Import the db object which initializes the pool
const db = require("./db");

// Import route modules
const authRoutes = require("./routes/auth");
const notesRoutes = require("./routes/notes");
const categoriesRoutes = require("./routes/categories");
const adminRoutes = require("./routes/admin");

// Import middleware
const { handlePayloadTooLarge } = require("./middleware/contentSizeValidator");

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
app.use(compression());
app.use(cors());
app.use(morgan("combined"));

// Configure body parser with size limits
// Set to 2MB to be more generous than frontend, but still protect the server
app.use(
  express.json({
    limit: "2mb",
    verify: (req, res, buf, encoding) => {
      // Track the raw body size
      req.rawBody = buf;
    },
  }),
);

app.use(
  express.urlencoded({
    limit: "2mb",
    extended: true,
  }),
);

app.use(cookieParser());

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/notes", notesRoutes);
app.use("/api/categories", categoriesRoutes);
app.use("/api/admin", adminRoutes);

// Error handling middleware for payload too large
app.use(handlePayloadTooLarge);

// General error handler
app.use((err, req, res, next) => {
  console.error("Error:", err);

  // Handle specific error types
  if (err.type === "entity.too.large") {
    return res.status(413).json({
      error: "Payload too large",
      message: "The request is too large. Maximum size is 2MB.",
    });
  }

  if (err.type === "entity.parse.failed") {
    return res.status(400).json({
      error: "Invalid JSON",
      message: "The request body contains invalid JSON.",
    });
  }

  // Generic error response
  res.status(err.status || 500).json({
    error: err.message || "Internal server error",
  });
});

// Static files and history middleware for single-page application routing
// Cache static assets for 1 day; index.html stays uncached so deploys take effect immediately
app.use(express.static(path.join(__dirname, "../frontend"), {
  maxAge: "1d",
  setHeaders(res, filePath) {
    if (filePath.endsWith("index.html")) {
      res.setHeader("Cache-Control", "no-cache");
    }
  },
}));
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
        console.log(`📊 Request size limit: 2MB`);
        console.log(`📝 Note content limit: 500KB characters / 1MB bytes`);
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
