# Note Encryption Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add client-side AES-256-GCM encryption for notes, protected by a user-set master password (separate from login), with a recovery key fallback, integrated alongside the existing simple lock feature.

**Architecture:** Encryption/decryption happens entirely in the browser using the Web Crypto API — the server only ever stores ciphertext. A master password is set once in Settings; a PBKDF2-derived AES key is held in session memory (cleared on refresh). Notes can be individually encrypted (🔐) or simply locked (🔒); the 🔐 button is hidden unless the user has set a master password. A one-time recovery key is generated at password-setup time and stored as a second verifier, allowing access if the main password is forgotten.

**Tech Stack:** Web Crypto API (PBKDF2 + AES-256-GCM, built into browsers), PostgreSQL (new columns), Express (new routes), vanilla ES modules.

---

## File Structure

**New files:**
- `frontend/js/crypto.js` — pure Web Crypto helpers (derive key, encrypt, decrypt, generate salt/recovery key)
- `frontend/js/encryptionManager.js` — session state, set/remove password flows, encrypt/decrypt note flows

**Modified files:**
- `init-db/01-schema.sql` — add `encrypted` to notes, add 4 encryption columns to users
- `backend/routes/auth.js` — 3 new encryption-password endpoints
- `frontend/js/api.js` — 4 new API functions + `await` added to existing `renderNotes()` call sites
- `frontend/index.html` — Encryption section in Settings; 3 new modals (set-password, recovery-key, unlock-prompt)
- `frontend/js/eventHandlers.js` — handlers for set/remove password, register unlock prompt; `await` added to existing `renderNotes()` call sites (at least 3)
- `frontend/js/noteControls.js` — add 🔐 button (conditional on password being set)
- `frontend/js/ui.js` — render encrypted notes with placeholder content, set encrypted data attr; make `renderNotes` async
- `frontend/js/sortNotes.js` — add `async`/`await` to `sortAndRenderNotes` call site for `renderNotes`
- `frontend/css/settings-modal.css` — encryption section styles
- `frontend/css/notes.css` — encrypted note card styles (reuses note--locked border, adds 🔐 badge)

---

## Crypto Design Reference

```
KNOWN_PLAINTEXT = "notes-app-v1-check"

Key derivation:
  key = PBKDF2(password_or_recoveryKey, salt, 100_000 iterations, SHA-256) → AES-256-GCM

Recovery key format (display only):
  16 random bytes → hex → uppercase → groups of 4: XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX

Ciphertext storage format (in notes.content when encrypted):
  "ENC:v1:<base64_iv>:<base64_ciphertext>"
  (GCM auth tag is appended automatically by WebCrypto to ciphertext bytes)

Verifier (stored on user record):
  encryption_verifier         = encrypt(main_key,     KNOWN_PLAINTEXT) → "ENC:v1:..."
  encryption_recovery_verifier = encrypt(recovery_key_derived, KNOWN_PLAINTEXT) → "ENC:v1:..."
  encryption_salt             = base64(16 random bytes)
  has_encryption_password     = true
```

---

## Task 1: Database — add encryption columns

**Files:**
- Modify: `init-db/01-schema.sql`

- [ ] **Step 1: Add `encrypted` column to notes table**

In `init-db/01-schema.sql`, change the notes table definition:
```sql
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    read_only BOOLEAN DEFAULT FALSE,
    encrypted BOOLEAN DEFAULT FALSE
```

- [ ] **Step 2: Add encryption columns to users table**

In `init-db/01-schema.sql`, change the users table definition:
```sql
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP,
    encryption_salt VARCHAR(64),
    encryption_verifier TEXT,
    encryption_recovery_verifier TEXT,
    has_encryption_password BOOLEAN DEFAULT FALSE
```

- [ ] **Step 3: Run migrations on existing database**

```bash
podman exec notes-postgres psql -U notesapp_user -d notesapp -c "
  ALTER TABLE notes ADD COLUMN IF NOT EXISTS encrypted BOOLEAN DEFAULT FALSE;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS encryption_salt VARCHAR(64);
  ALTER TABLE users ADD COLUMN IF NOT EXISTS encryption_verifier TEXT;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS encryption_recovery_verifier TEXT;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS has_encryption_password BOOLEAN DEFAULT FALSE;
"
```

Expected output: `ALTER TABLE` (×2)

- [ ] **Step 4: Verify columns exist**

```bash
podman exec notes-postgres psql -U notesapp_user -d notesapp -c "\d notes" | grep encrypted
podman exec notes-postgres psql -U notesapp_user -d notesapp -c "\d users" | grep encryption
```

Expected: rows for `encrypted`, `encryption_salt`, `encryption_verifier`, `encryption_recovery_verifier`, `has_encryption_password`

- [ ] **Step 5: Commit**

```bash
git add init-db/01-schema.sql
git commit -m "feat(db): add encryption columns to notes and users tables"
```

---

## Task 2: Backend — encryption password endpoints

**Files:**
- Modify: `backend/routes/auth.js` (add 3 routes before the `module.exports` line)

The `/me` route must also return `has_encryption_password`. The 3 new routes go just before `module.exports = router;`.

- [ ] **Step 1: Update `/me` route to include `has_encryption_password`**

