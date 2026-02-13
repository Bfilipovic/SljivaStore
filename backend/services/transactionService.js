// backend/services/transactionService.js
/**
 * Service: Transaction handling (refactored but keeps partial transactions)
 *
 * Exports:
 * - createTransaction(data, verifiedAddress, signature): Promise<string>  // returns txId
 *   Signed body:
 *     {
 *       listingId: string,
 *       reservationId: string,
 *       buyer: string,          // ETH address (canonical identity)
 *       chainTx: string,        // blockchain transaction hash/id
 *       timestamp?: number
 *     }
 *
 * Notes:
 * - Buyer must match signature.
 * - Reservation must exist and belong to buyer.
 * - Listing + NFT existence checks.
 * - Validates listing has not been cancelled or deleted.
 * - Creates NFT_BUY transaction with signature.
 * - Creates N partialtransactions (one per reserved part).
 * - Bulk updates parts to new owner and clears listing/reservation pointers.
 */

import { ObjectId } from "mongodb";
import connectDB from "../db.js";
import { hashObject, hashableTransaction } from "../utils/hash.js";
import { getNextTransactionInfo, uploadTransactionToArweave } from "./arweaveService.js";
import { logInfo } from "../utils/logger.js";
import { TX_TYPES } from "../utils/transactionTypes.js";
import { createTransactionDoc } from "../utils/transactionBuilder.js";
import { createPartialTransactionDocs } from "../utils/partialTransactionBuilder.js";
import { verifyChainTransaction } from "../utils/verifyChainTransaction.js";
import { LISTING_STATUS } from "../utils/statusConstants.js";
import { normalizeAddress, addressesMatch } from "../utils/addressUtils.js";

