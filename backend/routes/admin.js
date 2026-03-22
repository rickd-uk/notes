const express = require('express');
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');
const db = require('../db');
const { authenticate, isAdmin } = require('../middleware/auth');
const router = express.Router();

// All admin routes require authentication + admin check
router.use(authenticate, isAdmin);

// GET /api/admin/stats — dashboard summary
router.get('/stats', async (req, res) => {
  try {
    const [usersResult, notesResult, settingResult] = await Promise.all([
      db.query('SELECT COUNT(*) FROM users'),
      db.query('SELECT COUNT(*) FROM notes'),
      db.query("SELECT value FROM app_settings WHERE key = 'signups_enabled'"),
    ]);
    res.json({
      success: true,
      totalUsers: parseInt(usersResult.rows[0].count),
      totalNotes: parseInt(notesResult.rows[0].count),
      signupsEnabled: settingResult.rows.length === 0 || settingResult.rows[0].value === 'true',
    });
  } catch (err) {
    console.error('Admin stats error:', err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// GET /api/admin/settings
router.get('/settings', async (req, res) => {
  try {
    const result = await db.query('SELECT key, value FROM app_settings');
    const settings = {};
    result.rows.forEach(r => { settings[r.key] = r.value; });
    res.json({ success: true, settings });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// POST /api/admin/settings — body: { key, value }
router.post('/settings', async (req, res) => {
  const { key, value } = req.body;
  if (!key || value === undefined) {
    return res.status(400).json({ error: 'key and value are required' });
  }
  try {
    await db.query(
      'INSERT INTO app_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2',
      [key, String(value)]
    );
    console.log(`Admin action: updated setting ${key}=${value}`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update setting' });
  }
});

// GET /api/admin/server-info
router.get('/server-info', async (req, res) => {
  try {
    const dbResult = await db.query('SELECT NOW()');
    res.json({
      success: true,
      nodeVersion: process.version,
      uptimeSeconds: Math.floor(process.uptime()),
      dbStatus: 'connected',
      dbTime: dbResult.rows[0].now,
      platform: process.platform,
      memoryMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
    });
  } catch (err) {
    res.json({
      success: true,
      nodeVersion: process.version,
      uptimeSeconds: Math.floor(process.uptime()),
      dbStatus: 'error',
    });
  }
});

// GET /api/admin/logs — last 200 lines of backend-server.log
router.get('/logs', (req, res) => {
  const logPath = path.join(__dirname, '../../backend-server.log');
  try {
    if (!fs.existsSync(logPath)) {
      return res.json({ success: true, lines: [], message: 'Log file not found' });
    }
    const content = fs.readFileSync(logPath, 'utf8');
    const lines = content.split('\n').filter(Boolean);
    const last200 = lines.slice(-200);
    res.json({ success: true, lines: last200 });
  } catch (err) {
    res.status(500).json({ error: 'Failed to read log file' });
  }
});

// POST /api/admin/backup — run pg_dump
router.post('/backup', (req, res) => {
  const backupsDir = path.join(__dirname, '../../backups');
  fs.mkdirSync(backupsDir, { recursive: true });

  const now = new Date();
  const ts = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `backup-${ts}.sql`;
  const outPath = path.join(backupsDir, filename);

  const env = {
    ...process.env,
    PGPASSWORD: process.env.DB_PASSWORD || process.env.POSTGRES_PASSWORD || 'mysecretpassword',
  };

  const args = [
    '-h', process.env.DB_HOST || 'localhost',
    '-p', process.env.DB_PORT || '5435',
    '-U', process.env.DB_USER || 'notesapp_user',
    '-d', process.env.DB_NAME || 'notesapp',
    '-f', outPath,
  ];

  execFile('pg_dump', args, { env }, (err) => {
    if (err) {
      console.error('pg_dump error:', err.message);
      return res.status(500).json({ error: 'Backup failed: ' + err.message });
    }
    console.log(`Admin action: DB backup created — ${filename}`);
    res.json({ success: true, filename, path: `backups/${filename}` });
  });
});

// GET /api/admin/users — all users with note counts
router.get('/users', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        u.id, u.username, u.email, u.created_at, u.last_login,
        u.suspended, u.invalidated_at,
        COUNT(n.id)::int AS note_count
      FROM users u
      LEFT JOIN notes n ON n.user_id = u.id
      GROUP BY u.id
      ORDER BY u.created_at ASC
    `);
    res.json({ success: true, users: result.rows });
  } catch (err) {
    console.error('Admin users error:', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// PATCH /api/admin/users/:id/suspend — toggle suspended
router.patch('/users/:id/suspend', async (req, res) => {
  const { id } = req.params;
  if (String(id) === String(req.user.userId)) {
    return res.status(400).json({ error: 'Cannot suspend yourself' });
  }
  try {
    const result = await db.query(
      'UPDATE users SET suspended = NOT suspended WHERE id = $1 RETURNING id, username, suspended',
      [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const u = result.rows[0];
    console.log(`Admin action: ${u.suspended ? 'suspended' : 'restored'} user ${u.username} (${id})`);
    res.json({ success: true, user: u });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// DELETE /api/admin/users/:id — delete user (cascade handles notes/categories)
router.delete('/users/:id', async (req, res) => {
  const { id } = req.params;
  if (String(id) === String(req.user.userId)) {
    return res.status(400).json({ error: 'Cannot delete yourself' });
  }
  try {
    const result = await db.query(
      'DELETE FROM users WHERE id = $1 RETURNING username',
      [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    console.log(`Admin action: deleted user ${result.rows[0].username} (${id})`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// PATCH /api/admin/users/:id/rename — change username
router.patch('/users/:id/rename', async (req, res) => {
  const { id } = req.params;
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: 'username is required' });
  try {
    const result = await db.query(
      'UPDATE users SET username = $1 WHERE id = $2 RETURNING id, username',
      [username, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    console.log(`Admin action: renamed user ${id} to ${username}`);
    res.json({ success: true, user: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Username already taken' });
    }
    res.status(500).json({ error: 'Failed to rename user' });
  }
});

// POST /api/admin/users/:id/reset-password — set new password
router.post('/users/:id/reset-password', async (req, res) => {
  const { id } = req.params;
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }
  const pepper = process.env.BCRYPT_PEPPER;
  if (!pepper) return res.status(500).json({ error: 'Server security misconfiguration' });

  try {
    const bcrypt = require('bcrypt');
    const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS, 10) || 12;
    const hash = await bcrypt.hash(newPassword + pepper, saltRounds);
    const result = await db.query(
      'UPDATE users SET password_hash = $1 WHERE id = $2 RETURNING username',
      [hash, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    console.log(`Admin action: reset password for user ${result.rows[0].username} (${id})`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// POST /api/admin/users/:id/logout — invalidate session
router.post('/users/:id/logout', async (req, res) => {
  const { id } = req.params;
  if (String(id) === String(req.user.userId)) {
    return res.status(400).json({ error: 'Cannot force-logout yourself' });
  }
  try {
    const result = await db.query(
      'UPDATE users SET invalidated_at = NOW() WHERE id = $1 RETURNING username',
      [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    console.log(`Admin action: force-logged-out user ${result.rows[0].username} (${id})`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to revoke session' });
  }
});

// GET /api/admin/notes?page=1&limit=50
router.get('/notes', async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
  const offset = (page - 1) * limit;
  try {
    const [notesResult, countResult] = await Promise.all([
      db.query(`
        SELECT n.id, n.created_at, n.updated_at,
               LEFT(n.content, 100) AS preview,
               u.username
        FROM notes n
        JOIN users u ON u.id = n.user_id
        ORDER BY n.created_at DESC
        LIMIT $1 OFFSET $2
      `, [limit, offset]),
      db.query('SELECT COUNT(*) FROM notes'),
    ]);
    res.json({
      success: true,
      notes: notesResult.rows,
      total: parseInt(countResult.rows[0].count),
      page,
      limit,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch notes' });
  }
});

// DELETE /api/admin/notes/:id
router.delete('/notes/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query(
      'DELETE FROM notes WHERE id = $1 RETURNING id, user_id',
      [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Note not found' });
    console.log(`Admin action: deleted note ${id} (owner user_id=${result.rows[0].user_id})`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete note' });
  }
});

module.exports = router;
