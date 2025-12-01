// backend/services/transactionService.js
/**
 * Service: Transaction handling (refactored but keeps partial transactions)
 *
 * Exports:
 * - createTransaction(data, verifiedAddress): Promise<string>  // returns txId
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
 * - Creates one transaction doc (with quantity).
 * - Creates N partialtransactions (one per reserved part).
 * - Bulk updates parts to new owner and clears listing/reservation pointers.
 */

import { ObjectId } from "mongodb";
import connectDB from "../db.js";

export async function createTransaction(data, verifiedAddress) {
  const { listingId, reservationId, buyer, chainTx, timestamp } = data;

  if (!listingId || !reservationId || !buyer || !chainTx) {
    throw new Error("Missing required fields");
  }
  if (String(verifiedAddress).toLowerCase() !== String(buyer).toLowerCase()) {
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
  if (reservation.reserver !== String(buyer).toLowerCase()) {
    throw new Error("Reserver does not match buyer");
  }

  // Validate listing
  const listing = await listingsCol.findOne({
    _id: new ObjectId(String(listingId)),
  });
  if (!listing) throw new Error("Listing not found");

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

  // Build transaction doc
  const insertedTxId = new ObjectId();
  const txDoc = {
    _id: insertedTxId,
    type: "TRANSACTION",
    listingId: listing._id.toString(),
    reservationId: reservation._id.toString(),
    buyer: String(buyer).toLowerCase(),
    seller: String(listing.seller).toLowerCase(),
    nftId: listing.nftId,
    quantity: qty,
    chainTx: String(chainTx),
    currency: String(reservation.totalPriceCrypto.currency).toUpperCase(),
    amount: String(reservation.totalPriceCrypto.amount),
    timestamp: new Date(timestamp || Date.now()),
  };

  await txCollection.insertOne(txDoc);

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
  const partials = reservedParts.map((p) => ({
    part: p._id,
    txId: insertedTxId.toString(),
    from: String(listing.seller).toLowerCase(),
    to: String(buyer).toLowerCase(),
    nftId: listing.nftId,
    transaction: insertedTxId.toString(),
    chainTx: String(chainTx),
    currency: String(reservation.totalPriceCrypto.currency).toUpperCase(),
    amount: String(reservation.totalPriceCrypto.amount),
    timestamp: new Date(timestamp || Date.now()),
  }));

  if (partials.length) await ptxCollection.insertMany(partials);

  // Transfer ownership of reserved parts in bulk
  await partsCollection.updateMany(
    { reservation: reservation._id.toString() },
    {
      $set: {
        owner: String(buyer).toLowerCase(),
        listing: null,
      },
      $unset: { reservation: "" }
    }
  );

  // Optionally mark listing state (just update timestamp)
  await listingsCol.updateOne(
    { _id: listing._id },
    { $set: { time_updated: new Date() } }
  );

  // Remove reservation
  await reservationsCol.deleteOne({ _id: reservation._id });

  return insertedTxId.toString();
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
      $or: [{ transaction: normalizedId }, { txId: normalizedId }]
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
