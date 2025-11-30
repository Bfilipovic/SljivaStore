// backend/services/partService.js
/**
 * Service: Part queries (refactored with pagination)
 *
 * Exports:
 * - getPartById(partId: string): Promise<Part|null>
 * - getPartsByOwner(owner: string, { skip, limit }): Promise<Part[]>
 * - countPartsByOwner(owner: string): Promise<number>
 *
 * Notes:
 * - Pagination added to avoid loading thousands/millions of docs at once.
 * - All addresses are normalized to lowercase.
 */

import connectDB from "../db.js";

export async function getPartById(partId) {
  const db = await connectDB();
  const collection = db.collection("parts");
  const raw = String(partId || "").trim();
  if (!raw) return null;

  // Try exact match first
  let part = await collection.findOne({ _id: raw });

  // If not found, try lowercase version (common normalization for hex strings)
  if (!part && raw !== raw.toLowerCase()) {
    part = await collection.findOne({ _id: raw.toLowerCase() });
  }

  // If still not found, try uppercase version
  if (!part && raw !== raw.toUpperCase()) {
    part = await collection.findOne({ _id: raw.toUpperCase() });
  }

  // If still not found, try case-insensitive match using regex
  if (!part) {
    const caseInsensitiveRegex = new RegExp(`^${raw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, "i");
    part = await collection.findOne({ _id: { $regex: caseInsensitiveRegex } });
  }

  return part;
}

export async function getPartsByOwner(owner, { skip = 0, limit = 100 } = {}) {
  const db = await connectDB();
  return db
    .collection("parts")
    .find({ owner: owner.toLowerCase() })
    .skip(skip)
    .limit(limit)
    .toArray();
}

export async function countPartsByOwner(owner) {
  const db = await connectDB();
  return db
    .collection("parts")
    .countDocuments({ owner: owner.toLowerCase() });
}

/**
 * Get parts by listingId with pagination
 */
export async function getPartsByListing(listingId, { skip = 0, limit = 100 } = {}) {
  const db = await connectDB();
  return db.collection("parts")
    .find({ listing: String(listingId) })
    .skip(skip)
    .limit(limit)
    .toArray();
}

/**
 * Count parts by listingId
 */
export async function countPartsByListing(listingId) {
  const db = await connectDB();
  return db.collection("parts").countDocuments({ listing: String(listingId) });
}

/**
 * Get parts by owner and NFT with pagination
 */
export async function getPartsByOwnerAndNFT(owner, nftId, { skip = 0, limit = 100 } = {}) {
  const db = await connectDB();
  return db
    .collection("parts")
    .find({ 
      owner: owner.toLowerCase(),
      parent_hash: String(nftId)
    })
    .skip(skip)
    .limit(limit)
    .toArray();
}

/**
 * Count parts by owner and NFT
 */
export async function countPartsByOwnerAndNFT(owner, nftId) {
  const db = await connectDB();
  return db
    .collection("parts")
    .countDocuments({ 
      owner: owner.toLowerCase(),
      parent_hash: String(nftId)
    });
}

/**
 * Get parts by transaction ID using partialtransactions.
 * Returns parts that were involved in the transaction.
 */
export async function getPartsByTransactionId(txId, { skip = 0, limit = 100 } = {}) {
  const db = await connectDB();
  const raw = String(txId || "").trim();
  if (!raw) return { parts: [], total: 0 };

  const { ObjectId } = await import("mongodb");
  const normalizedId = ObjectId.isValid(raw) ? new ObjectId(raw).toString() : raw;

  // Get part IDs from partialtransactions
  const partialTransactions = await db
    .collection("partialtransactions")
    .find({
      $or: [{ transaction: normalizedId }, { txId: normalizedId }]
    })
    .project({ part: 1 })
    .toArray();

  const partIds = [...new Set(partialTransactions.map(pt => pt.part).filter(Boolean))];
  
  if (partIds.length === 0) {
    return { parts: [], total: 0 };
  }

  // Get parts
  const parts = await db
    .collection("parts")
    .find({ _id: { $in: partIds } })
    .sort({ part_no: 1 })
    .skip(skip)
    .limit(limit)
    .toArray();

  return {
    parts,
    total: partIds.length
  };
}
