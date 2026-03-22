# Admin Panel Design

**Date:** 2026-03-22
**Status:** Approved

## Overview

A dedicated admin panel (`/admin.html`) accessible only to the user `rick`. Provides full system control: signup toggling, user management, server monitoring, log viewing, database backup, and note moderation.

---

## Admin Identity

- Admin is identified by `username === 'rick'` — hardcoded, single admin, no roles table needed.
- Works for both the `.env` legacy admin account (`AUTH_USERNAME=rick`) and any DB user named `rick`.
- The JWT already carries `username`; a new `isAdmin` middleware checks `req.user.username !== 'rick'` server-side on every `/api/admin/*` request.
- The frontend shows an "Admin" navbar link only when `/api/auth/me` returns `isAdmin: true`.

### `.env` legacy admin path
The existing `AUTH_USERNAME`/`AUTH_PASSWORD_HASH` login path is **retained** for backward compatibility. When this path is used, the JWT contains `userId: "admin"` and `isAdmin: true`. The `authenticate` middleware will be updated to add `suspended`/`invalidated_at` DB checks as **new code**. The `decoded.isAdmin === true` skip guard must be added so that these new checks do not break the `.env` admin path. Note: the `.env` admin password hash was generated **without** the pepper, so the login comparison for this path must remain pepper-free (as it currently is).

### `/api/auth/login` suspended check
The DB login path must check `suspended === true` before issuing a JWT and return `403 Forbidden` if the user is suspended. Without this, a suspended user can still receive a new token and reach the authenticated frontend state before being blocked.

### `/api/auth/me` update
The `/me` endpoint must be updated to return `isAdmin: true` for DB users where `username === 'rick'`:
```js
isAdmin: user.username === 'rick'
```
Without this, the navbar admin link will never appear for a DB-based rick account.

---

## Data Model Changes

### New table: `app_settings`
```sql
CREATE TABLE app_settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
INSERT INTO app_settings (key, value) VALUES ('signups_enabled', 'true');
GRANT ALL PRIVILEGES ON TABLE app_settings TO notesapp_user;
```
Replaces the static `SIGNUPS_ENABLED` env var check with a live DB-backed toggle.

### New columns on `users`
```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended      BOOLEAN      NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS invalidated_at TIMESTAMPTZ;
```
- `suspended`: blocks login without deleting the account.
- `invalidated_at`: used for force-logout — auth middleware rejects tokens issued before this timestamp.
- `IF NOT EXISTS` makes the statements safe to run on both fresh installs and live databases.

### Migration delivery
All new SQL goes in **`init-db/02-admin-migration.sql`** (a new file). The `app_settings` table creation and `users` column alterations live here, not in `01-schema.sql`. This file is applied once manually to a live DB; Docker init will pick it up automatically on fresh installs.

---

## Backend

### New file: `backend/routes/admin.js`
All routes require `authenticate` + `isAdmin` middleware.

| Method   | Route                              | Action                                      |
|----------|------------------------------------|---------------------------------------------|
| GET      | `/api/admin/stats`                 | Total users, total notes, signup state      |
| GET      | `/api/admin/settings`              | Read `app_settings`                         |
| POST     | `/api/admin/settings`              | Update `signups_enabled`                    |
| GET      | `/api/admin/users`                 | All users with note counts, status, dates   |
| PATCH    | `/api/admin/users/:id/suspend`     | Toggle `suspended` flag                     |
| DELETE   | `/api/admin/users/:id`             | Delete user and all their notes/categories  |
| PATCH    | `/api/admin/users/:id/rename`      | Change username                             |
| POST     | `/api/admin/users/:id/reset-password` | Set new password (admin-supplied)        |
| POST     | `/api/admin/users/:id/logout`      | Set `invalidated_at = NOW()`                |
| GET      | `/api/admin/server-info`           | Node version, uptime, DB status             |
| GET      | `/api/admin/logs`                  | Last 200 lines of `backend-server.log`      |
| POST     | `/api/admin/backup`                | Run `pg_dump`, save to `backups/`           |
| GET      | `/api/admin/notes`                 | All notes across all users (paginated `?page=1&limit=50`) |
| DELETE   | `/api/admin/notes/:id`             | Delete a specific note (admin only)         |

