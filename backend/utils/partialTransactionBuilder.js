/**
 * Centralized partial transaction document builder.
 * 
 * Partial transactions track individual part transfers within a transaction.
 * This ensures all partial transactions have consistent structure.
 * 
 * IMPORTANT: When adding new fields to partial transactions, update:
 * 1. This function (add field to base structure)
 * 2. Run tests to verify consistency
 */

/**
 * Get all field names that should be present in every partial transaction.
 */
export function getRequiredPartialTransactionFields() {
  return [
    'part',
    'transaction',
    'from',
    'to',
    'nftId',
    'chainTx',
    'currency',
    'amount',
    'timestamp',
  ];
}

/**
 * Create a partial transaction document.
 * 
 * Partial transactions track individual part transfers within a transaction.
 * They link parts to transactions and record ownership changes.
 * 
 * @param {Object} params - Partial transaction parameters
 * @param {string|ObjectId} params.part - Part ID
 * @param {string} params.transaction - Transaction ID
 * @param {string} params.from - Sender address (lowercase, or empty string for mint)
 * @param {string} params.to - Receiver address (lowercase)
 * @param {string} params.nftId - NFT ID
 * @param {string|null} [params.chainTx] - Chain transaction hash (optional, defaults to null)
 * @param {string|null} [params.currency] - Currency (optional, defaults to null)
 * @param {string|null} [params.amount] - Amount (optional, defaults to null)
 * @param {Date} [params.timestamp] - Timestamp (defaults to now)
 * @returns {Object} Complete partial transaction document
 */
export function createPartialTransactionDoc({
  part,
  transaction,
  from,
  to,
  nftId,
  chainTx = null,
  currency = null,
  amount = null,
  timestamp = new Date(),
}) {
  if (!part || !transaction || !to || !nftId) {
    throw new Error("Missing required fields: part, transaction, to, nftId");
  }

  // Normalize addresses (from can be empty string for mint)
  const normalizedFrom = from !== null && from !== undefined 
    ? (from === "" ? "" : normalizeAddress(from) || "")
    : "";
  const normalizedTo = normalizeAddress(to) || "";

  // Normalize chainTx - empty strings become null
  const normalizedChainTx = (chainTx && String(chainTx).trim()) || null;
  
  // Normalize currency - empty strings become null
  const normalizedCurrency = (currency && String(currency).trim()) || null;
  
  // Normalize amount - empty strings become null
  const normalizedAmount = (amount && String(amount).trim()) || null;

  return {
    part: String(part),
    transaction: String(transaction),
    from: normalizedFrom,
    to: normalizedTo,
    nftId: String(nftId),
    chainTx: normalizedChainTx,
    currency: normalizedCurrency,
    amount: normalizedAmount,
    timestamp: timestamp instanceof Date ? timestamp : new Date(timestamp || Date.now()),
  };
}

/**
 * Create multiple partial transaction documents from an array of parts.
 * Useful for bulk operations like minting or buying multiple parts.
 * 
 * @param {Array<Object>} parts - Array of part objects with _id property
 * @param {Object} commonParams - Common parameters for all partial transactions
 * @param {string} commonParams.transaction - Transaction ID
 * @param {string} commonParams.from - Sender address
 * @param {string} commonParams.to - Receiver address
 * @param {string} commonParams.nftId - NFT ID
 * @param {string|null} [commonParams.chainTx] - Chain transaction hash
 * @param {string|null} [commonParams.currency] - Currency
 * @param {string|null} [commonParams.amount] - Amount
 * @param {Date} [commonParams.timestamp] - Timestamp
 * @returns {Array<Object>} Array of partial transaction documents
 */
export function createPartialTransactionDocs(parts, commonParams) {
  if (!Array.isArray(parts) || parts.length === 0) {
    return [];
  }

  return parts.map((part) => 
    createPartialTransactionDoc({
      ...commonParams,
      part: part._id || part,
    })
  );
}

