# Admin Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a dedicated `/admin.html` panel for the user `rick` with signup toggling, full user management, server monitoring, log viewing, DB backup, and note moderation.

**Architecture:** A separate `admin.html` page (not embedded in the SPA) protected client- and server-side. All admin API calls go to `/api/admin/*` routes that require `authenticate` + `isAdmin` middleware. Admin identity is hardcoded as `username === 'rick'`. Two new DB columns (`suspended`, `invalidated_at`) and one new table (`app_settings`) are added via a migration file.

**Tech Stack:** Node.js, Express, PostgreSQL (`pg`), bcrypt, JWT (HTTP-only cookies), vanilla JS (ES modules on frontend)

**Spec:** `docs/superpowers/specs/2026-03-22-admin-panel-design.md`

---

## File Map

| File | Status | Responsibility |
|------|--------|---------------|
| `init-db/02-admin-migration.sql` | **New** | `app_settings` table + `suspended`/`invalidated_at` columns |
| `backend/middleware/auth.js` | **Modify** | Add `isAdmin` middleware; update `authenticate` to check `suspended`/`invalidated_at` for DB users |
| `backend/routes/auth.js` | **Modify** | Signup check from DB; suspended check on login; `isAdmin` in `/me` response |
| `backend/routes/admin.js` | **New** | All 14 admin API routes |
| `backend/index.js` | **Modify** | Mount admin routes before static file handler |
| `frontend/admin.html` | **New** | Admin page shell: navbar + sidebar + content area |
| `frontend/js/admin.js` | **New** | All admin UI logic and fetch calls (no framework, vanilla JS) |
| `frontend/js/main.js` | **Modify** | Show "Admin" navbar link when `user.isAdmin === true` |

---

## Task 1: DB Migration

**Files:**
- Create: `init-db/02-admin-migration.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- 02-admin-migration.sql
-- Run once on live DB: psql -U notesapp_user -d notesapp -f init-db/02-admin-migration.sql
-- Docker fresh installs pick this up automatically.

-- Suspend users without deleting them
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended BOOLEAN NOT NULL DEFAULT FALSE;

-- Force-logout: tokens issued before this timestamp are rejected
ALTER TABLE users ADD COLUMN IF NOT EXISTS invalidated_at TIMESTAMPTZ;

-- Runtime-toggleable settings (replaces SIGNUPS_ENABLED env var)
CREATE TABLE IF NOT EXISTS app_settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT INTO app_settings (key, value)
VALUES ('signups_enabled', 'true')
ON CONFLICT (key) DO NOTHING;

GRANT ALL PRIVILEGES ON TABLE app_settings TO notesapp_user;
```

- [ ] **Step 2: Apply it to the running database**

```bash
docker exec -i notes-postgres psql -U notesapp_user -d notesapp < init-db/02-admin-migration.sql
```

Expected output:
```
ALTER TABLE
ALTER TABLE
CREATE TABLE
INSERT 0 1
GRANT
```

- [ ] **Step 3: Verify columns and table exist**

```bash
docker exec -i notes-postgres psql -U notesapp_user -d notesapp -c "\d users"
docker exec -i notes-postgres psql -U notesapp_user -d notesapp -c "SELECT * FROM app_settings;"
```

Expected: `users` table shows `suspended` and `invalidated_at` columns; `app_settings` has one row `signups_enabled | true`.

- [ ] **Step 4: Commit**

```bash
git add init-db/02-admin-migration.sql
git commit -m "feat: add admin migration — app_settings table and suspended/invalidated_at user columns"
```

---

## Task 2: Update Auth Middleware

**Files:**
- Modify: `backend/middleware/auth.js`

Current state: `authenticate` only verifies the JWT signature. It does not check the DB at all.

- [ ] **Step 1: Rewrite `backend/middleware/auth.js`**

```js
const jwt = require('jsonwebtoken');
const db = require('../db');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error('ERROR: JWT_SECRET environment variable is missing.');
  process.exit(1);
}

// Verifies JWT and, for DB users, checks suspended/invalidated_at.
// Skips DB lookup for .env legacy admin tokens (decoded.isAdmin === true).
const authenticate = async (req, res, next) => {
  const token = req.cookies.auth_token;

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;

    // Legacy .env admin: skip DB checks
    if (decoded.isAdmin === true) {
      return next();
    }

    // DB user: check suspended and invalidated_at
    const result = await db.query(
      'SELECT suspended, invalidated_at FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }

    const user = result.rows[0];

    if (user.suspended) {
      return res.status(403).json({ error: 'Account suspended' });
    }

    if (user.invalidated_at) {
      const tokenIssuedAt = new Date(decoded.iat * 1000);
      if (tokenIssuedAt < new Date(user.invalidated_at)) {
        return res.status(401).json({ error: 'Session revoked' });
      }
    }

    next();
  } catch (error) {
    console.error('Token verification failed:', error.message);
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Requires the authenticated user to be rick.
const isAdmin = (req, res, next) => {
  if (!req.user || req.user.username !== 'rick') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

module.exports = { authenticate, isAdmin };
```