### Updated: `backend/middleware/auth.js`
- Add `isAdmin` middleware: `if (req.user.username !== 'rick') return res.status(403).json(...)`.
- Update `authenticate` middleware: after verifying JWT, if `decoded.isAdmin === true` skip the DB lookup and proceed. Otherwise query the `users` table and reject if `suspended === true` or `token.iat < invalidated_at` (in seconds).
- All routes follow the existing error shape `{ error: 'message' }` and success shape `{ success: true, ... }`.

### Updated: `backend/routes/admin.js` — destructive action logging
Destructive admin actions (delete user, force logout, reset password, suspend, rename, delete note) must `console.log` for audit traceability, e.g. `Admin action: deleted user ${id}`.

### Updated: `backend/routes/auth.js`
- Replace `process.env.SIGNUPS_ENABLED` check with a DB query to `app_settings` where `key = 'signups_enabled'`.
- DB login path must check `suspended === true` and return `403` before issuing a JWT.

### Updated: `backend/index.js`
- Mount admin routes: `app.use('/api/admin', adminRoutes)`.

---

## Frontend

### New file: `frontend/admin.html`
- Full page with dark theme matching the existing app.
- Layout: top navbar (title + "Back to Notes" link) + two-column (sidebar nav + main content area).
- Sidebar sections: Dashboard, Signup Toggle, Server Info, Access Logs, DB Backup, User List, Note Moderation.
- On load: calls `/api/auth/me` — if not admin, redirects to `/`.

### New file: `frontend/js/admin.js`
All admin UI logic and API calls. Sections:
- **Dashboard**: summary cards (total users, total notes, signup status).
- **Signup Toggle**: single toggle switch, calls `POST /api/admin/settings`.
- **Server Info**: table showing Node version, uptime, DB ping.
- **Access Logs**: pre-formatted scrollable log tail, refresh button.
- **DB Backup**: button triggers backup, shows filename (`backup-YYYY-MM-DD-HHmmss.sql`) and timestamp of last backup.
- **User List**: table with columns — username, email, notes, last login, status badge, actions (suspend/restore, delete, rename, reset password, force logout). Rick's own row shows "admin" badge, no destructive actions.
- **Note Moderation**: paginated table of all notes — username, content preview (first 100 characters of `content`), created date, with a delete action. There is no separate `title` column in the notes table.

### Updated: `frontend/js/api.js` (or `main.js`)
- After login/auth check, if `isAdmin` expose the "Admin" link in the navbar pointing to `/admin.html`.

---

## Security

- All `/api/admin/*` routes require valid JWT + `username === 'rick'`. A non-admin hitting these routes gets 403.
- `admin.html` self-redirects to `/` on load if the user isn't admin.
- Rick cannot delete, suspend, or force-logout himself (guarded both frontend and backend).
- DB backup files are saved server-side only — not streamed to the browser. `pg_dump` is invoked via Node `child_process` with `PGPASSWORD` set from `process.env.DB_PASSWORD`. Output is plain SQL, saved to `backups/` (relative to project root), filename pattern `backup-YYYY-MM-DD-HHmmss.sql`. The handler must create the `backups/` directory if it does not exist (`fs.mkdirSync` with `{ recursive: true }`).
- `GET /api/admin/logs` reads the last 200 lines of `backend-server.log` at the project root — the file produced by the existing Morgan/stdout logging setup (added in commit `0d2a402`).
- `DELETE /api/admin/users/:id` uses a single `DELETE FROM users WHERE id = $1`; the `ON DELETE CASCADE` constraints on `notes.user_id` and `categories.user_id` handle child row cleanup automatically.
- `PATCH /api/admin/users/:id/rename` returns `409 Conflict` if the new username is already taken (consistent with registration duplicate handling).
- Password reset by admin uses the same bcrypt + pepper flow as registration.

---

## Files Changed / Created

| File | Change |
|------|--------|
| `backend/routes/admin.js` | **New** |
| `backend/middleware/auth.js` | Add `isAdmin` middleware, update `authenticate` for suspend/invalidation checks |
| `backend/routes/auth.js` | Replace env-var signup check with DB query; add suspended check on login; add `isAdmin` to `/me` response for DB rick |
| `backend/index.js` | Mount admin routes |
| `frontend/admin.html` | **New** |
| `frontend/js/admin.js` | **New** |
| `frontend/js/main.js` (or `ui.js`) | Show admin navbar link for rick |
| `init-db/02-admin-migration.sql` | **New** — `app_settings` table + `users` column alterations |