Find this SELECT in `/me`:
```js
"SELECT id, username, email, created_at, last_login FROM users WHERE id = $1"
```
Change to:
```js
"SELECT id, username, email, created_at, last_login, has_encryption_password FROM users WHERE id = $1"
```

- [ ] **Step 2: Add `GET /auth/encryption-setup` route**

Returns the user's encryption salt, verifiers, and whether a password is set. The verifiers are needed by the client at unlock time to confirm the derived key is correct — without them `unlockWithPassword` / `unlockWithRecoveryKey` will always fail.

Add before `module.exports = router;`:
```js
// Get encryption setup info (salt + verifiers + flag) — no plaintext keys sent
router.get('/encryption-setup', authenticate, async (req, res) => {
  try {
    const userId = req.user.userId;
    if (userId === 'admin') return res.json({ has_encryption_password: false });
    const result = await db.query(
      `SELECT encryption_salt, encryption_verifier, encryption_recovery_verifier,
              has_encryption_password FROM users WHERE id = $1`,
      [userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});
```

- [ ] **Step 3: Add `POST /auth/encryption-password` route**

Sets (or replaces) the encryption password. Client sends salt + verifier + recovery_verifier — never the password itself.

```js
// Set encryption password (client sends salt + verifiers, never the password)
router.post('/encryption-password', authenticate, async (req, res) => {
  try {
    const userId = req.user.userId;
    if (userId === 'admin') return res.status(403).json({ error: 'Not supported for admin' });
    const { salt, verifier, recovery_verifier } = req.body;
    if (!salt || !verifier || !recovery_verifier) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    await db.query(
      `UPDATE users SET
        encryption_salt = $1,
        encryption_verifier = $2,
        encryption_recovery_verifier = $3,
        has_encryption_password = true
       WHERE id = $4`,
      [salt, verifier, recovery_verifier, userId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});
```

- [ ] **Step 4: Add `DELETE /auth/encryption-password` route**

Removes the encryption password. Client must have already decrypted all notes before calling this (handled by encryptionManager.js).

```js
// Remove encryption password
router.delete('/encryption-password', authenticate, async (req, res) => {
  try {
    const userId = req.user.userId;
    if (userId === 'admin') return res.status(403).json({ error: 'Not supported for admin' });
    await db.query(
      `UPDATE users SET
        encryption_salt = NULL,
        encryption_verifier = NULL,
        encryption_recovery_verifier = NULL,
        has_encryption_password = false
       WHERE id = $1`,
      [userId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});
```

- [ ] **Step 5: Restart backend and verify routes exist**

```bash
# Restart backend (adjust to your setup)
pm2 restart notes-backend
# or: systemctl restart notes-backend

# Verify routes respond (should get 401 without auth, not 404)
curl -s -o /dev/null -w "%{http_code}" http://localhost:3012/api/auth/encryption-setup
# Expected: 401
```

- [ ] **Step 6: Commit**

```bash
git add backend/routes/auth.js
git commit -m "feat(backend): add encryption password endpoints"
```

---

## Task 3: Frontend — `crypto.js` Web Crypto helpers

**Files:**
- Create: `frontend/js/crypto.js`

This module is pure functions, no DOM, no imports. All functions are async and use `window.crypto.subtle`.

- [ ] **Step 1: Create `frontend/js/crypto.js`**

```js
// crypto.js - Web Crypto API helpers for note encryption
// All operations are client-side only. The server never sees plaintext or keys.

const PBKDF2_ITERATIONS = 100_000;
const KNOWN_PLAINTEXT = "notes-app-v1-check";

// Encode/decode helpers
// NOTE: Do NOT use spread `...new Uint8Array(buf)` — it causes a call-stack overflow
// on large ciphertext (notes can be tens of KB). Use a loop instead.
function b64encode(buf) {
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}
function b64decode(str) {
  return Uint8Array.from(atob(str), c => c.charCodeAt(0));
}

// Generate 16 random bytes as base64 (used as salt)
export function generateSalt() {
  return b64encode(crypto.getRandomValues(new Uint8Array(16)));
}

// Generate a recovery key: 16 random bytes → uppercase hex → XXXX-XXXX-... (8 groups of 4)
export function generateRecoveryKey() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
  return hex.match(/.{4}/g).join('-');
}

// Normalise recovery key input (strip dashes, uppercase)
function normaliseRecoveryKey(key) {
  return key.replace(/-/g, '').toUpperCase();
}

// Import a raw password/string as a PBKDF2 key material
async function importKeyMaterial(password) {
  const enc = new TextEncoder();
  return crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
}

// Derive an AES-256-GCM key from a password and base64 salt
export async function deriveKey(password, saltB64) {
  const salt = b64decode(saltB64);
  const keyMaterial = await importKeyMaterial(password);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

// Derive an AES-256-GCM key from a recovery key (normalised) and base64 salt
export async function deriveKeyFromRecoveryKey(recoveryKey, saltB64) {
  return deriveKey(normaliseRecoveryKey(recoveryKey), saltB64);
}

// Encrypt plaintext string → "ENC:v1:<b64_iv>:<b64_ciphertext>"
export async function encryptText(key, plaintext) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder();
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(plaintext)
  );
  return `ENC:v1:${b64encode(iv)}:${b64encode(ciphertext)}`;
}

// Decrypt "ENC:v1:<b64_iv>:<b64_ciphertext>" → plaintext string
// Returns null if decryption fails (wrong key)
export async function decryptText(key, encoded) {
  try {
    const parts = encoded.split(':');
    if (parts[0] !== 'ENC' || parts[1] !== 'v1') return null;
    const iv = b64decode(parts[2]);
    const ciphertext = b64decode(parts[3]);
    const dec = new TextDecoder();
    const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
    return dec.decode(plaintext);
  } catch {
    return null;
  }
}

// Create a verifier blob: encrypt the known plaintext with the given key
export async function createVerifier(key) {
  return encryptText(key, KNOWN_PLAINTEXT);
}

// Check a key against a stored verifier — returns true if key is correct
export async function verifyKey(key, verifier) {
  const result = await decryptText(key, verifier);
  return result === KNOWN_PLAINTEXT;
}
```

