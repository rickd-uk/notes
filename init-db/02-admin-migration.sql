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
