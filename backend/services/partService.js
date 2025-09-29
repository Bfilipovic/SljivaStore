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
  return db.collection("parts").findOne({ _id: String(partId) });
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
