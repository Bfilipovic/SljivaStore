// backend/services/nftService.js
/**
 * Service: NFT CRUD + Minting + Aggregates
 *
 * Exports:
 * - getAllNFTs(): Promise<NFT[]>
 * - getNFTsByCreator(address: string): Promise<NFT[]>
 * - getNFTById(id: string): Promise<NFT|null>
 * - getPartsByNFT(nftId: string, { skip, limit }): Promise<Part[]>
 * - mintNFT(verifiedData, verifiedAddress): Promise<{ nftId: string }>
 * - getNFTsByOwner(address: string): Promise<OwnedNFTSummary[]>
 *
 * Notes:
 * - getPartsByNFT now supports pagination.
 * - getNFTsByOwner aggregates ownership counts (owned + available).
 */

import crypto from "crypto";
import { ObjectId } from "mongodb";
import connectDB from "../db.js";
import { hashObject } from "../utils/hash.js";
import { logInfo } from "../utils/logger.js";
import { isAdmin } from "./adminService.js";

// --- Basic fetchers ---

export async function getAllNFTs() {
  const db = await connectDB();
  return db.collection("nfts").find({}).toArray();
}

export async function getNFTsByCreator(address) {
  const db = await connectDB();
  return db.collection("nfts").find({ creator: address.toLowerCase() }).toArray();
}

export async function getNFTById(id) {
  const db = await connectDB();
  return db.collection("nfts").findOne({ _id: id });
}

// --- Parts with pagination ---
export async function getPartsByNFT(nftId, { skip = 0, limit = 100 } = {}) {
  const db = await connectDB();
  return db
    .collection("parts")
    .find({ parent_hash: nftId })
    .skip(skip)
    .limit(limit)
    .toArray();
}

// --- Minting ---
export async function mintNFT(verifiedData, verifiedAddress) {
  const { name, description, parts, imageUrl, creator } = verifiedData;

  if (!name || !description || !parts || !imageUrl || !creator) {
    throw new Error("Missing required fields");
  }
  if (String(creator).toLowerCase() !== String(verifiedAddress).toLowerCase()) {
    throw new Error("Creator address mismatch");
  }
  if (!(await isAdmin(creator))) {
    throw new Error("Only admins can mint NFTs");
  }

  const db = await connectDB();
  const nftsCol = db.collection("nfts");
  const partsCol = db.collection("parts");

  const creatorLower = String(creator).toLowerCase();
  const imagehash = crypto.createHash("sha256").update(String(imageUrl)).digest("hex");
  const partCount = parseInt(parts, 10);
  if (!Number.isFinite(partCount) || partCount < 1) {
    throw new Error("Invalid parts count");
  }

  const nftObj = {
    _id: undefined, // filled after hashing so _id is stable
    name: String(name),
    description: String(description),
    creator: creatorLower,
    imageurl: String(imageUrl),
    imagehash,
    time_created: new Date(),
    part_count: partCount,
    status: "ACTIVE",
  };

  const nftId = hashObject(nftObj);
  nftObj._id = nftId;

  // Insert NFT first
  await nftsCol.insertOne(nftObj);

  // Batched parts insert
  const BATCH_SIZE = 5000;
  let inserted = 0;
  for (let start = 1; start <= partCount; start += BATCH_SIZE) {
    const end = Math.min(start + BATCH_SIZE - 1, partCount);
    const batch = [];
    for (let i = start; i <= end; i++) {
      const partDoc = {
        part_no: i,
        parent_hash: nftId,
        owner: creatorLower,
        listing: null,
      };
      batch.push({
        _id: hashObject(partDoc),
        ...partDoc,
      });
    }
    await partsCol.insertMany(batch, { ordered: false });
    inserted += batch.length;
    logInfo(`[mintNFT] Inserted ${inserted}/${partCount} parts for ${nftId}`);
  }

  logInfo(`[mintNFT] Completed mint for NFT ${nftId} (${partCount} parts)`);
  return { nftId };
}

// --- Aggregation: NFTs owned by address ---
export async function getNFTsByOwner(address) {
  const db = await connectDB();
  const addr = address.toLowerCase();

  // Aggregate counts of owned parts by nft
  const owned = await db.collection("parts").aggregate([
    { $match: { owner: addr } },
    {
      $group: {
        _id: "$parent_hash",
        owned: { $sum: 1 },
        available: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ["$listing", null] },
                  { $eq: [{ $ifNull: ["$reservation", null] }, null] }
                ]
              },
              1,
              0
            ]
          }
        }
      }
    }
  ]).toArray();


  if (!owned.length) return [];

  // Fetch NFT metadata
  const nftIds = owned.map((o) => o._id);
  const nfts = await db
    .collection("nfts")
    .find({ _id: { $in: nftIds } })
    .toArray();

  // Merge counts into NFT objects
  const nftMap = Object.fromEntries(nfts.map((n) => [n._id, n]));
  return owned.map((o) => ({
    ...nftMap[o._id],
    owned: o.owned,
    available: o.available,
  }));
}

/**
 * Count parts for a given NFT
 * @param {string} nftId
 * @returns {Promise<number>}
 */
export async function countPartsByNFT(nftId) {
  const db = await connectDB();
  return db.collection("parts").countDocuments({ parent_hash: nftId });
}