- [ ] **Step 2: Verify the server still starts**

```bash
cd backend && node index.js
```

Expected: `✅ Database connected successfully` and `🚀 Server running on http://localhost:3012`

- [ ] **Step 3: Verify existing login still works**

```bash
curl -s -c /tmp/cookies.txt -X POST http://localhost:3012/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"rick","password":"YOUR_PASSWORD"}' | jq .
```

Expected: `{"success":true,"user":{...}}`

- [ ] **Step 4: Commit**

```bash
git add backend/middleware/auth.js
git commit -m "feat: update authenticate middleware — add suspended/invalidated_at checks and isAdmin middleware"
```

---

## Task 3: Update Auth Routes

**Files:**
- Modify: `backend/routes/auth.js`

Three changes: (1) signup check reads from DB instead of env var, (2) login rejects suspended users, (3) `/me` returns `isAdmin: true` for DB user rick.

- [ ] **Step 1: Replace the `SIGNUPS_ENABLED` constant (line 14)**

Old:
```js
const SIGNUPS_ENABLED = process.env.SIGNUPS_ENABLED !== "false";
```

New — delete that line entirely. The `/register` route will query `app_settings` instead.

- [ ] **Step 2: Update the `/register` route's signup check**

Find this block near the top of the register handler:
```js
if (!SIGNUPS_ENABLED) {
  return res
    .status(403)
    .json({ error: "Signups are currently not allowed." });
}
```

Replace with:
```js
const settingResult = await db.query(
  "SELECT value FROM app_settings WHERE key = 'signups_enabled'"
);
const signupsEnabled = settingResult.rows.length === 0 || settingResult.rows[0].value === 'true';
if (!signupsEnabled) {
  return res.status(403).json({ error: "Signups are currently not allowed." });
}
```

- [ ] **Step 3: Add suspended check to the DB login path**

In the `/login` route, find where the DB user is looked up and password verified. After the `passwordMatch` check succeeds, add before the token is issued:

```js
// Check if account is suspended
if (user.suspended) {
  return res.status(403).json({ error: 'Account suspended' });
}
```

The full block (find after `if (!passwordMatch)` block, before `await db.updateUserLastLogin`):
```js
if (user.suspended) {
  return res.status(403).json({ error: 'Account suspended' });
}
```

- [ ] **Step 4: Update `/me` to return `isAdmin` for DB users**

Find the DB user return in the `/me` route (around line 346):
```js
return res.json({
  success: true,
  user: user.rows[0],
});
```

Replace with:
```js
const dbUser = user.rows[0];
return res.json({
  success: true,
  user: {
    ...dbUser,
    isAdmin: dbUser.username === 'rick',
  },
});
```

- [ ] **Step 5: Restart server and verify signup toggle reads from DB**

```bash
# Should succeed (signups_enabled = true in DB)
curl -s -X POST http://localhost:3012/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser999","password":"password123"}' | jq .success
```

Expected: `true`

Then disable signups:
```bash
docker exec -i notes-postgres psql -U notesapp_user -d notesapp \
  -c "UPDATE app_settings SET value='false' WHERE key='signups_enabled';"

curl -s -X POST http://localhost:3012/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser998","password":"password123"}' | jq .error
```

Expected: `"Signups are currently not allowed."`

Re-enable:
```bash
docker exec -i notes-postgres psql -U notesapp_user -d notesapp \
  -c "UPDATE app_settings SET value='true' WHERE key='signups_enabled';"
```

- [ ] **Step 6: Verify `/me` returns `isAdmin: true` for rick**

```bash
curl -s -b /tmp/cookies.txt http://localhost:3012/api/auth/me | jq .user.isAdmin
```

Expected: `true`

- [ ] **Step 7: Commit**

```bash
git add backend/routes/auth.js
git commit -m "feat: auth routes — DB-backed signup toggle, suspended login check, isAdmin in /me response"
```

---

## Task 4: Admin Routes — System Endpoints

**Files:**
- Create: `backend/routes/admin.js` (partial — system routes only)

- [ ] **Step 1: Create `backend/routes/admin.js` with system routes**

```js
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

module.exports = router;
```

- [ ] **Step 2: Mount the admin routes in `backend/index.js`**

Add after the existing route mounts (before the static files block):
```js
const adminRoutes = require("./routes/admin");
// ...
app.use("/api/admin", adminRoutes);
```

- [ ] **Step 3: Restart server and test system routes**

Login first to get the cookie:
```bash
curl -s -c /tmp/cookies.txt -X POST http://localhost:3012/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"rick","password":"YOUR_PASSWORD"}' | jq .success
```

Test stats:
```bash
curl -s -b /tmp/cookies.txt http://localhost:3012/api/admin/stats | jq .
```
Expected: `{ success: true, totalUsers: N, totalNotes: N, signupsEnabled: true }`

