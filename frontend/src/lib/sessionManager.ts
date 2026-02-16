/**
 * Session Manager
 * 
 * Handles encrypted storage of mnemonic using Web Crypto API.
 * Encrypted mnemonic persists across tabs and page refreshes.
 * Session passwords are tab-specific and never stored.
 * 
 * Security:
 * - Mnemonic is encrypted using AES-GCM with a user-provided session password
 * - Session password is never stored, only used for encryption/decryption
 * - Encrypted mnemonic stored in localStorage (shared across tabs)
 * - Session password remains tab-specific (sessionStorage)
 * - Session does not expire (non-expiring password)
 */

import { browser } from "$app/environment";

const ENCRYPTED_MNEMONIC_KEY = "encrypted_mnemonic"; // localStorage - shared across tabs
const SESSION_TIMESTAMP_KEY = "session_timestamp"; // sessionStorage - tab-specific
const LAST_ACTIVITY_KEY = "last_activity"; // sessionStorage - tab-specific
const WALLET_SYNC_KEY = "wallet_sync"; // localStorage - for cross-tab sync events

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

  // Ensure salt is a proper Uint8Array with ArrayBuffer by creating a new buffer
  const saltArray = new Uint8Array(salt.length);
  saltArray.set(salt);

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: saltArray,
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

    // Store encrypted mnemonic in localStorage (shared across tabs)
    localStorage.setItem(ENCRYPTED_MNEMONIC_KEY, JSON.stringify(sessionData));
    
    // Store session metadata in sessionStorage (tab-specific)
    sessionStorage.setItem(SESSION_TIMESTAMP_KEY, Date.now().toString());
    sessionStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());
    
    // Trigger storage event for cross-tab sync (by updating a sync key)
    localStorage.setItem(WALLET_SYNC_KEY, Date.now().toString());
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
    const sessionDataStr = localStorage.getItem(ENCRYPTED_MNEMONIC_KEY);
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
 * Checks for encrypted mnemonic in localStorage (shared across tabs)
 * Session does not expire - only cleared on explicit logout
 */
export function hasActiveSession(): boolean {
  if (!browser) return false;

  const sessionData = localStorage.getItem(ENCRYPTED_MNEMONIC_KEY);

  if (!sessionData) {
    return false;
  }

  return true;
}

/**
 * Clear the session
 * Removes encrypted mnemonic from localStorage (affects all tabs)
 * Removes session metadata from sessionStorage (tab-specific)
 */
export function clearSession(): void {
  if (!browser) return;

  // Clear encrypted mnemonic from localStorage (shared across tabs)
  localStorage.removeItem(ENCRYPTED_MNEMONIC_KEY);
  
  // Clear session metadata from sessionStorage (tab-specific)
  sessionStorage.removeItem(SESSION_TIMESTAMP_KEY);
  sessionStorage.removeItem(LAST_ACTIVITY_KEY);
  
  // Trigger storage event for cross-tab sync
  localStorage.setItem(WALLET_SYNC_KEY, Date.now().toString());
  localStorage.removeItem(WALLET_SYNC_KEY);
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

