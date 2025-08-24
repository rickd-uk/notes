const { Pool } = require("pg");
const path = require("path");
// Use a more robust way to load .env file to avoid pathing issues
require("dotenv").config({ path: path.resolve(__dirname, "./.env") });

// --- Diagnostic Logging ---
// This will print the exact values being used for the connection.
console.log("--- Database Connection Settings ---");
console.log("DB_HOST:", process.env.DB_HOST);
console.log("DB_PORT:", process.env.DB_PORT);
console.log("DB_USER:", process.env.DB_USER);
console.log("DB_NAME:", process.env.DB_NAME);
console.log("DB_PASSWORD:", process.env.DB_PASSWORD ? "Loaded" : "NOT LOADED");
console.log("------------------------------------");

const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT, 10), // Ensure port is an integer
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

// Error handling for pool errors
pool.on("error", (err) => {
  console.error("Unexpected database pool eggVGrror", err);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  getClient: () => pool.connect(),
  getUserByUsername: async (username) => {
    const result = await pool.query("SELECT * FROM users WHERE username = $1", [
      username,
    ]);
    return result.rows[0];
  },
  getUserByEmail: async (email) => {
    const result = await pool.query("SELECT * FROM users WHERE email = $1", [
      email,
    ]);
    return result.rows[0];
  },
  createUser: async (username, email, passwordHash) => {
    const result = await pool.query(
      "INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id, username, email, created_at",
      [username, email, passwordHash],
    );
    return result.rows[0];
  },
  updateUserLastLogin: (userId) => {
    return pool.query(
      "UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1",
      [userId],
    );
  },
};