export async function createTransaction(data, verifiedAddress, signature) {
  const { listingId, reservationId, buyer, chainTx, timestamp } = data;

  if (!listingId || !reservationId || !buyer || !chainTx) {
    throw new Error("Missing required fields");
  }
  if (!addressesMatch(verifiedAddress, buyer)) {
    throw new Error("Buyer address mismatch");
  }

  const db = await connectDB();
  const reservationsCol = db.collection("reservations");
  const listingsCol = db.collection("listings");
  const nftsCol = db.collection("nfts");
  const txCollection = db.collection("transactions");
  const ptxCollection = db.collection("partialtransactions");
  const partsCollection = db.collection("parts");

  // Validate reservation
  const reservation = await reservationsCol.findOne({
    _id: new ObjectId(String(reservationId)),
  });
  if (!reservation) throw new Error("Reservation not found");
  if (!addressesMatch(reservation.reserver, buyer)) {
    throw new Error("Reserver does not match buyer");
  }

  // Validate listing
  const listing = await listingsCol.findOne({
    _id: new ObjectId(String(listingId)),
  });
  if (!listing) throw new Error("Listing not found");
  
  // Check if listing has been cancelled
  const cancelTx = await txCollection.findOne({
    type: TX_TYPES.LISTING_CANCEL,
    listingId: listingId.toString(),
  });
  if (cancelTx) {
    throw new Error("Cannot buy from a cancelled listing");
  }
  
  // Check if listing is still active
  if (listing.status === LISTING_STATUS.CANCELED) {
    throw new Error("Listing has been canceled");
  }
  if (listing.status === LISTING_STATUS.COMPLETED) {
    throw new Error("Listing has been completed");
  }

  // Validate NFT
  const nft = await nftsCol.findOne({ _id: listing.nftId });
  if (!nft) throw new Error("NFT not found");

  const qty = reservation.quantity;
  if (!Number.isFinite(qty) || qty < 1) {
    throw new Error("Reservation has no valid quantity");
  }
  if (!reservation.totalPriceCrypto) {
    throw new Error("Reservation missing totalPriceCrypto");
  }

  // Verify chain transaction amount BEFORE creating the transaction record
  // This prevents users from paying less than expected
  const currency = String(reservation.totalPriceCrypto.currency).toUpperCase();
  const expectedAmount = String(reservation.totalPriceCrypto.amount);
  const sellerWallet = reservation.sellerWallet;
  
  if (!sellerWallet) {
    throw new Error("Reservation missing sellerWallet - cannot verify chain transaction");
  }

  try {
    logInfo(`[createTransaction] Verifying chain transaction ${chainTx} for ${expectedAmount} ${currency} to ${sellerWallet} from ${buyer}`);
    const verificationResult = await verifyChainTransaction(
      chainTx,
      expectedAmount,
      currency,
      sellerWallet,
      buyer // Verify transaction was sent from the buyer
    );
    logInfo(`[createTransaction] Chain transaction verified: ${JSON.stringify(verificationResult)}`);
  } catch (verificationError) {
    // If verification fails, reject the transaction
    logInfo(`[createTransaction] Chain transaction verification failed: ${verificationError.message}`);
    throw new Error(`Chain transaction verification failed: ${verificationError.message}`);
  }

  // Get next transaction number and previous Arweave transaction ID
  const { transactionNumber, previousArweaveTxId } = await getNextTransactionInfo();

  // Build transaction doc (without _id first)
  const txDoc = createTransactionDoc({
    type: TX_TYPES.NFT_BUY,
    transaction_number: transactionNumber,
    signer: verifiedAddress,
    signature: signature,
    timestamp: timestamp ? new Date(timestamp) : new Date(),
    overrides: {
      listingId: listing._id.toString(),
      reservationId: reservation._id.toString(),
      nftId: String(listing.nftId),
      buyer: buyer,
      seller: listing.seller,
      quantity: qty,
      chainTx: String(chainTx),
      currency: String(reservation.totalPriceCrypto.currency).toUpperCase(),
      amount: String(reservation.totalPriceCrypto.amount),
    },
  });

  // Generate hash-based ID (includes transaction_number)
  const insertedTxId = hashObject(hashableTransaction(txDoc));
  txDoc._id = insertedTxId;

  // Insert transaction to database first
  await txCollection.insertOne(txDoc);

  // Upload to Arweave (includes previous_arweave_tx link)
  // Include imageUrl for display in Arweave explorer (not part of hash)
  // NFT was already fetched during validation
  const imageUrl = nft?.imageurl || null;
  let arweaveTxId = null;
  try {
    arweaveTxId = await uploadTransactionToArweave(txDoc, transactionNumber, previousArweaveTxId, imageUrl);
    
    // Update transaction with Arweave ID (this doesn't affect the hash)
    await txCollection.updateOne(
      { _id: insertedTxId },
      { $set: { arweaveTxId: arweaveTxId } }
    );
    
    logInfo(`[createTransaction] Transaction ${insertedTxId} uploaded to Arweave: ${arweaveTxId}`);
  } catch (error) {
    logInfo(`[createTransaction] Warning: Failed to upload to Arweave: ${error.message}`);
    // Continue even if Arweave upload fails - transaction is still valid
  }

  // Find reserved parts
  const reservedParts = await partsCollection
    .find({ reservation: reservation._id.toString() })
    .project({ _id: 1 })
    .toArray();

  if (reservedParts.length !== qty) {
    throw new Error(
      `Mismatch: reservation quantity=${qty} but found ${reservedParts.length} parts`
    );
  }

  // Build partial transactions
  const partials = createPartialTransactionDocs(reservedParts, {
    transaction: insertedTxId,
    from: listing.seller,
    to: buyer,
    nftId: listing.nftId,
    chainTx: String(chainTx),
    currency: String(reservation.totalPriceCrypto.currency).toUpperCase(),
    amount: String(reservation.totalPriceCrypto.amount),
    timestamp: new Date(timestamp || Date.now()),
  });

  if (partials.length) await ptxCollection.insertMany(partials);

  // Transfer ownership of reserved parts in bulk
  await partsCollection.updateMany(
    { reservation: reservation._id.toString() },
    {
      $set: {
        owner: normalizeAddress(buyer),
        listing: null,
      },
      $unset: { reservation: "" }
    }
  );

  // Check if listing should be marked as COMPLETED
  // A listing is COMPLETED when:
  // 1. All parts have been sold (no parts left with listing=listingId)
  // 2. No active reservations exist for this listing
  const remainingPartsCount = await partsCollection.countDocuments({
    listing: listing._id.toString(),
  });
  
  const activeReservationsCount = await reservationsCol.countDocuments({
    listingId: listing._id.toString(),
  });
  
  if (remainingPartsCount === 0 && activeReservationsCount === 0) {
    await listingsCol.updateOne(
      { _id: listing._id },
      { $set: { status: LISTING_STATUS.COMPLETED, time_completed: new Date(), time_updated: new Date() } }
    );
    logInfo(`[createTransaction] Marked listing ${listing._id} as COMPLETED`);
  } else {
    await listingsCol.updateOne(
      { _id: listing._id },
      { $set: { time_updated: new Date() } }
    );
  }

  // Remove reservation
  await reservationsCol.deleteOne({ _id: reservation._id });

  return insertedTxId;
}

