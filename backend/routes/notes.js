const express = require("express");
const db = require("../db");
const { authenticate } = require("../middleware/auth");
const {
  validateNoteContentSize,
} = require("../middleware/contentSizeValidator");
const router = express.Router();

// Apply authentication to all note routes
router.use(authenticate);

// Get all notes for the current user
router.get("/", async (req, res) => {
  try {
    const userId = req.user.userId;

    // Handle admin user from .env
    if (userId === "admin") {
      const result = await db.query(
        "SELECT * FROM notes ORDER BY updated_at DESC",
      );
      return res.json(result.rows);
    }

    // For regular users
    const result = await db.query(
      "SELECT * FROM notes WHERE user_id = $1 ORDER BY updated_at DESC",
      [userId],
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Get notes by category for the current user
router.get("/category/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    let query;
    let params;

    // Handle admin user from .env file (backward compatibility)
    if (userId === "admin") {
      if (id === "uncategorized") {
        query =
          "SELECT * FROM notes WHERE category_id IS NULL ORDER BY updated_at DESC";
        params = [];
      } else if (id === "all") {
        query = "SELECT * FROM notes ORDER BY updated_at DESC";
        params = [];
      } else {
        query =
          "SELECT * FROM notes WHERE category_id = $1 ORDER BY updated_at DESC";
        params = [id];
      }
    } else {
      if (id === "uncategorized") {
        query =
          "SELECT * FROM notes WHERE category_id IS NULL AND user_id = $1 ORDER BY updated_at DESC";
        params = [userId];
      } else if (id === "all") {
        query =
          "SELECT * FROM notes WHERE user_id = $1 ORDER BY updated_at DESC";
        params = [userId];
      } else {
        query =
          "SELECT * FROM notes WHERE category_id = $1 AND user_id = $2 ORDER BY updated_at DESC";
        params = [id, userId];
      }
    }

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Bulk delete notes by category for the current user
router.delete("/category/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    let query;
    let params;
    let message;

    // Handle admin user from .env file (backward compatibility)
    if (userId === "admin") {
      if (id === "uncategorized") {
        query = "DELETE FROM notes WHERE category_id IS NULL";
        params = [];
      } else if (id === "all") {
        query = "DELETE FROM notes";
        params = [];
      } else {
        query = "DELETE FROM notes WHERE category_id = $1";
        params = [id];
      }
    } else {
      if (id === "uncategorized") {
        query = "DELETE FROM notes WHERE category_id IS NULL AND user_id = $1";
        params = [userId];
      } else if (id === "all") {
        query = "DELETE FROM notes WHERE user_id = $1";
        params = [userId];
      } else {
        query = "DELETE FROM notes WHERE category_id = $1 AND user_id = $2";
        params = [id, userId];
      }
    }

    const result = await db.query(query, params);
    message = "Notes deleted successfully";

    console.log(`Bulk deleted ${result.rowCount} notes from category: ${id}`);
    res.json({ message, count: result.rowCount });
  } catch (err) {
    console.error("Error in bulk delete:", err);
    res
      .status(500)
      .json({ error: "Server error during bulk delete operation" });
  }
});

// Delete all empty notes for the current user
router.delete("/empty", async (req, res) => {
  try {
    const userId = req.user.userId;
    let result;
    if (userId === "admin") {
      result = await db.query(
        "DELETE FROM notes WHERE content IS NULL OR TRIM(content) = '' OR content = '<p><br></p>' RETURNING id"
      );
    } else {
      result = await db.query(
        "DELETE FROM notes WHERE user_id = $1 AND (content IS NULL OR TRIM(content) = '' OR content = '<p><br></p>') RETURNING id",
        [userId]
      );
    }
    res.json({ message: "Empty notes deleted", count: result.rowCount });
  } catch (err) {
    console.error("Error deleting empty notes:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Create a new note for the current user
// Apply content size validation middleware
router.post("/", validateNoteContentSize, async (req, res) => {
  try {
    const { content, category_id } = req.body;
    const userId = req.user.userId;

    // Handle admin user from .env file (backward compatibility)
    if (userId === "admin") {
      const result = await db.query(
        "INSERT INTO notes (content, category_id) VALUES ($1, $2) RETURNING *",
        [content, category_id],
      );
      return res.status(201).json(result.rows[0]);
    }

    const result = await db.query(
      "INSERT INTO notes (content, category_id, user_id) VALUES ($1, $2, $3) RETURNING *",
      [content, category_id, userId],
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);

    // Handle specific database errors
    if (err.code === "22001") {
      // String data right truncation - content too long for database field
      return res.status(413).json({
        error: "Content too large",
        message: "Content exceeds database field size limit",
      });
    }

    res.status(500).json({ error: "Server error" });
  }
});

// Update a note for the current user
// Apply content size validation middleware
router.put("/:id", validateNoteContentSize, async (req, res) => {
  try {
    const { id } = req.params;
    const { content, category_id } = req.body;
    const userId = req.user.userId;

    // Block writes to read-only notes
    const check = await db.query("SELECT read_only FROM notes WHERE id = $1", [id]);
    if (check.rows.length > 0 && check.rows[0].read_only) {
      return res.status(403).json({ error: "Note is read-only" });
    }

    // Handle admin user from .env file (backward compatibility)
    if (userId === "admin") {
      const result = await db.query(
        "UPDATE notes SET content = $1, category_id = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *",
        [content, category_id, id],
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Note not found" });
      }

      return res.json(result.rows[0]);
    }

    // For regular users, ensure they can only update their own notes
    const result = await db.query(
      "UPDATE notes SET content = $1, category_id = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 AND user_id = $4 RETURNING *",
      [content, category_id, id, userId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Note not found or unauthorized" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);

    // Handle specific database errors
    if (err.code === "22001") {
      // String data right truncation - content too long for database field
      return res.status(413).json({
        error: "Content too large",
        message: "Content exceeds database field size limit",
      });
    }

    res.status(500).json({ error: "Server error" });
  }
});

// Toggle read-only on a note (must be before /:id to avoid wildcard match)
router.patch("/:id/readonly", async (req, res) => {
  try {
    const { id } = req.params;
    const { read_only } = req.body;
    const userId = req.user.userId;

    let result;
    if (userId === "admin") {
      result = await db.query(
        "UPDATE notes SET read_only = $1 WHERE id = $2 RETURNING *",
        [read_only, id]
      );
    } else {
      result = await db.query(
        "UPDATE notes SET read_only = $1 WHERE id = $2 AND user_id = $3 RETURNING *",
        [read_only, id, userId]
      );
    }

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Note not found or unauthorized" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Delete a note for the current user
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    // Block deletion of read-only notes
    const check = await db.query("SELECT read_only FROM notes WHERE id = $1", [id]);
    if (check.rows.length > 0 && check.rows[0].read_only) {
      return res.status(403).json({ error: "Note is read-only" });
    }

    // Handle admin user from .env file (backward compatibility)
    if (userId === "admin") {
      await db.query("DELETE FROM notes WHERE id = $1", [id]);
      return res.json({ message: "Note deleted" });
    }

    // For regular users, ensure they can only delete their own notes
    const result = await db.query(
      "DELETE FROM notes WHERE id = $1 AND user_id = $2",
      [id, userId],
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Note not found or unauthorized" });
    }

    res.json({ message: "Note deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