- [ ] **Step 2: Verify file was created correctly**

```bash
head -5 /home/rick/Documents/D/WEB/_LIVE_/MAIN/notes/frontend/js/crypto.js
# Expected: // crypto.js - Web Crypto API helpers for note encryption
```

- [ ] **Step 3: Commit**

```bash
git add frontend/js/crypto.js
git commit -m "feat(crypto): add Web Crypto helper module"
```

---

## Task 4: Frontend — `encryptionManager.js` session & flow management

**Files:**
- Create: `frontend/js/encryptionManager.js`

This module holds the in-memory session key and orchestrates the set-password, unlock, encrypt-note, and decrypt-note flows. It imports from `crypto.js` and `api.js`.

- [ ] **Step 1: Create `frontend/js/encryptionManager.js`**

```js
// encryptionManager.js - Session key management and encryption flows

import {
  generateSalt, generateRecoveryKey, deriveKey, deriveKeyFromRecoveryKey,
  encryptText, decryptText, createVerifier, verifyKey
} from './crypto.js';
import {
  getEncryptionSetup, saveEncryptionPassword, removeEncryptionPasswordApi,
  setNoteEncryptedContent, setNoteReadOnly
} from './api.js';
import { getNotes } from './state.js';
import { showToast } from './uiUtils.js';

// In-memory session key — never persisted, cleared on page refresh
let _sessionKey = null;
let _encryptionSetup = null; // { has_encryption_password, encryption_salt }

// ── Setup ────────────────────────────────────────────────────────────────────

// Load and cache encryption setup from server
export async function loadEncryptionSetup() {
  _encryptionSetup = await getEncryptionSetup();
  return _encryptionSetup;
}

export function hasEncryptionPassword() {
  return _encryptionSetup?.has_encryption_password === true;
}

export function isUnlocked() {
  return _sessionKey !== null;
}

// ── Unlock ───────────────────────────────────────────────────────────────────

// Unlock with master password — returns true on success
export async function unlockWithPassword(password) {
  if (!_encryptionSetup?.encryption_salt) return false;
  const setup = await getEncryptionSetup(); // get fresh verifier
  const key = await deriveKey(password, setup.encryption_salt);
  const ok = await verifyKey(key, setup.encryption_verifier);
  if (ok) { _sessionKey = key; }
  return ok;
}

// Unlock with recovery key — returns true on success
export async function unlockWithRecoveryKey(recoveryKey) {
  if (!_encryptionSetup?.encryption_salt) return false;
  const setup = await getEncryptionSetup();
  const key = await deriveKeyFromRecoveryKey(recoveryKey, setup.encryption_salt);
  const ok = await verifyKey(key, setup.encryption_recovery_verifier);
  if (ok) { _sessionKey = key; }
  return ok;
}

// Lock session (forget key)
export function lockSession() {
  _sessionKey = null;
}

// ── Set / remove password ────────────────────────────────────────────────────

// Set a new encryption password. Returns the recovery key string to show the user.
export async function setEncryptionPassword(password) {
  const salt = generateSalt();
  const recoveryKey = generateRecoveryKey();

  const mainKey = await deriveKey(password, salt);
  const recoveryDerivedKey = await deriveKeyFromRecoveryKey(recoveryKey, salt);

  const verifier = await createVerifier(mainKey);
  const recoveryVerifier = await createVerifier(recoveryDerivedKey);

  const result = await saveEncryptionPassword(salt, verifier, recoveryVerifier);
  if (!result?.success) throw new Error('Failed to save encryption password');

  _sessionKey = mainKey;
  _encryptionSetup = { has_encryption_password: true, encryption_salt: salt };

  return recoveryKey;
}

// Remove encryption password. Decrypts all encrypted notes first.
export async function removeEncryptionPassword() {
  if (!_sessionKey) throw new Error('Session not unlocked');

  // Decrypt all encrypted notes before removing password
  const notes = getNotes();
  const encryptedNotes = notes.filter(n => n.encrypted);

  for (const note of encryptedNotes) {
    const plaintext = await decryptText(_sessionKey, note.content);
    if (plaintext !== null) {
      await setNoteEncryptedContent(note.id, plaintext, false);
      await setNoteReadOnly(note.id, false);
    }
  }

  await removeEncryptionPasswordApi();
  _sessionKey = null;
  _encryptionSetup = { has_encryption_password: false, encryption_salt: null };
}

// ── Per-note encrypt / decrypt ───────────────────────────────────────────────

// Encrypt a note's content and mark it as encrypted + read-only
export async function encryptNote(noteId, plainContent) {
  if (!_sessionKey) throw new Error('Session not unlocked');
  const ciphertext = await encryptText(_sessionKey, plainContent);
  await setNoteEncryptedContent(noteId, ciphertext, true);
  await setNoteReadOnly(noteId, true);
}

// Decrypt a note's content (does not save — just returns plaintext for display)
export async function decryptNoteContent(encryptedContent) {
  if (!_sessionKey) return null;
  return decryptText(_sessionKey, encryptedContent);
}

// Decrypt a note and save it back as plaintext, removing encryption flag
export async function decryptAndSaveNote(noteId, encryptedContent) {
  if (!_sessionKey) throw new Error('Session not unlocked');
  const plaintext = await decryptText(_sessionKey, encryptedContent);
  if (plaintext === null) throw new Error('Decryption failed — wrong key?');
  await setNoteEncryptedContent(noteId, plaintext, false);
  await setNoteReadOnly(noteId, false);
  return plaintext;
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/js/encryptionManager.js
git commit -m "feat(encryption): add encryption manager module"
```

