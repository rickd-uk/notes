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