/**
 * Get partial transaction history for a part.
 */
async function fetchPartialTransactions(filter, { skip = 0, limit = 50 } = {}) {
  const db = await connectDB();
  const collection = db.collection("partialtransactions");

  const cursor = collection
    .find(filter)
    .sort({ timestamp: -1, _id: -1 })
    .skip(skip)
    .limit(limit);

  const [items, total] = await Promise.all([cursor.toArray(), collection.countDocuments(filter)]);

  return {
    items,
    total
  };
}

export async function getPartialTransactionsByPart(partHash, options = {}) {
  return fetchPartialTransactions({ part: String(partHash) }, options);
}

/**
 * Get a transaction by its database id or string identifier.
 */
export async function getTransactionById(txId) {
  const raw = String(txId || "").trim();
  if (!raw) return null;

  const db = await connectDB();
  const txCollection = db.collection("transactions");

  const orClauses = [{ _id: raw }];
  if (ObjectId.isValid(raw)) {
    orClauses.unshift({ _id: new ObjectId(raw) });
  }

  const transaction = await txCollection.findOne({ $or: orClauses });
  if (!transaction) return null;

  return {
    ...transaction,
    _id: transaction._id?.toString() ?? transaction._id,
  };
}

/**
 * Get a transaction by its on-chain transaction hash.
 * Tries exact match first, then case-insensitive match.
 */