Test 403 for non-admin:
```bash
# Login as non-admin user first
curl -s -c /tmp/othercookies.txt -X POST http://localhost:3012/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"someotheruser","password":"theirpassword"}' | jq .success

curl -s -b /tmp/othercookies.txt http://localhost:3012/api/admin/stats | jq .error
```
Expected: `"Admin access required"`

Test server info:
```bash
curl -s -b /tmp/cookies.txt http://localhost:3012/api/admin/server-info | jq .
```

Test toggle:
```bash
curl -s -b /tmp/cookies.txt -X POST http://localhost:3012/api/admin/settings \
  -H "Content-Type: application/json" \
  -d '{"key":"signups_enabled","value":"false"}' | jq .

# Verify it's off
curl -s -X POST http://localhost:3012/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"blocked","password":"password123"}' | jq .error

# Turn it back on
curl -s -b /tmp/cookies.txt -X POST http://localhost:3012/api/admin/settings \
  -H "Content-Type: application/json" \
  -d '{"key":"signups_enabled","value":"true"}' | jq .
```

- [ ] **Step 4: Commit**

```bash
git add backend/routes/admin.js backend/index.js
git commit -m "feat: admin routes — stats, settings toggle, server-info, logs, backup"
```

---

## Task 5: Admin Routes — User Management

**Files:**
- Modify: `backend/routes/admin.js` (add user management routes)

- [ ] **Step 1: Add user management routes to `backend/routes/admin.js`**

Add before `module.exports = router;`:

```js
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
```

- [ ] **Step 2: Restart server and test user routes**

```bash
# List users
curl -s -b /tmp/cookies.txt http://localhost:3012/api/admin/users | jq '.users[] | {id, username, note_count, suspended}'
```
Expected: array of user objects.

```bash
# Suspend a user (replace USER_ID with actual id from above)
curl -s -b /tmp/cookies.txt -X PATCH http://localhost:3012/api/admin/users/USER_ID/suspend | jq .
```
Expected: `{ success: true, user: { suspended: true, ... } }`

```bash
# Restore them
curl -s -b /tmp/cookies.txt -X PATCH http://localhost:3012/api/admin/users/USER_ID/suspend | jq .user.suspended
```
Expected: `false`

```bash
# Verify suspended user cannot login
# First suspend them, then try to login as them
curl -s -X POST http://localhost:3012/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"SUSPENDED_USER","password":"theirpassword"}' | jq .error
```
Expected: `"Account suspended"`

- [ ] **Step 3: Commit**

```bash
git add backend/routes/admin.js
git commit -m "feat: admin user management routes — list, suspend, delete, rename, reset-password, force-logout"
```

---

## Task 6: Admin Routes — Note Moderation

**Files:**
- Modify: `backend/routes/admin.js` (add note moderation routes)

- [ ] **Step 1: Add note moderation routes before `module.exports`**

```js
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
```

- [ ] **Step 2: Test note moderation routes**

```bash
curl -s -b /tmp/cookies.txt "http://localhost:3012/api/admin/notes?page=1&limit=5" | jq '{total, page, note_count: (.notes | length)}'
```
Expected: object with `total`, `page`, and `note_count`.

- [ ] **Step 3: Commit**

```bash
git add backend/routes/admin.js
git commit -m "feat: admin note moderation routes — paginated list and delete"
```

---

## Task 7: Admin HTML Page

**Files:**
- Create: `frontend/admin.html`

