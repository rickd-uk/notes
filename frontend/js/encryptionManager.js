// encryptionManager.js - Session key management and encryption flows

import {
  generateSalt, generateRecoveryKey, deriveKey, deriveKeyFromRecoveryKey,
  encryptText, decryptText, createVerifier, verifyKey, exportKey, importKey
} from './crypto.js';
import {
  getEncryptionSetup, saveEncryptionPassword, removeEncryptionPasswordApi,
  setNoteEncryptedContent, setNoteReadOnly
} from './api.js';
import { getNotes } from './state.js';

// In-memory session key — never persisted to disk, cleared on tab close
let _sessionKey = null;
let _encryptionSetup = null; // { has_encryption_password, encryption_salt, encryption_verifier }

const SESSION_KEY_STORAGE = 'enc_session_key';

// ── Session persistence (survives page refresh, not tab close) ────────────────

async function persistSessionKey(key) {
  try {
    sessionStorage.setItem(SESSION_KEY_STORAGE, await exportKey(key));
  } catch { /* ignore — non-fatal */ }
}

function clearPersistedSessionKey() {
  sessionStorage.removeItem(SESSION_KEY_STORAGE);
}

// Restore session key from sessionStorage and verify it still matches the server verifier.
// If the verifier check fails (e.g. password was changed elsewhere), the key is discarded.
export async function restoreSessionKey() {
  try {
    const stored = sessionStorage.getItem(SESSION_KEY_STORAGE);
    if (!stored) return;
    const key = await importKey(stored);
    // Always verify against the current server verifier before trusting
    const setup = await getEncryptionSetup();
    if (setup?.encryption_verifier) {
      const ok = await verifyKey(key, setup.encryption_verifier);
      if (ok) {
        _sessionKey = key;
      } else {
        // Key is stale — password was likely changed on another session
        clearPersistedSessionKey();
      }
    } else {
      // No verifier stored yet; trust the key as-is
      _sessionKey = key;
    }
  } catch {
    clearPersistedSessionKey();
  }
}

// ── Setup ────────────────────────────────────────────────────────────────────

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

// Feature-level toggle — off by default for new users
export function isEncryptionFeatureEnabled() {
  return localStorage.getItem('encryptionFeatureEnabled') === 'true';
}

export function setEncryptionFeatureEnabled(enabled) {
  localStorage.setItem('encryptionFeatureEnabled', enabled ? 'true' : 'false');
}

// Controls-on-notes toggle — only relevant when feature is on and password is set
export function isEncryptionUiEnabled() {
  if (!isEncryptionFeatureEnabled()) return false;
  if (!hasEncryptionPassword()) return false;
  return localStorage.getItem('encryptionUiEnabled') !== 'false';
}

export function setEncryptionUiEnabled(enabled) {
  localStorage.setItem('encryptionUiEnabled', enabled ? 'true' : 'false');
}

// ── Unlock ───────────────────────────────────────────────────────────────────

export async function unlockWithPassword(password) {
  if (!_encryptionSetup?.encryption_salt) return false;
  const setup = await getEncryptionSetup(); // fresh verifier
  const key = await deriveKey(password, setup.encryption_salt);
  const ok = await verifyKey(key, setup.encryption_verifier);
  if (ok) { _sessionKey = key; await persistSessionKey(key); }
  return ok;
}

export async function unlockWithRecoveryKey(recoveryKey) {
  if (!_encryptionSetup?.encryption_salt) return false;
  const setup = await getEncryptionSetup();
  const key = await deriveKeyFromRecoveryKey(recoveryKey, setup.encryption_salt);
  const ok = await verifyKey(key, setup.encryption_recovery_verifier);
  if (ok) { _sessionKey = key; await persistSessionKey(key); }
  return ok;
}

export function lockSession() {
  _sessionKey = null;
  clearPersistedSessionKey();
}

// ── Set / remove password ────────────────────────────────────────────────────

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
  await persistSessionKey(mainKey);
  _encryptionSetup = { has_encryption_password: true, encryption_salt: salt };

  return recoveryKey;
}

export async function removeEncryptionPassword() {
  if (!_sessionKey) throw new Error('Session not unlocked');

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
  clearPersistedSessionKey();
  _encryptionSetup = { has_encryption_password: false, encryption_salt: null };
}

// Remove encryption password when the user has forgotten it.
// All encrypted notes are deleted (cannot be decrypted without the key).
export async function removeEncryptionPasswordForgotten() {
  const { deleteNote } = await import('./api.js');
  const notes = getNotes();
  const encryptedNotes = notes.filter(n => n.encrypted);

  for (const note of encryptedNotes) {
    await deleteNote(note.id);
  }

  await removeEncryptionPasswordApi();
  _sessionKey = null;
  clearPersistedSessionKey();
  _encryptionSetup = { has_encryption_password: false, encryption_salt: null };
}

// ── Per-note encrypt / decrypt ───────────────────────────────────────────────

// Encrypt a note and immediately verify the result is decryptable.
// Throws if the round-trip check fails so the caller can surface the error.
export async function encryptNote(noteId, plainContent) {
  if (!_sessionKey) throw new Error('Session not unlocked');
  const ciphertext = await encryptText(_sessionKey, plainContent);

  // Verify we can decrypt before committing to the DB
  const check = await decryptText(_sessionKey, ciphertext);
  if (check === null) throw new Error('Encryption verification failed — note was not saved');

  await setNoteEncryptedContent(noteId, ciphertext, true);
  await setNoteReadOnly(noteId, true);
  return ciphertext;
}

// Decrypt for display only — does not save
export async function decryptNoteContent(encryptedContent) {
  if (!_sessionKey) return null;
  return decryptText(_sessionKey, encryptedContent);
}

// Decrypt and save back as plaintext
export async function decryptAndSaveNote(noteId, encryptedContent) {
  if (!_sessionKey) throw new Error('Session not unlocked');
  const plaintext = await decryptText(_sessionKey, encryptedContent);
  if (plaintext === null) throw new Error('Decryption failed — the key may have changed');
  await setNoteEncryptedContent(noteId, plaintext, false);
  await setNoteReadOnly(noteId, false);
  return plaintext;
}