export async function getTransactionByChainTx(chainTx) {
  const raw = String(chainTx || "").trim();
  if (!raw) return null;

  const db = await connectDB();
  const txCollection = db.collection("transactions");

  // Try exact match first
  let transaction = await txCollection.findOne({ chainTx: raw });

  // If not found, try lowercase version (common normalization)
  if (!transaction && raw !== raw.toLowerCase()) {
    transaction = await txCollection.findOne({ chainTx: raw.toLowerCase() });
  }

  // If still not found, try uppercase version
  if (!transaction && raw !== raw.toUpperCase()) {
    transaction = await txCollection.findOne({ chainTx: raw.toUpperCase() });
  }

  // If still not found, try case-insensitive match using regex
  if (!transaction) {
    const caseInsensitiveRegex = new RegExp(`^${raw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, "i");
    transaction = await txCollection.findOne({ chainTx: { $regex: caseInsensitiveRegex } });
  }

  if (!transaction) return null;

  return {
    ...transaction,
    _id: transaction._id?.toString() ?? transaction._id,
  };
}

/**
 * Get partial transactions by parent transaction id.
 */
export async function getPartialTransactionsByTransactionId(txId, options = {}) {
  const raw = String(txId || "").trim();
  if (!raw) return { items: [], total: 0 };

  const normalizedId = ObjectId.isValid(raw) ? new ObjectId(raw).toString() : raw;

  return fetchPartialTransactions(
    {
      $or: [{ transaction: normalizedId }, { txId: normalizedId }] // Check both for backward compatibility
    },
    options
  );
}

/**
 * Get partial transactions by their on-chain hash.
 * Tries case-insensitive matching if exact match fails.
 */
export async function getPartialTransactionsByChainTx(chainTx, options = {}) {
  const raw = String(chainTx || "").trim();
  if (!raw) return { items: [], total: 0 };

  // Try exact match first
  let result = await fetchPartialTransactions({ chainTx: raw }, options);
  
  // If no results and case might differ, try case-insensitive
  if (result.items.length === 0) {
    const caseInsensitiveRegex = new RegExp(`^${raw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, "i");
    result = await fetchPartialTransactions({ chainTx: { $regex: caseInsensitiveRegex } }, options);
  }
  
  return result;
}

/**
 * Get the last transaction (highest transaction_number)
 * @returns {Promise<Object|null>} Last transaction document or null if none exist
 */
export async function getLastTransaction() {
  const db = await connectDB();
  const txCollection = db.collection("transactions");

  // Get transaction with highest transaction_number
  // Ensure transaction_number exists and is a number
  const lastTx = await txCollection.findOne(
    { transaction_number: { $exists: true, $type: "number" } },
    { sort: { transaction_number: -1 } }
  );

  // If no transaction with transaction_number, fall back to timestamp-based lookup
  if (!lastTx) {
    return await txCollection.findOne(
      {},
      { sort: { timestamp: -1 } }
    );
  }

  return lastTx || null;
}

/**
 * Get transaction by Arweave transaction ID
 * @param {string} arweaveTxId - Arweave transaction ID
 * @returns {Promise<Object|null>} Transaction document or null if not found
 */
export async function getTransactionByArweaveTxId(arweaveTxId) {
  if (!arweaveTxId) return null;
  
  const db = await connectDB();
  const txCollection = db.collection("transactions");
  
  return await txCollection.findOne({
    arweaveTxId: String(arweaveTxId).trim()
  });
}

/**
 * Get transactions by user address (buyer or seller)
 * Only returns transactions where ownership changes:
 * - NFT_BUY (buying/selling)
 * - GIFT_CLAIM (receiving/giving gifts)
 * Excludes: MINT, GIFT_CREATE, GIFT_REFUSE, GIFT_CANCEL, LISTING_CREATE, LISTING_CANCEL
 * @param {string} address - User's ETH address
 * @param {Object} options - Pagination options
 * @param {number} options.skip - Number of documents to skip
 * @param {number} options.limit - Maximum number of documents to return
 * @returns {Promise<{items: Array, total: number}>} Transactions and total count
 */
export async function getTransactionsByUser(address, options = {}) {
  const { skip = 0, limit = 50 } = options;
  const normalizedAddress = normalizeAddress(address);
  
  if (!normalizedAddress) {
    return { items: [], total: 0 };
  }

  const db = await connectDB();
  const txCollection = db.collection("transactions");

  // Only show transactions where ownership changes:
  // - NFT_BUY: user is buyer or seller
  // - GIFT_CLAIM: user is receiver (receiving gift) or giver (giving gift)
  const filter = {
    type: { $in: [TX_TYPES.NFT_BUY, TX_TYPES.GIFT_CLAIM] },
    $or: [
      // NFT_BUY transactions
      { buyer: normalizedAddress },
      { seller: normalizedAddress },
      // GIFT_CLAIM transactions (use giver/receiver fields)
      { giver: normalizedAddress },
      { receiver: normalizedAddress }
    ]
  };

  const cursor = txCollection
    .find(filter)
    .sort({ timestamp: -1, _id: -1 })
    .skip(skip)
    .limit(limit);

  const [items, total] = await Promise.all([
    cursor.toArray(),
    txCollection.countDocuments(filter)
  ]);

  // Convert ObjectIds to strings for JSON serialization
  const formattedItems = items.map(tx => ({
    ...tx,
    _id: tx._id?.toString() ?? tx._id,
  }));

  return {
    items: formattedItems,
    total
  };
}