- [ ] **Step 1: Create `frontend/admin.html`**

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Admin Panel</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f0f1e; color: #ddd; min-height: 100vh; }

    /* Top navbar */
    .admin-nav { background: #1a1a2e; padding: 12px 20px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #2a2a4a; }
    .admin-nav h1 { font-size: 16px; font-weight: 600; color: #eee; }
    .admin-nav a { color: #7eb8f7; text-decoration: none; font-size: 13px; }
    .admin-nav a:hover { text-decoration: underline; }

    /* Layout */
    .admin-layout { display: grid; grid-template-columns: 200px 1fr; min-height: calc(100vh - 45px); }

    /* Sidebar */
    .admin-sidebar { background: #12122a; border-right: 1px solid #2a2a4a; padding: 16px 0; }
    .sidebar-section-label { padding: 8px 16px 4px; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #555; }
    .sidebar-item { padding: 9px 16px; font-size: 13px; color: #aaa; cursor: pointer; border-left: 3px solid transparent; transition: background 0.15s; }
    .sidebar-item:hover { background: #1a1a3a; color: #ddd; }
    .sidebar-item.active { background: #1e1e3f; color: #7eb8f7; border-left-color: #7eb8f7; }

    /* Main content */
    .admin-content { padding: 24px; overflow-y: auto; }
    .section { display: none; }
    .section.active { display: block; }

    /* Cards */
    .stat-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin-bottom: 24px; }
    .stat-card { background: #1a1a35; border: 1px solid #2a2a5a; border-radius: 6px; padding: 16px; text-align: center; }
    .stat-card .value { font-size: 28px; font-weight: bold; color: #7eb8f7; }
    .stat-card .label { font-size: 11px; color: #888; margin-top: 4px; }
    .stat-card.green .value { color: #a8e6cf; }
    .stat-card.red .value { color: #f78; }

    /* Tables */
    .admin-table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .admin-table th { padding: 8px 10px; text-align: left; color: #666; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #2a2a4a; }
    .admin-table td { padding: 8px 10px; border-bottom: 1px solid #1a1a2e; vertical-align: middle; }
    .admin-table tr:hover td { background: #1a1a2e; }

    /* Badges */
    .badge { display: inline-block; padding: 2px 7px; border-radius: 3px; font-size: 10px; font-weight: 600; }
    .badge.active { background: #1a2540; color: #7eb8f7; }
    .badge.suspended { background: #2a1a1a; color: #f78; }
    .badge.admin { background: #1a3520; color: #a8e6cf; }

    /* Buttons */
    .btn { padding: 4px 10px; border: none; border-radius: 3px; cursor: pointer; font-size: 11px; font-weight: 500; transition: opacity 0.15s; }
    .btn:hover { opacity: 0.8; }
    .btn:disabled { opacity: 0.4; cursor: default; }
    .btn-danger { background: #2a1a1a; color: #f78; }
    .btn-warn { background: #2a2a1a; color: #fa8; }
    .btn-success { background: #1a3520; color: #a8e6cf; }
    .btn-primary { background: #1e2a4a; color: #7eb8f7; }
    .btn-lg { padding: 8px 20px; font-size: 13px; }

    /* Toggle */
    .toggle-row { display: flex; align-items: center; gap: 16px; padding: 16px; background: #1a1a35; border-radius: 6px; margin-bottom: 16px; }
    .toggle { position: relative; width: 44px; height: 24px; }
    .toggle input { opacity: 0; width: 0; height: 0; }
    .toggle-slider { position: absolute; inset: 0; background: #333; border-radius: 24px; cursor: pointer; transition: 0.2s; }
    .toggle-slider:before { content: ''; position: absolute; width: 18px; height: 18px; left: 3px; bottom: 3px; background: white; border-radius: 50%; transition: 0.2s; }
    input:checked + .toggle-slider { background: #4caf50; }
    input:checked + .toggle-slider:before { transform: translateX(20px); }

    /* Logs */
    .log-pre { background: #0a0a18; border: 1px solid #2a2a4a; border-radius: 4px; padding: 12px; font-family: monospace; font-size: 11px; line-height: 1.5; overflow-y: auto; max-height: 500px; color: #aaa; white-space: pre-wrap; word-break: break-all; }

    /* Section header */
    .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
    .section-title { font-size: 16px; font-weight: 600; color: #eee; }

    /* Form elements */
    input.admin-input { background: #1a1a35; border: 1px solid #3a3a6a; color: #eee; padding: 6px 10px; border-radius: 4px; font-size: 13px; width: 200px; }
    input.admin-input:focus { outline: none; border-color: #7eb8f7; }

    /* Modal */
    .modal-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.7); z-index: 100; align-items: center; justify-content: center; }
    .modal-overlay.open { display: flex; }
    .modal { background: #1a1a35; border: 1px solid #3a3a6a; border-radius: 8px; padding: 24px; min-width: 320px; }
    .modal h3 { margin-bottom: 12px; color: #eee; }
    .modal-actions { display: flex; gap: 8px; margin-top: 16px; justify-content: flex-end; }

    /* Info table */
    .info-table { width: 100%; border-collapse: collapse; }
    .info-table td { padding: 10px 12px; border-bottom: 1px solid #1a1a2e; font-size: 13px; }
    .info-table td:first-child { color: #888; width: 200px; }
    .info-table td:last-child { color: #eee; }

    /* Pagination */
    .pagination { display: flex; gap: 8px; margin-top: 16px; align-items: center; font-size: 13px; color: #888; }
    .pagination button { background: #1a1a35; border: 1px solid #3a3a6a; color: #aaa; padding: 4px 10px; border-radius: 3px; cursor: pointer; }
    .pagination button:disabled { opacity: 0.4; cursor: default; }
    .pagination button:hover:not(:disabled) { border-color: #7eb8f7; color: #7eb8f7; }
  </style>
</head>
<body>

<nav class="admin-nav">
  <h1>⚙️ Admin Panel</h1>
  <div style="display:flex;gap:16px;align-items:center">
    <span id="adminUsername" style="font-size:13px;color:#888;"></span>
    <a href="/">← Back to Notes</a>
  </div>
</nav>

<div class="admin-layout">
  <aside class="admin-sidebar">
    <div class="sidebar-section-label">System</div>
    <div class="sidebar-item active" data-section="dashboard">📊 Dashboard</div>
    <div class="sidebar-item" data-section="signup">🔒 Signup Toggle</div>
    <div class="sidebar-item" data-section="server">🖥️ Server Info</div>
    <div class="sidebar-item" data-section="logs">📋 Access Logs</div>
    <div class="sidebar-item" data-section="backup">💾 DB Backup</div>
    <div class="sidebar-section-label" style="margin-top:8px">Users</div>
    <div class="sidebar-item" data-section="users">👥 User List</div>
    <div class="sidebar-section-label" style="margin-top:8px">Content</div>
    <div class="sidebar-item" data-section="notes">📝 Note Moderation</div>
  </aside>

  <main class="admin-content">

    <!-- Dashboard -->
    <div id="section-dashboard" class="section active">
      <div class="section-header"><span class="section-title">Dashboard</span></div>
      <div class="stat-cards" id="dashboardCards">
        <div class="stat-card"><div class="value" id="statUsers">—</div><div class="label">Total Users</div></div>
        <div class="stat-card"><div class="value" id="statNotes">—</div><div class="label">Total Notes</div></div>
        <div class="stat-card green" id="statSignupCard"><div class="value" id="statSignup">—</div><div class="label">Signups</div></div>
      </div>
    </div>

    <!-- Signup Toggle -->
    <div id="section-signup" class="section">
      <div class="section-header"><span class="section-title">Signup Toggle</span></div>
      <div class="toggle-row">
        <label class="toggle">
          <input type="checkbox" id="signupToggle" onchange="handleSignupToggle(this.checked)">
          <span class="toggle-slider"></span>
        </label>
        <div>
          <div id="signupToggleLabel" style="color:#eee;font-size:14px;">Loading...</div>
          <div style="color:#888;font-size:12px;margin-top:2px;">Controls whether new users can register</div>
        </div>
      </div>
    </div>

    <!-- Server Info -->
    <div id="section-server" class="section">
      <div class="section-header"><span class="section-title">Server Info</span></div>
      <table class="info-table" id="serverInfoTable"><tbody></tbody></table>
    </div>

    <!-- Logs -->
    <div id="section-logs" class="section">
      <div class="section-header">
        <span class="section-title">Access Logs</span>
        <button class="btn btn-primary" onclick="loadLogs()">↻ Refresh</button>
      </div>
      <pre class="log-pre" id="logOutput">Loading...</pre>
    </div>

    <!-- Backup -->
    <div id="section-backup" class="section">
      <div class="section-header"><span class="section-title">Database Backup</span></div>
      <div style="background:#1a1a35;border-radius:6px;padding:20px;max-width:400px;">
        <p style="color:#aaa;font-size:13px;margin-bottom:16px;">Creates a plain SQL dump of the entire database, saved to the <code style="color:#7eb8f7">backups/</code> directory on the server.</p>
        <button class="btn btn-primary btn-lg" id="backupBtn" onclick="runBackup()">💾 Create Backup Now</button>
        <div id="backupStatus" style="margin-top:12px;font-size:13px;color:#888;"></div>
      </div>
    </div>

    <!-- Users -->
    <div id="section-users" class="section">
      <div class="section-header"><span class="section-title">Users</span></div>
      <table class="admin-table">
        <thead><tr>
          <th>Username</th><th>Email</th><th>Notes</th><th>Last Login</th><th>Status</th><th>Actions</th>
        </tr></thead>
        <tbody id="usersTableBody"></tbody>
      </table>
    </div>

    <!-- Notes -->
    <div id="section-notes" class="section">
      <div class="section-header"><span class="section-title">Note Moderation</span></div>
      <table class="admin-table">
        <thead><tr>
          <th>User</th><th>Preview</th><th>Created</th><th>Action</th>
        </tr></thead>
        <tbody id="notesTableBody"></tbody>
      </table>
      <div class="pagination" id="notesPagination"></div>
    </div>

  </main>
</div>

<!-- Modals -->
<div class="modal-overlay" id="renameModal">
  <div class="modal">
    <h3>Rename User</h3>
    <input class="admin-input" id="renameInput" placeholder="New username" style="width:100%">
    <div class="modal-actions">
      <button class="btn btn-primary" onclick="closeModal('renameModal')">Cancel</button>
      <button class="btn btn-warn" onclick="submitRename()">Rename</button>
    </div>
  </div>
</div>

<div class="modal-overlay" id="resetPasswordModal">
  <div class="modal">
    <h3>Reset Password</h3>
    <input class="admin-input" type="password" id="resetPasswordInput" placeholder="New password (min 8 chars)" style="width:100%">
    <div class="modal-actions">
      <button class="btn btn-primary" onclick="closeModal('resetPasswordModal')">Cancel</button>
      <button class="btn btn-warn" onclick="submitResetPassword()">Reset</button>
    </div>
  </div>
</div>

<div class="modal-overlay" id="confirmModal">
  <div class="modal">
    <h3 id="confirmTitle">Confirm</h3>
    <p id="confirmMessage" style="color:#aaa;font-size:13px;margin-top:8px;"></p>
    <div class="modal-actions">
      <button class="btn btn-primary" onclick="closeModal('confirmModal')">Cancel</button>
      <button class="btn btn-danger" id="confirmOkBtn">Confirm</button>
    </div>
  </div>
</div>

<script type="module" src="js/admin.js"></script>
</body>
</html>
```

- [ ] **Step 2: Open the page in browser and verify redirect to `/` if not logged in as rick**

Visit `http://localhost:3012/admin.html`. If not authenticated as rick, should redirect to `/`.

- [ ] **Step 3: Commit**

```bash
git add frontend/admin.html
git commit -m "feat: admin.html — page shell with sidebar nav, sections, and modals"
```

---

## Task 8: Admin JS

**Files:**
- Create: `frontend/js/admin.js`

- [ ] **Step 1: Create `frontend/js/admin.js`**

```js
// admin.js — Admin panel logic

const API = '/api/admin';
let currentUserId = null; // For modal actions
let notesPage = 1;

// ── Auth guard ───────────────────────────────────────────────────────────────
async function checkAdminAuth() {
  const res = await fetch('/api/auth/me');
  if (!res.ok) { window.location.href = '/'; return; }
  const data = await res.json();
  if (!data.user?.isAdmin) { window.location.href = '/'; return; }
  document.getElementById('adminUsername').textContent = data.user.username;
}

// ── Navigation ───────────────────────────────────────────────────────────────
function initNav() {
  document.querySelectorAll('.sidebar-item').forEach(item => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('active'));
      document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
      item.classList.add('active');
      const section = item.dataset.section;
      document.getElementById(`section-${section}`).classList.add('active');
      // Lazy-load section data
      if (section === 'dashboard') loadDashboard();
      if (section === 'signup') loadSignupToggle();
      if (section === 'server') loadServerInfo();
      if (section === 'logs') loadLogs();
      if (section === 'users') loadUsers();
      if (section === 'notes') loadNotes();
    });
  });
}

// ── Dashboard ────────────────────────────────────────────────────────────────
async function loadDashboard() {
  const data = await apiFetch('/stats');
  if (!data) return;
  document.getElementById('statUsers').textContent = data.totalUsers;
  document.getElementById('statNotes').textContent = data.totalNotes;
  document.getElementById('statSignup').textContent = data.signupsEnabled ? 'ON' : 'OFF';
  const card = document.getElementById('statSignupCard');
  card.className = 'stat-card ' + (data.signupsEnabled ? 'green' : 'red');
}

// ── Signup toggle ────────────────────────────────────────────────────────────
async function loadSignupToggle() {
  const data = await apiFetch('/settings');
  if (!data) return;
  const enabled = data.settings.signups_enabled === 'true';
  document.getElementById('signupToggle').checked = enabled;
  document.getElementById('signupToggleLabel').textContent = enabled ? 'Signups are ENABLED' : 'Signups are DISABLED';
}

window.handleSignupToggle = async (checked) => {
  const label = document.getElementById('signupToggleLabel');
  label.textContent = 'Saving...';
  await apiFetch('/settings', {
    method: 'POST',
    body: JSON.stringify({ key: 'signups_enabled', value: checked ? 'true' : 'false' }),
  });
  label.textContent = checked ? 'Signups are ENABLED' : 'Signups are DISABLED';
};

// ── Server info ───────────────────────────────────────────────────────────────
async function loadServerInfo() {
  const data = await apiFetch('/server-info');
  if (!data) return;
  const tbody = document.querySelector('#serverInfoTable tbody');
  const rows = [
    ['Node.js Version', data.nodeVersion],
    ['Platform', data.platform],
    ['Uptime', formatUptime(data.uptimeSeconds)],
    ['Memory (RSS)', data.memoryMB + ' MB'],
    ['Database', data.dbStatus],
    ['DB Server Time', data.dbTime ? new Date(data.dbTime).toLocaleString() : '—'],
  ];
  tbody.innerHTML = rows.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('');
}

function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [d && `${d}d`, h && `${h}h`, m && `${m}m`, `${s}s`].filter(Boolean).join(' ');
}

// ── Logs ─────────────────────────────────────────────────────────────────────
window.loadLogs = async function () {
  const el = document.getElementById('logOutput');
  el.textContent = 'Loading...';
  const data = await apiFetch('/logs');
  if (!data) return;
  el.textContent = data.lines.join('\n') || '(no log entries)';
  el.scrollTop = el.scrollHeight;
};

// ── Backup ───────────────────────────────────────────────────────────────────
window.runBackup = async function () {
  const btn = document.getElementById('backupBtn');
  const status = document.getElementById('backupStatus');
  btn.disabled = true;
  status.textContent = 'Creating backup...';
  const data = await apiFetch('/backup', { method: 'POST' });
  btn.disabled = false;
  if (data?.success) {
    status.style.color = '#a8e6cf';
    status.textContent = `✓ Backup created: ${data.filename}`;
  } else {
    status.style.color = '#f78';
    status.textContent = `✗ Backup failed`;
  }
};

// ── Users ─────────────────────────────────────────────────────────────────────
async function loadUsers() {
  const data = await apiFetch('/users');
  if (!data) return;
  const tbody = document.getElementById('usersTableBody');
  tbody.innerHTML = data.users.map(u => {
    const isRick = u.username === 'rick';
    const statusBadge = isRick
      ? '<span class="badge admin">admin</span>'
      : u.suspended
        ? '<span class="badge suspended">suspended</span>'
        : '<span class="badge active">active</span>';
    const actions = isRick ? '<span style="color:#555;font-size:12px;">—</span>' : `
      <div style="display:flex;gap:4px;flex-wrap:wrap">
        <button class="btn ${u.suspended ? 'btn-success' : 'btn-warn'}" onclick="toggleSuspend(${u.id},'${esc(u.username)}',${u.suspended})">${u.suspended ? '▶ Restore' : '⏸ Suspend'}</button>
        <button class="btn btn-primary" onclick="openRename(${u.id},'${esc(u.username)}')">✏ Rename</button>
        <button class="btn btn-warn" onclick="openResetPassword(${u.id},'${esc(u.username)}')">🔑 Reset PW</button>
        <button class="btn btn-primary" onclick="forceLogout(${u.id},'${esc(u.username)}')">⏏ Logout</button>
        <button class="btn btn-danger" onclick="deleteUser(${u.id},'${esc(u.username)}')">🗑 Delete</button>
      </div>`;
    return `<tr>
      <td style="color:#7eb8f7">${esc(u.username)}</td>
      <td style="color:#888">${u.email ? esc(u.email) : '—'}</td>
      <td>${u.note_count}</td>
      <td style="color:#888;font-size:12px">${u.last_login ? new Date(u.last_login).toLocaleDateString() : 'Never'}</td>
      <td>${statusBadge}</td>
      <td>${actions}</td>
    </tr>`;
  }).join('');
}

window.toggleSuspend = async (id, username, currentlySuspended) => {
  if (!confirm(`${currentlySuspended ? 'Restore' : 'Suspend'} user "${username}"?`)) return;
  await apiFetch(`/users/${id}/suspend`, { method: 'PATCH' });
  loadUsers();
};

window.deleteUser = (id, username) => {
  openConfirm(
    `Delete "${username}"?`,
    `This will permanently delete ${username} and all their notes and categories. This cannot be undone.`,
    async () => { await apiFetch(`/users/${id}`, { method: 'DELETE' }); loadUsers(); }
  );
};

window.forceLogout = async (id, username) => {
  if (!confirm(`Force-logout "${username}"? Their current session will be invalidated.`)) return;
  await apiFetch(`/users/${id}/logout`, { method: 'POST' });
  alert(`${username} has been logged out.`);
};

let renameTargetId = null;
window.openRename = (id, username) => {
  renameTargetId = id;
  document.getElementById('renameInput').value = username;
  document.getElementById('renameModal').classList.add('open');
};

window.submitRename = async () => {
  const username = document.getElementById('renameInput').value.trim();
  if (!username) return;
  const res = await apiFetch(`/users/${renameTargetId}/rename`, {
    method: 'PATCH',
    body: JSON.stringify({ username }),
  });
  if (res) { closeModal('renameModal'); loadUsers(); }
};

let resetPasswordTargetId = null;
window.openResetPassword = (id, username) => {
  resetPasswordTargetId = id;
  document.getElementById('resetPasswordInput').value = '';
  document.getElementById('resetPasswordModal').classList.add('open');
};

window.submitResetPassword = async () => {
  const newPassword = document.getElementById('resetPasswordInput').value;
  if (!newPassword || newPassword.length < 8) { alert('Password must be at least 8 characters'); return; }
  const res = await apiFetch(`/users/${resetPasswordTargetId}/reset-password`, {
    method: 'POST',
    body: JSON.stringify({ newPassword }),
  });
  if (res) { closeModal('resetPasswordModal'); alert('Password reset successfully.'); }
};

// ── Notes ─────────────────────────────────────────────────────────────────────
async function loadNotes(page = 1) {
  notesPage = page;
  const data = await apiFetch(`/notes?page=${page}&limit=50`);
  if (!data) return;
  const tbody = document.getElementById('notesTableBody');
  tbody.innerHTML = data.notes.map(n => `<tr>
    <td style="color:#7eb8f7">${esc(n.username)}</td>
    <td style="color:#aaa;max-width:400px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(n.preview || '(empty)')}</td>
    <td style="color:#888;font-size:12px">${new Date(n.created_at).toLocaleDateString()}</td>
    <td><button class="btn btn-danger" onclick="deleteNote(${n.id})">🗑 Delete</button></td>
  </tr>`).join('');

  const totalPages = Math.ceil(data.total / 50);
  const pagination = document.getElementById('notesPagination');
  pagination.innerHTML = `
    <button onclick="loadNotes(${page - 1})" ${page <= 1 ? 'disabled' : ''}>← Prev</button>
    <span>Page ${page} of ${totalPages} (${data.total} total)</span>
    <button onclick="loadNotes(${page + 1})" ${page >= totalPages ? 'disabled' : ''}>Next →</button>
  `;
}

window.deleteNote = (id) => {
  openConfirm('Delete this note?', 'This note will be permanently deleted.', async () => {
    await apiFetch(`/notes/${id}`, { method: 'DELETE' });
    loadNotes(notesPage);
  });
};

// ── Modals ────────────────────────────────────────────────────────────────────
let confirmCallback = null;
function openConfirm(title, message, callback) {
  document.getElementById('confirmTitle').textContent = title;
  document.getElementById('confirmMessage').textContent = message;
  confirmCallback = callback;
  document.getElementById('confirmModal').classList.add('open');
  document.getElementById('confirmOkBtn').onclick = async () => {
    closeModal('confirmModal');
    await confirmCallback();
  };
}

window.closeModal = (id) => {
  document.getElementById(id).classList.remove('open');
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function apiFetch(path, options = {}) {
  try {
    const res = await fetch(API + path, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    if (res.status === 401 || res.status === 403) {
      window.location.href = '/';
      return null;
    }
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || 'Request failed');
      return null;
    }
    return data;
  } catch (err) {
    console.error('Admin API error:', err);
    alert('Network error');
    return null;
  }
}

// ── Init ──────────────────────────────────────────────────────────────────────
(async () => {
  await checkAdminAuth();
  initNav();
  loadDashboard();
})();
```

- [ ] **Step 2: Open admin panel in browser and verify all sections work**

Visit `http://localhost:3012/admin.html` logged in as rick. Check:
- Dashboard shows correct counts
- Signup toggle works (turn off, verify registration fails, turn back on)
- Server info displays node version and uptime
- Logs section loads log lines
- Users table shows all users with action buttons
- Notes table shows paginated notes

- [ ] **Step 3: Commit**

```bash
git add frontend/js/admin.js
git commit -m "feat: admin.js — full admin panel UI: dashboard, signup toggle, users, notes, logs, backup, server info"
```

---

## Task 9: Admin Navbar Link

**Files:**
- Modify: `frontend/js/main.js`

- [ ] **Step 1: Add admin link to `updateUsernameDisplay` in `main.js`**

Find the block that sets the username display (around line 28):
```js
if (elements.usernameDisplay) {
  elements.usernameDisplay.textContent = `${user.username}`;
}
```

Replace with:
```js
if (elements.usernameDisplay) {
  elements.usernameDisplay.textContent = `${user.username}`;
}

// Show admin link for rick
if (user.isAdmin) {
  const existing = document.getElementById('adminNavLink');
  if (!existing) {
    const link = document.createElement('a');
    link.id = 'adminNavLink';
    link.href = '/admin.html';
    link.textContent = '⚙️ Admin';
    link.style.cssText = 'font-size:12px;color:#7eb8f7;text-decoration:none;margin-left:8px;opacity:0.8;';
    link.onmouseover = () => link.style.opacity = '1';
    link.onmouseout = () => link.style.opacity = '0.8';
    elements.usernameDisplay.parentElement.appendChild(link);
  }
}
```

- [ ] **Step 2: Verify the admin link appears in the navbar when logged in as rick**

Reload `http://localhost:3012` logged in as rick. A small "⚙️ Admin" link should appear next to the username. Click it — should navigate to `/admin.html`.

Log in as a different user — no admin link should appear.

- [ ] **Step 3: Commit**

```bash
git add frontend/js/main.js
git commit -m "feat: show admin navbar link for rick in main app"
```

---

## Task 10: End-to-End Verification

- [ ] **Step 1: Full flow as rick**

1. Log in as rick at `http://localhost:3012`
2. Verify "⚙️ Admin" link in navbar
3. Click it — verify admin panel loads
4. Dashboard: correct user and note counts
5. Signup toggle: disable → try registering → fails → re-enable → registration works
6. Server info: shows node version, uptime, DB connected
7. Logs: shows Morgan log lines
8. DB Backup: click backup button → success message with filename
9. Users: list shows all users, rick row has no destructive actions
10. Suspend a test user → badge changes → try to login as them → fails with "Account suspended" → restore them
11. Force logout a test user → their session is invalidated
12. Note moderation: notes listed with user and preview, pagination works, delete a test note

- [ ] **Step 2: Verify non-admin cannot access admin routes**

```bash
# As a non-admin user
curl -s -b /tmp/othercookies.txt http://localhost:3012/api/admin/stats | jq .error
```
Expected: `"Admin access required"`

```bash
# Without auth
curl -s http://localhost:3012/api/admin/stats | jq .error
```
Expected: `"Authentication required"`

- [ ] **Step 3: Verify admin.html redirects non-admin**

Log out and visit `http://localhost:3012/admin.html` — should redirect to `/`.
Log in as a non-rick user and visit `http://localhost:3012/admin.html` — should redirect to `/`.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: admin panel — complete implementation"
```
