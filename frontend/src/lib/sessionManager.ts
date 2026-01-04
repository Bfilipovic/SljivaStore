/**
 * Session Manager
 * 
 * Handles encrypted session storage of mnemonic using Web Crypto API.
 * Session persists across page refreshes but is cleared on tab close.
 * 
 * Security:
 * - Mnemonic is encrypted using AES-GCM with a user-provided session password
 * - Session password is never stored, only used for encryption/decryption
 * - Encrypted data stored in sessionStorage (cleared on tab close)
 * - Session does not expire (non-expiring password)
 */

import { browser } from "$app/environment";

const SESSION_STORAGE_KEY = "encrypted_mnemonic";
const SESSION_TIMESTAMP_KEY = "session_timestamp";
const LAST_ACTIVITY_KEY = "last_activity";

interface SessionData {
  encryptedData: string;
  iv: string;
  salt: string;
}

/**
 * Derive a key from the session password using PBKDF2
 */
async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passwordKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits", "deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    passwordKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * Encrypt mnemonic with session password
 */
export async function encryptMnemonic(
  mnemonic: string,
  sessionPassword: string
): Promise<void> {
  if (!browser) return;

  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(mnemonic);

    // Generate random salt and IV
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));

    // Derive key from password
    const key = await deriveKey(sessionPassword, salt);

    // Encrypt
    const encrypted = await crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv: iv,
      },
      key,
      data
    );

    // Store encrypted data, IV, and salt
    const sessionData: SessionData = {
      encryptedData: Array.from(new Uint8Array(encrypted))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join(""),
      iv: Array.from(iv)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join(""),
      salt: Array.from(salt)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join(""),
    };

    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessionData));
    sessionStorage.setItem(SESSION_TIMESTAMP_KEY, Date.now().toString());
    sessionStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());
  } catch (error) {
    console.error("Failed to encrypt mnemonic:", error);
    throw new Error("Failed to encrypt mnemonic");
  }
}

/**
 * Decrypt mnemonic with session password
 */
export async function decryptMnemonic(
  sessionPassword: string
): Promise<string> {
  if (!browser) {
    throw new Error("Session manager only works in browser");
  }

  // Check if session exists
  if (!hasActiveSession()) {
    throw new Error("No active session");
  }

  try {
    const sessionDataStr = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!sessionDataStr) {
      throw new Error("No encrypted data found");
    }

    const sessionData: SessionData = JSON.parse(sessionDataStr);

    // Convert hex strings back to Uint8Array
    const encryptedData = new Uint8Array(
      sessionData.encryptedData.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16))
    );
    const iv = new Uint8Array(
      sessionData.iv.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16))
    );
    const salt = new Uint8Array(
      sessionData.salt.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16))
    );

    // Derive key from password
    const key = await deriveKey(sessionPassword, salt);

    // Decrypt
    const decrypted = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: iv,
      },
      key,
      encryptedData
    );

    // Update last activity
    sessionStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());

    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  } catch (error) {
    console.error("Failed to decrypt mnemonic:", error);
    throw new Error("Invalid session password or corrupted session data");
  }
}

/**
 * Check if there's an active session
 * Session does not expire - only cleared on tab close or explicit logout
 */
export function hasActiveSession(): boolean {
  if (!browser) return false;

  const sessionData = sessionStorage.getItem(SESSION_STORAGE_KEY);

  if (!sessionData) {
    return false;
  }

  return true;
}

/**
 * Clear the session
 */
export function clearSession(): void {
  if (!browser) return;

  sessionStorage.removeItem(SESSION_STORAGE_KEY);
  sessionStorage.removeItem(SESSION_TIMESTAMP_KEY);
  sessionStorage.removeItem(LAST_ACTIVITY_KEY);
}

/**
 * Update last activity timestamp (kept for compatibility but not used for expiry)
 */
export function updateActivity(): void {
  if (!browser) return;

  if (hasActiveSession()) {
    sessionStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());
  }
}

/**
 * Get remaining session time in milliseconds
 * Returns a very large number since sessions don't expire
 */
export function getRemainingSessionTime(): number {
  if (!browser || !hasActiveSession()) return 0;
  return Number.MAX_SAFE_INTEGER; // Sessions don't expire
}

