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
