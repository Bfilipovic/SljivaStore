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
import { hashObject, hashableNFT, hashablePart, hashablePartId, hashableTransaction } from "../utils/hash.js";
import { logInfo } from "../utils/logger.js";
import { isAdmin } from "./adminService.js";
import { getNextTransactionInfo, uploadTransactionToArweave } from "./arweaveService.js";
import { TX_TYPES } from "../utils/transactionTypes.js";

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
export async function mintNFT(verifiedData, verifiedAddress, signature) {
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
  const txCollection = db.collection("transactions");
  const ptxCollection = db.collection("partialtransactions");

  const creatorLower = String(creator).toLowerCase();
  const imagehash = crypto.createHash("sha256").update(String(imageUrl)).digest("hex");
  const partCount = parseInt(parts, 10);
  if (!Number.isFinite(partCount) || partCount < 1) {
    throw new Error("Invalid parts count");
  }

  const nftObj = {
    name: String(name),
    description: String(description),
    creator: creatorLower,
    imageurl: String(imageUrl),
    imagehash,
    time_created: new Date(),
    part_count: partCount,
    status: "ACTIVE",
  };

  // Use hashableNFT to ensure deterministic hashing
  const nftId = hashObject(hashableNFT(nftObj));
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
        reservation: null,
      };
      // Use hashablePartId for stable _id based on immutable fields
      // All fields are still included in the document for verification
      batch.push({
        _id: hashObject(hashablePartId(partDoc)),
        ...partDoc,
      });
    }
    await partsCol.insertMany(batch, { ordered: false });
    inserted += batch.length;
    logInfo(`[mintNFT] Inserted ${inserted}/${partCount} parts for ${nftId}`);
  }

  // Get next transaction number and previous Arweave transaction ID
  const { transactionNumber, previousArweaveTxId } = await getNextTransactionInfo();

  // Create mint transaction where minter is both buyer and seller
  const mintTxDoc = {
    type: TX_TYPES.MINT,
    transaction_number: transactionNumber,
    listingId: null,
    reservationId: null,
    giftId: null,
    nftId: String(nftId),
    buyer: creatorLower,
    seller: creatorLower,
    giver: null,
    receiver: null,
    quantity: partCount,
    chainTx: null,
    currency: "ETH",
    amount: "0",
    price: null,
    sellerWallets: null,
    bundleSale: null,
    timestamp: new Date(),
    signer: String(verifiedAddress).toLowerCase(),
    signature: signature || null,
  };
  
  // Generate hash-based ID (includes transaction_number)
  const mintTxId = hashObject(hashableTransaction(mintTxDoc));
  mintTxDoc._id = mintTxId;
  await txCollection.insertOne(mintTxDoc);

  // Upload to Arweave (includes previous_arweave_tx link)
  let arweaveTxId = null;
  try {
    arweaveTxId = await uploadTransactionToArweave(mintTxDoc, transactionNumber, previousArweaveTxId);
    
    // Update transaction with Arweave ID (this doesn't affect the hash)
    await txCollection.updateOne(
      { _id: mintTxId },
      { $set: { arweaveTxId: arweaveTxId } }
    );
    
    logInfo(`[mintNFT] Mint transaction ${mintTxId} uploaded to Arweave: ${arweaveTxId}`);
  } catch (error) {
    logInfo(`[mintNFT] Warning: Failed to upload to Arweave: ${error.message}`);
    // Continue even if Arweave upload fails - transaction is still valid
  }

  // Create partial transactions for all minted parts
  // Get all parts that were just created for this NFT
  const mintedParts = await partsCol
    .find({ parent_hash: nftId })
    .project({ _id: 1 })
    .toArray();

  if (mintedParts.length > 0) {
    const partials = mintedParts.map((p) => ({
      part: p._id,
      transaction: mintTxId,
      from: "", // Mint has no "from" - part is being created (use empty string, not null)
      to: creatorLower,
      nftId: nftId,
      chainTx: null,
      currency: "ETH",
      amount: "0",
      timestamp: new Date(),
    }));

    await ptxCollection.insertMany(partials);
    logInfo(`[mintNFT] Created ${partials.length} partial transactions for mint`);
  }

  logInfo(`[mintNFT] Completed mint for NFT ${nftId} (${partCount} parts) with transaction ${mintTxId}`);
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