---

## Task 5: Frontend API — four new functions in `api.js`

**Files:**
- Modify: `frontend/js/api.js`

Add these four functions. Add them near the other auth-related functions (after the `logout` function works well).

- [ ] **Step 1: Add `getEncryptionSetup`**

Find `export async function deleteEmptyNotes()` and add before it:

```js
export async function getEncryptionSetup() {
  try {
    const apiUrl = getApiUrl();
    const response = await fetch(`${apiUrl}/auth/encryption-setup`);
    if (!response.ok) return { has_encryption_password: false };
    return await response.json();
  } catch {
    return { has_encryption_password: false };
  }
}

export async function saveEncryptionPassword(salt, verifier, recovery_verifier) {
  try {
    const apiUrl = getApiUrl();
    const response = await fetch(`${apiUrl}/auth/encryption-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ salt, verifier, recovery_verifier }),
    });
    if (!response.ok) throw new Error('Failed to save encryption password');
    return await response.json();
  } catch (error) {
    console.error(error);
    showToast('Error saving encryption password');
    return null;
  }
}

export async function removeEncryptionPasswordApi() {
  try {
    const apiUrl = getApiUrl();
    const response = await fetch(`${apiUrl}/auth/encryption-password`, { method: 'DELETE' });
    if (!response.ok) throw new Error('Failed to remove encryption password');
    return await response.json();
  } catch (error) {
    console.error(error);
    showToast('Error removing encryption password');
    return null;
  }
}

