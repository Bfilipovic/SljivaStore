// backend/utils/transactionTypes.js
/**
 * Canonical Transaction Types
 * 
 * All state-changing actions in the system are represented as transactions.
 * Each transaction type has specific semantics and required fields.
 * 
 * IMPORTANT: Do not introduce:
 * - Generic TRANSFER transactions
 * - ADMIN_ADJUST or similar admin-only transactions
 */

/**
 * @typedef {"MINT" | "LISTING_CREATE" | "LISTING_CANCEL" | "NFT_BUY" | "GIFT_CREATE" | "GIFT_CLAIM" | "GIFT_REFUSE" | "GIFT_CANCEL" | "UPLOAD"} TransactionType
 */

/**
 * Transaction type constants
 */
export const TX_TYPES = {
  MINT: "MINT",
  LISTING_CREATE: "LISTING_CREATE",
  LISTING_CANCEL: "LISTING_CANCEL",
  NFT_BUY: "NFT_BUY",
  GIFT_CREATE: "GIFT_CREATE",
  GIFT_CLAIM: "GIFT_CLAIM",
  GIFT_REFUSE: "GIFT_REFUSE",
  GIFT_CANCEL: "GIFT_CANCEL",
  UPLOAD: "UPLOAD",
};

/**
 * All valid transaction types as an array
 */
export const VALID_TX_TYPES = Object.values(TX_TYPES);

/**
 * Check if a string is a valid transaction type
 * @param {string} type
 * @returns {boolean}
 */
export function isValidTransactionType(type) {
  return VALID_TX_TYPES.includes(type);
}

/**
 * Get the expected signer role for a transaction type
 * @param {TransactionType} type
 * @returns {"seller" | "buyer" | "giver" | "recipient" | "minter"}
 */
export function getExpectedSignerRole(type) {
  switch (type) {
    case TX_TYPES.MINT:
      return "minter";
    case TX_TYPES.LISTING_CREATE:
    case TX_TYPES.LISTING_CANCEL:
      return "seller";
    case TX_TYPES.NFT_BUY:
      return "buyer";
    case TX_TYPES.GIFT_CREATE:
    case TX_TYPES.GIFT_CANCEL:
      return "giver";
    case TX_TYPES.GIFT_CLAIM:
    case TX_TYPES.GIFT_REFUSE:
      return "recipient";
    default:
      throw new Error(`Unknown transaction type: ${type}`);
  }
}

