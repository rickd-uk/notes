const express = require('express');
const db = require('../db');
const { authenticate } = require('../middleware/auth');
const router = express.Router();

// Apply authentication to all category routes
router.use(authenticate);

// Get all categories for the current user
router.get('/', async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // Handle admin user from .env file (backward compatibility)
    if (userId === 'admin') {
      const result = await db.query('SELECT * FROM categories');
      return res.json(result.rows);
    }
    
    const result = await db.query(
      'SELECT * FROM categories WHERE user_id = $1',
      [userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error getting categories:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create a new category for the current user
router.post('/', async (req, res) => {
  try {
    const { name, icon } = req.body;
    const userId = req.user.userId;
    
    // Handle admin user from .env file (backward compatibility)
    if (userId === 'admin') {
      const result = await db.query(
        'INSERT INTO categories (name, icon) VALUES ($1, $2) RETURNING *',
        [name, icon]
      );
      return res.status(201).json(result.rows[0]);
    }
    
    const result = await db.query(
      'INSERT INTO categories (name, icon, user_id) VALUES ($1, $2, $3) RETURNING *',
      [name, icon, userId]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating category:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update a category for the current user
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, icon } = req.body;
    const userId = req.user.userId;
    
    // Handle admin user from .env file (backward compatibility)
    if (userId === 'admin') {
      const result = await db.query(
        'UPDATE categories SET name = $1, icon = $2 WHERE id = $3 RETURNING *',
        [name, icon, id]
      );
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Category not found' });
      }
      
      return res.json(result.rows[0]);
    }
    
    // For regular users, ensure they can only update their own categories
    const result = await db.query(
      'UPDATE categories SET name = $1, icon = $2 WHERE id = $3 AND user_id = $4 RETURNING *',
      [name, icon, id, userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Category not found or unauthorized' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating category:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete categories with no notes for the current user
router.delete('/empty', async (req, res) => {
  const client = await db.getClient();
  try {
    const userId = req.user.userId;
    const numericUserId = userId === 'admin' ? null : parseInt(userId, 10);

    await client.query('BEGIN');

    let deleteResult;
    if (userId === 'admin') {
      deleteResult = await client.query(
        `DELETE FROM categories
         WHERE id NOT IN (
           SELECT DISTINCT category_id FROM notes WHERE category_id IS NOT NULL
         )
         RETURNING id`
      );
    } else {
      deleteResult = await client.query(
        `DELETE FROM categories
         WHERE user_id = $1
           AND id NOT IN (
             SELECT DISTINCT category_id FROM notes
             WHERE user_id = $1 AND category_id IS NOT NULL
           )
         RETURNING id`,
        [numericUserId]
      );
    }

    await client.query('COMMIT');
    res.json({ message: 'Empty categories deleted', count: deleteResult.rowCount });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error deleting empty categories:', err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

// Delete all categories for the current user and update related notes
router.delete('/all', async (req, res) => {
  // Use a client from the pool for transaction
  const client = await db.getClient();
  
  try {
    const userId = req.user.userId;
    
    console.log(`Delete all categories request for user ID: ${userId}, Type: ${typeof userId}`);
    
    // Start transaction
    await client.query('BEGIN');
    
    // Handle admin user case
    if (userId === 'admin') {
      console.log('Admin user: updating all notes');
      
      // Update all notes to have NULL category
      await client.query('UPDATE notes SET category_id = NULL');
      
      // Delete all categories
      const deleteResult = await client.query('DELETE FROM categories RETURNING id');
      const count = deleteResult.rowCount;
      
      // Commit the transaction
      await client.query('COMMIT');
      
      console.log(`Admin deleted ${count} categories`);
      return res.json({
        message: 'All categories deleted successfully',
        count: count
      });
    } 
    else {
      // Handle regular user case
      console.log(`Updating notes for user ID: ${userId}`);
      
      // Cast the userId to integer as it might be coming as string
      const numericUserId = parseInt(userId, 10);
      
      if (isNaN(numericUserId)) {
        console.error('User ID is not a valid number:', userId);
        throw new Error('Invalid user ID format');
      }
      
      // Update user's notes to have NULL category
      const updateResult = await client.query(
        'UPDATE notes SET category_id = NULL WHERE user_id = $1',
        [numericUserId]
      );
      
      console.log(`Updated ${updateResult.rowCount} notes for user ${numericUserId}`);
      
      // Delete user's categories
      const deleteResult = await client.query(
        'DELETE FROM categories WHERE user_id = $1 RETURNING id',
        [numericUserId]
      );
      
      const count = deleteResult.rowCount;
      
      // Commit the transaction
      await client.query('COMMIT');
      
      console.log(`User ${numericUserId} deleted ${count} categories`);
      return res.json({
        message: 'All categories deleted successfully',
        count: count
      });
    }
  } catch (err) {
    // Rollback the transaction in case of error
    await client.query('ROLLBACK');
    
    console.error('Error in delete all categories:', err);
    console.error('Error stack:', err.stack);
    
    return res.status(500).json({ 
      error: 'Server error while deleting categories',
      message: err.message
    });
  } finally {
    // Release the client back to the pool
    client.release();
  }
});

// Delete a category for the current user and update related notes
router.delete('/:id', async (req, res) => {
  // Use a client for transaction
  const client = await db.getClient();
  
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    const deleteNotes = req.query.deleteNotes === 'true';

    // Start transaction
    await client.query('BEGIN');

    // Handle admin user from .env file (backward compatibility)
    if (userId === 'admin') {
      if (deleteNotes) {
        await client.query('DELETE FROM notes WHERE category_id = $1', [id]);
      } else {
        await client.query('UPDATE notes SET category_id = NULL WHERE category_id = $1', [id]);
      }

      // Delete the category
      await client.query('DELETE FROM categories WHERE id = $1', [id]);

      // Commit transaction
      await client.query('COMMIT');

      return res.json({ message: 'Category deleted' });
    }

    // For regular users, verify ownership and handle related notes
    const numericUserId = parseInt(userId, 10);

    // Check if category exists and belongs to user
    const categoryCheck = await client.query(
      'SELECT id FROM categories WHERE id = $1 AND user_id = $2',
      [id, numericUserId]
    );

    if (categoryCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Category not found or unauthorized' });
    }

    if (deleteNotes) {
      await client.query(
        'DELETE FROM notes WHERE category_id = $1 AND user_id = $2',
        [id, numericUserId]
      );
    } else {
      await client.query(
        'UPDATE notes SET category_id = NULL WHERE category_id = $1 AND user_id = $2',
        [id, numericUserId]
      );
    }

    // Delete the category
    await client.query(
      'DELETE FROM categories WHERE id = $1 AND user_id = $2',
      [id, numericUserId]
    );
    
    // Commit transaction
    await client.query('COMMIT');
    
    res.json({ message: 'Category deleted' });
  } catch (err) {
    // Rollback transaction
    await client.query('ROLLBACK');
    
    console.error('Error deleting category:', err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    // Release client
    client.release();
  }
});

module.exports = router;