export async function setNoteEncryptedContent(noteId, content, encrypted) {
  try {
    const apiUrl = getApiUrl();
    // Use a dedicated PATCH endpoint to set encrypted content + flag together
    const response = await fetch(`${apiUrl}/notes/${noteId}/encrypted`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, encrypted }),
    });
    if (!response.ok) throw new Error('Failed to update note encryption');
    clearAllCaches();
    return await response.json();
  } catch (error) {
    console.error(error);
    showToast('Error updating note');
    return null;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/js/api.js
git commit -m "feat(api): add encryption API functions"
```

---

## Task 6: Backend — `PATCH /notes/:id/encrypted` endpoint

**Files:**
- Modify: `backend/routes/notes.js`

Add before the existing `PATCH /:id/readonly` route (keep specific routes before wildcards).

**Before adding the route, verify authentication coverage.** Check whether `notes.js` applies `authenticate` at the router level (e.g. `router.use(authenticate)` near the top of the file) or per-route. If router-level, no change needed. If per-route, add `authenticate` as the second argument. The current `notes.js` uses `router.use(authenticate)` at the top, so no explicit middleware argument is needed — but confirm this hasn't changed.

- [ ] **Step 1: Add the route**

```js
// Update note content and encrypted flag together (bypasses read-only guard)
// Authentication is covered by router.use(authenticate) at the top of notes.js
router.patch('/:id/encrypted', async (req, res) => {
  try {
    const { id } = req.params;
    const { content, encrypted } = req.body;
    const userId = req.user.userId;

    let result;
    if (userId === 'admin') {
      result = await db.query(
        'UPDATE notes SET content = $1, encrypted = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *',
        [content, encrypted, id]
      );
    } else {
      result = await db.query(
        'UPDATE notes SET content = $1, encrypted = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 AND user_id = $4 RETURNING *',
        [content, encrypted, id, userId]
      );
    }

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Note not found or unauthorized' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});
```

- [ ] **Step 2: Restart backend and commit**

```bash
git add backend/routes/notes.js
git commit -m "feat(backend): add PATCH /notes/:id/encrypted endpoint"
```

---

## Task 7: HTML — Settings encryption section + 3 new modals

**Files:**
- Modify: `frontend/index.html`

### Step 1 — Add Encryption section to Settings modal

Find the `<!-- Account -->` section in `#settingsModal` and add a new section before it:

```html
<!-- Encryption -->
<div class="settings-section" id="encryptionSection">
  <div class="settings-section-label">Encryption</div>
  <div id="encryptionNoPassword">
    <button id="setEncryptionPasswordBtn" class="settings-link-btn">🔐 Set Encryption Password</button>
  </div>
  <div id="encryptionHasPassword" style="display:none">
    <button id="changeEncryptionPasswordBtn" class="settings-link-btn" style="margin-bottom:8px">🔑 Change Encryption Password</button>
    <button id="removeEncryptionPasswordBtn" class="settings-danger-btn" style="margin-bottom:0">🗑 Remove Encryption Password</button>
  </div>
</div>
```

### Step 2 — Add Set-Password modal

Add after `<!-- Settings Modal -->` closing `</div>` and before `<!-- Toast notification -->`:

```html
<!-- Set Encryption Password Modal -->
<div class="modal" id="setEncryptionModal" role="dialog" aria-modal="true">
  <div class="modal-content" style="max-width:380px">
    <div class="modal-header">🔐 Set Encryption Password</div>
    <p style="font-size:13px;color:#888;margin-bottom:16px">
      This password encrypts your notes in the browser. It is <strong>never sent to the server</strong>.
      If you forget it, only your recovery key can help — so save it carefully.
    </p>
    <input type="password" id="encNewPassword" class="modal-input" placeholder="New encryption password" autocomplete="new-password" />
    <input type="password" id="encConfirmPassword" class="modal-input" placeholder="Confirm password" autocomplete="new-password" style="margin-top:8px" />
    <div class="modal-actions">
      <button class="modal-btn modal-btn-cancel" id="cancelSetEncryptionBtn">Cancel</button>
      <button class="modal-btn modal-btn-confirm" id="confirmSetEncryptionBtn">Set Password</button>
    </div>
  </div>
</div>

<!-- Recovery Key Display Modal -->
<div class="modal" id="recoveryKeyModal" role="dialog" aria-modal="true">
  <div class="modal-content" style="max-width:420px">
    <div class="modal-header">⚠️ Save Your Recovery Key</div>
    <p style="font-size:13px;color:#888;margin-bottom:12px">
      If you forget your encryption password, this key is your <strong>only</strong> way to recover encrypted notes.
      Store it somewhere safe. It will not be shown again.
    </p>
    <div id="recoveryKeyDisplay" style="
      font-family:monospace;font-size:15px;font-weight:600;
      background:rgba(98,0,238,0.07);border-radius:8px;
      padding:14px 16px;letter-spacing:1px;text-align:center;
      word-break:break-all;margin-bottom:12px
    "></div>
    <button id="copyRecoveryKeyBtn" class="settings-link-btn" style="margin-bottom:16px">📋 Copy to clipboard</button>
    <div class="modal-actions">
      <button class="modal-btn modal-btn-confirm" id="savedRecoveryKeyBtn">I've saved my recovery key</button>
    </div>
  </div>
</div>

<!-- Unlock Encryption Modal -->
<div class="modal" id="unlockEncryptionModal" role="dialog" aria-modal="true">
  <div class="modal-content" style="max-width:360px">
    <div class="modal-header">🔐 Unlock Encrypted Notes</div>
    <p style="font-size:13px;color:#888;margin-bottom:16px">
      Enter your encryption password (or recovery key) to decrypt notes this session.
    </p>
    <input type="password" id="unlockPasswordInput" class="modal-input"
           placeholder="Encryption password or recovery key"
           autocomplete="current-password" />
    <div class="modal-actions">
      <button class="modal-btn modal-btn-cancel" id="cancelUnlockBtn">Cancel</button>
      <button class="modal-btn modal-btn-confirm" id="confirmUnlockBtn">Unlock</button>
    </div>
  </div>
</div>
```

- [ ] **Step 3: Commit**

```bash
git add frontend/index.html
git commit -m "feat(html): add encryption settings section and modals"
```

---

## Task 8: `eventHandlers.js` — wire up encryption settings

**Files:**
- Modify: `frontend/js/eventHandlers.js`

- [ ] **Step 1: Add imports**

Add to the existing imports at the top:

```js
import {
  loadEncryptionSetup, hasEncryptionPassword, isUnlocked,
  setEncryptionPassword, removeEncryptionPassword, unlockWithPassword,
  unlockWithRecoveryKey
} from './encryptionManager.js';
// NOTE: saveEncryptionPassword and removeEncryptionPasswordApi are called internally
// by encryptionManager.js — do NOT import them here.
```

- [ ] **Step 2: Call `loadEncryptionSetup` on init and update Settings UI**

In the `initializeEventListeners` function (or wherever settings modal is wired up), after the settings button listener, add:

```js
// Load encryption setup and update UI
async function updateEncryptionUI() {
  await loadEncryptionSetup();
  const noPassword = document.getElementById('encryptionNoPassword');
  const hasPassword = document.getElementById('encryptionHasPassword');
  if (noPassword && hasPassword) {
    const has = hasEncryptionPassword();
    noPassword.style.display = has ? 'none' : '';
    hasPassword.style.display = has ? '' : 'none';
  }
}
updateEncryptionUI();
```

- [ ] **Step 3: Wire set-encryption-password flow**

```js
const setEncryptionPasswordBtn = document.getElementById('setEncryptionPasswordBtn');
const changeEncryptionPasswordBtn = document.getElementById('changeEncryptionPasswordBtn');
const cancelSetEncryptionBtn = document.getElementById('cancelSetEncryptionBtn');
const confirmSetEncryptionBtn = document.getElementById('confirmSetEncryptionBtn');
const setEncryptionModal = document.getElementById('setEncryptionModal');

function openSetEncryptionModal() {
  const settingsModal = document.getElementById('settingsModal');
  if (settingsModal) settingsModal.classList.remove('active');
  document.getElementById('encNewPassword').value = '';
  document.getElementById('encConfirmPassword').value = '';
  setEncryptionModal.classList.add('active');
}

if (setEncryptionPasswordBtn) setEncryptionPasswordBtn.addEventListener('click', openSetEncryptionModal);
if (changeEncryptionPasswordBtn) changeEncryptionPasswordBtn.addEventListener('click', openSetEncryptionModal);
if (cancelSetEncryptionBtn) cancelSetEncryptionBtn.addEventListener('click', () => setEncryptionModal.classList.remove('active'));

if (confirmSetEncryptionBtn) {
  confirmSetEncryptionBtn.addEventListener('click', async () => {
    const pwd = document.getElementById('encNewPassword').value;
    const confirm = document.getElementById('encConfirmPassword').value;
    if (!pwd) { showToast('Please enter a password'); return; }
    if (pwd !== confirm) { showToast('Passwords do not match'); return; }
    if (pwd.length < 6) { showToast('Password must be at least 6 characters'); return; }

    confirmSetEncryptionBtn.disabled = true;
    confirmSetEncryptionBtn.textContent = 'Setting up…';
    try {
      const recoveryKey = await setEncryptionPassword(pwd);
      setEncryptionModal.classList.remove('active');
      // Show recovery key modal
      document.getElementById('recoveryKeyDisplay').textContent = recoveryKey;
      document.getElementById('recoveryKeyModal').classList.add('active');
      updateEncryptionUI();
    } catch (err) {
      showToast('Error setting encryption password');
      console.error(err);
    } finally {
      confirmSetEncryptionBtn.disabled = false;
      confirmSetEncryptionBtn.textContent = 'Set Password';
    }
  });
}
```

- [ ] **Step 4: Wire recovery key modal**

```js
document.getElementById('copyRecoveryKeyBtn')?.addEventListener('click', () => {
  const key = document.getElementById('recoveryKeyDisplay').textContent;
  navigator.clipboard.writeText(key).then(() => showToast('Recovery key copied'));
});

document.getElementById('savedRecoveryKeyBtn')?.addEventListener('click', () => {
  document.getElementById('recoveryKeyModal').classList.remove('active');
  showToast('Encryption password set');
});
```

- [ ] **Step 5: Wire remove-encryption-password flow**

```js
document.getElementById('removeEncryptionPasswordBtn')?.addEventListener('click', async () => {
  const settingsModal = document.getElementById('settingsModal');
  if (settingsModal) settingsModal.classList.remove('active');

  const confirmed = await confirmDialog(
    'This will decrypt all your encrypted notes and remove the encryption password. Are you sure?',
    'Remove Encryption Password',
    'Remove'
  );
  if (!confirmed) return;

  if (!isUnlocked()) {
    showToast('Please unlock your notes first before removing encryption');
    showUnlockModal();
    return;
  }

  try {
    await removeEncryptionPassword();
    await loadNotes();
    updateEncryptionUI();
    showToast('Encryption password removed');
  } catch (err) {
    showToast('Error removing encryption password');
    console.error(err);
  }
});
```

- [ ] **Step 6: Wire unlock modal**

**IMPORTANT:** `showUnlockModal` must be defined at **module scope** (top level of `eventHandlers.js`), NOT inside `initializeEventListeners`. It is imported by `noteControls.js` — if it's nested inside a function it cannot be exported.

Place this directly in the file body, not inside any function:

```js
export function showUnlockModal(onSuccess) {
  const modal = document.getElementById('unlockEncryptionModal');
  document.getElementById('unlockPasswordInput').value = '';
  modal.classList.add('active');

  // Re-query inside cleanup to avoid stale references after replaceWith.
  // replaceWith detaches the old node — any closed-over variable pointing to it
  // becomes a reference to a detached element, making subsequent replaceWith a no-op
  // and causing event listeners to accumulate on repeated opens.
  const cleanup = () => {
    modal.classList.remove('active');
    const cb = document.getElementById('confirmUnlockBtn');
    const cancel = document.getElementById('cancelUnlockBtn');
    if (cb) cb.replaceWith(cb.cloneNode(true));
    if (cancel) cancel.replaceWith(cancel.cloneNode(true));
  };

  document.getElementById('cancelUnlockBtn').addEventListener('click', cleanup);

  document.getElementById('confirmUnlockBtn').addEventListener('click', async () => {
    const input = document.getElementById('unlockPasswordInput').value.trim();
    if (!input) { showToast('Please enter your password or recovery key'); return; }

    // Try as password first, then as recovery key
    let ok = await unlockWithPassword(input);
    if (!ok) ok = await unlockWithRecoveryKey(input);

    if (ok) {
      cleanup();
      showToast('Notes unlocked for this session');
      if (onSuccess) onSuccess();
    } else {
      showToast('Incorrect password or recovery key');
    }
  });
}
```

- [ ] **Step 7: Commit**

```bash
git add frontend/js/eventHandlers.js
git commit -m "feat(handlers): wire encryption settings UI"
```

---

## Task 9: `noteControls.js` — add 🔐 encrypt button

**Files:**
- Modify: `frontend/js/noteControls.js`

- [ ] **Step 1: Add imports**

```js
import {
  hasEncryptionPassword, isUnlocked, encryptNote, decryptAndSaveNote
} from './encryptionManager.js';
import { showToast } from './uiUtils.js';
// NOTE: showUnlockModal is NOT imported statically. eventHandlers.js imports ui.js,
// ui.js dynamically imports noteControls.js — a static import here would create a
// cycle that causes showUnlockModal to be undefined at module init time.
// Use a dynamic import inside the click handler instead (see Step 2).
```

- [ ] **Step 2: Add 🔐 button after the 🔒 lock button**

In `addExpandedNoteControls`, after `controlsContainer.appendChild(lockBtn);`, add:

```js
// Add encrypt button — only visible if user has set an encryption password
if (hasEncryptionPassword()) {
  const isEncrypted = noteElement.dataset.encrypted === 'true';

  const encryptBtn = document.createElement('button');
  encryptBtn.className = `expanded-control-btn${isEncrypted ? ' active' : ''}`;
  encryptBtn.innerHTML = `
    <span>${isEncrypted ? '🔐' : '🔓🔐'}</span>
    <span class="tooltip">${isEncrypted ? 'Decrypt note' : 'Encrypt note'}</span>
  `;

  encryptBtn.addEventListener('click', async () => {
    const nowEncrypted = noteElement.dataset.encrypted !== 'true';

    if (!isUnlocked()) {
      // Dynamic import to avoid static cycle: eventHandlers → ui → (dynamic) noteControls → eventHandlers
      const { showUnlockModal } = await import('./eventHandlers.js');
      showUnlockModal(async () => {
        // retry after unlock
        encryptBtn.click();
      });
      return;
    }

    try {
      const quill = (await import('./quillEditor.js')).getQuillEditor(noteId);
      if (nowEncrypted) {
        const content = quill ? quill.root.innerHTML : '';
        await encryptNote(noteId, content);
        noteElement.dataset.encrypted = 'true';
        noteElement.dataset.readOnly = 'true';
        noteElement.classList.add('note--encrypted', 'note--locked');
        setEditorReadOnly(noteId, true);
        // Update lock button state too
        lockBtn.classList.add('active');
        lockBtn.querySelector('span:first-child').textContent = '🔒';
      } else {
        // dataset.encryptedContent is set by ui.js renderNotes (Task 10).
        // If it's absent (note was just encrypted this session), fall back to
        // quill content, which IS the ciphertext the server just stored.
        const ciphertext = noteElement.dataset.encryptedContent || quill?.root.innerHTML || '';
        if (!ciphertext.startsWith('ENC:')) {
          showToast('No encrypted content found — reload and try again');
          return;
        }
        const plaintext = await decryptAndSaveNote(noteId, ciphertext);
        noteElement.dataset.encrypted = 'false';
        noteElement.dataset.readOnly = 'false';
        noteElement.classList.remove('note--encrypted', 'note--locked');
        if (quill) {
          quill.enable(true);
          quill.clipboard.dangerouslyPasteHTML(plaintext);
        }
        setEditorReadOnly(noteId, false);
        lockBtn.classList.remove('active');
        lockBtn.querySelector('span:first-child').textContent = '🔓';
      }
      encryptBtn.classList.toggle('active', nowEncrypted);
      encryptBtn.querySelector('span:first-child').textContent = nowEncrypted ? '🔐' : '🔓🔐';
      encryptBtn.querySelector('.tooltip').textContent = nowEncrypted ? 'Decrypt note' : 'Encrypt note';
    } catch (err) {
      showToast('Encryption error: ' + err.message);
      console.error(err);
    }
  });

  controlsContainer.appendChild(encryptBtn);
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/js/noteControls.js
git commit -m "feat(controls): add encrypt/decrypt button to expanded note controls"
```

---

## Task 10: `ui.js` — render encrypted notes with placeholder

**Files:**
- Modify: `frontend/js/ui.js`

- [ ] **Step 1: Add imports (use dynamic import to avoid circular dependency)**

**Do NOT add a static import for `encryptionManager.js` at the top of `ui.js`.** There is a circular dependency risk:
`api.js` → (showToast) → `uiUtils.js`, and `encryptionManager.js` → `api.js`. If `ui.js` statically imports `encryptionManager.js`, and `encryptionManager.js`'s module init triggers something that leads back to `ui.js`, the module may not be initialised yet.

Instead, use a **dynamic import inside the `renderNotes` function** (lazy, no static cycle):

```js
// Inside renderNotes, before the encrypted note handling block:
const { hasEncryptionPassword, isUnlocked, decryptNoteContent } =
  await import('./encryptionManager.js');
```

This is already inside an `async` function so `await import(...)` works naturally.

- [ ] **Step 2: Set `data-encrypted` attribute on note element**

After `noteElement.dataset.readOnly = note.read_only ? 'true' : 'false';`, add:

```js
noteElement.dataset.encrypted = note.encrypted ? 'true' : 'false';
```

Add `note--encrypted` class when encrypted:
```js
noteElement.className = 'note'
  + (note.read_only ? ' note--locked' : '')
  + (note.encrypted ? ' note--encrypted' : '');
```

- [ ] **Step 3: Handle encrypted note content**

When building the note placeholder, if the note is encrypted:
- If session is unlocked: decrypt content before passing to Quill
- If session is locked: show placeholder text instead

In the section where `createQuillEditor` is called, change to:

```js
let content = placeholder ? decodeURIComponent(placeholder.dataset.content) : '';

if (noteElement.dataset.encrypted === 'true') {
  if (isUnlocked()) {
    // Decrypt content for display (do not save — it stays encrypted on server)
    const decrypted = await decryptNoteContent(content);
    content = decrypted || '<p><em>Decryption failed</em></p>';
    noteElement.dataset.encryptedContent = placeholder?.dataset.content || '';
  } else {
    // Show locked placeholder
    content = '<p style="opacity:0.4;font-style:italic">🔐 Encrypted — expand and unlock to view</p>';
    noteElement.dataset.encryptedContent = placeholder?.dataset.content || '';
  }
}

createQuillEditor(noteElement, noteId, content);
if (noteElement.dataset.readOnly === 'true') {
  setEditorReadOnly(noteId, true);
}
```

**`renderNotes` async migration — required before this step:**

1. In `ui.js`, add `async` to the `renderNotes` function signature. The existing function reads from state internally — do **not** add a parameter:
   ```js
   export async function renderNotes() {
   ```
2. Search every call site of `renderNotes` across the codebase:
   ```bash
   grep -rn "renderNotes(" frontend/js/
   ```
3. For every call site found, add `await` in front. Known locations to check (but always trust the grep output over this list):
   - `main.js` — add `await` (already in async init)
   - `eventHandlers.js` — add `await` in handlers that call it
   - `api.js` — `loadNotes` is already `async`, add `await` directly
   - `sortNotes.js` — `sortAndRenderNotes` is a plain function; make it `async` first, then add `await renderNotes(...)` inside
   - category-related handlers in `noteCategoryManager.js` if present
   Example change (`renderNotes` takes no arguments — it reads from state):
   ```js
   // Before:
   renderNotes();
   // After:
   await renderNotes();
   ```
4. For `sortNotes.js`, also update any call sites of `sortAndRenderNotes` to `await` it (run the same grep for that function name).
5. If a call site is inside a `.then()` callback or a non-async arrow function, convert that function to `async` rather than dropping the returned Promise silently.
6. Run the app and verify the notes list renders correctly after making these changes.

- [ ] **Step 4: Add lock badge for encrypted notes**

In the note HTML template, update the badge line:

```js
${note.read_only && !note.encrypted ? '<div class="note-lock-badge" title="Read-only">🔒</div>' : ''}
${note.encrypted ? '<div class="note-lock-badge" title="Encrypted">🔐</div>' : ''}
```

- [ ] **Step 5: Commit**

```bash
git add frontend/js/ui.js
git commit -m "feat(ui): render encrypted notes with placeholder and decryption support"
```

---

## Task 11: CSS — encrypted note styling

**Files:**
- Modify: `frontend/css/notes.css`

- [ ] **Step 1: Add encrypted note styles**

Append to `frontend/css/notes.css`:

```css
/* ── Encrypted notes ──────────────────────────────────────── */

.note--encrypted {
  border: 2px solid rgba(98, 0, 238, 0.6) !important;
}

body.dark-mode .note--encrypted {
  border-color: rgba(187, 134, 252, 0.65) !important;
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/css/notes.css
git commit -m "feat(css): add encrypted note border style"
```

---

## Task 12: `main.js` — call `loadEncryptionSetup` on startup

**Files:**
- Modify: `frontend/js/main.js`

The app needs to know whether the user has set an encryption password before rendering notes (so noteControls knows whether to show 🔐) and before rendering Settings.

- [ ] **Step 1: Add import and call**

```js
import { loadEncryptionSetup } from './encryptionManager.js';
```

In the main init function (after user is authenticated, before `loadNotes()`):

```js
await loadEncryptionSetup();
```

- [ ] **Step 2: Commit**

```bash
git add frontend/js/main.js
git commit -m "feat(main): load encryption setup on startup"
```

---

## Manual Test Checklist

After all tasks complete, verify:

- [ ] No encryption password set → Settings shows "Set Encryption Password", 🔐 button absent in expanded controls
- [ ] Set encryption password → recovery key modal appears → "I've saved it" closes it
- [ ] 🔐 button appears in expanded controls
- [ ] Encrypt a note → content replaced with `ENC:v1:...` in DB, border changes, card shows 🔐 badge
- [ ] Refresh page → encrypted note shows placeholder text
- [ ] Expand encrypted note → unlock modal appears → enter correct password → note decrypts and displays
- [ ] Wrong password → "Incorrect password or recovery key" toast
- [ ] Recovery key works in unlock modal
- [ ] Decrypt note → content restored, badge gone, DB content is plaintext
- [ ] Remove encryption password → all encrypted notes decrypted first, setting hidden
- [ ] Encrypted note cannot be edited or deleted while locked
