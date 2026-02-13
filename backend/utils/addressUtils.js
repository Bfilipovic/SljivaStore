// backend/utils/addressUtils.js
/**
 * Address Utilities
 * 
 * Centralized address normalization and validation functions.
 * 
 * IMPORTANT: When updating address normalization logic, update both:
 * - backend/utils/addressUtils.js
 * - frontend/src/lib/utils/addressUtils.ts
 * 
 * These must stay in sync!
 */

/**
 * Normalize an Ethereum address to lowercase
 * 
 * @param {string|null|undefined} address - The address to normalize
 * @returns {string|null} - Normalized lowercase address, or null if invalid
 */
export function normalizeAddress(address) {
  if (!address) {
    return null;
  }
  
  // Convert to string and trim whitespace
  const addr = String(address).trim();
  
  // Basic validation: Ethereum addresses are 42 characters (0x + 40 hex chars)
  // Allow empty string for special cases (e.g., mint transactions)
  if (addr === "") {
    return "";
  }
  
  // Validate format: must start with 0x and be hex
  if (!/^0x[a-fA-F0-9]{40}$/.test(addr)) {
    // Not a valid Ethereum address format
    // Return null to indicate invalid address
    return null;
  }
  
  // Normalize to lowercase
  return addr.toLowerCase();
}

/**
 * Validate if an address is a valid Ethereum address format
 * 
 * @param {string|null|undefined} address - The address to validate
 * @returns {boolean} - True if valid format, false otherwise
 */
export function isValidAddressFormat(address) {
  if (!address) {
    return false;
  }
  
  const addr = String(address).trim();
  
  // Empty string is valid for special cases (mint)
  if (addr === "") {
    return true;
  }
  
  // Must be 42 characters: 0x + 40 hex characters
  return /^0x[a-fA-F0-9]{40}$/.test(addr);
}

/**
 * Compare two addresses (case-insensitive)
 * 
 * @param {string|null|undefined} addr1 - First address
 * @param {string|null|undefined} addr2 - Second address
 * @returns {boolean} - True if addresses match (case-insensitive)
 */
export function addressesMatch(addr1, addr2) {
  const normalized1 = normalizeAddress(addr1);
  const normalized2 = normalizeAddress(addr2);
  
  // Both must be valid (or both null/empty)
  if (normalized1 === null || normalized2 === null) {
    return normalized1 === normalized2;
  }
  
  return normalized1 === normalized2;
}

