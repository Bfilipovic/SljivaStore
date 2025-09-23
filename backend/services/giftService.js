// backend/services/giftService.js
/**
 * Service: Gift handling (refactored, quantity-based)
 *
 * Exports:
 * - createGift(data, verifiedAddress): Promise<string>
 *   Signed body:
 *     {
 *       giver: string,      // ETH addr (canonical)
 *       receiver: string,   // ETH addr (canonical)
 *       nftId: string,
 *       quantity: number
 *     }
 * - getGiftsForAddress(address: string)
 * - claimGift(data, verifiedAddress): Promise<string>  // returns txId
 * - refuseGift(data, verifiedAddress): Promise<void>
 *
 * Notes:
 * - Gifts reserve N parts from giver by setting `listing: giftId`.
 * - On claim: transfer those reserved parts to receiver, create transaction + partialtransactions.
 * - On refuse: release those parts.
 */

import { ObjectId } from "mongodb";
import connectDB from "../db.js";

/**
 * Create a new gift for NFT parts.
 *
 * @param {Object} data
 * @param {string} data.giver
 * @param {string} data.receiver
 * @param {string} data.nftId
 * @param {number} data.quantity
 * @param {string} verifiedAddress - Address verified via signature
 * @returns {Promise<string>} giftId
 */
export async function createGift(data, verifiedAddress) {
  const { giver, receiver, nftId, quantity } = data;
  console.log("[createGift] Called with:", { giver, receiver, nftId, quantity });

  if (!giver || !receiver || !nftId || !quantity) {
    throw new Error("Invalid request data");
  }
  if (giver.toLowerCase() !== verifiedAddress.toLowerCase()) {
    throw new Error("Giver address mismatch");
  }
  if (giver.toLowerCase() === receiver.toLowerCase()) {
    throw new Error("Cannot gift to yourself");
  }

  const qty = parseInt(quantity, 10);
  if (!Number.isFinite(qty) || qty < 1) throw new Error("Invalid quantity");

  const db = await connectDB();
  const partsCol = db.collection("parts");
  const giftsCol = db.collection("gifts");

  // Check available parts
  const availableCount = await partsCol.countDocuments({
    owner: giver.toLowerCase(),
    listing: null,
  });
  console.log("[createGift] Available parts for giver:", availableCount);

  if (availableCount < qty) {
    throw new Error(`Giver has only ${availableCount} available parts, requested ${qty}`);
  }

  const giftId = new ObjectId();
  const gift = {
    _id: giftId,
    nftId,
    giver: giver.toLowerCase(),
    receiver: receiver.toLowerCase(),
    quantity: qty,
    status: "ACTIVE",
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h expiry
    createdAt: new Date(),
  };

  await giftsCol.insertOne(gift);
  console.log("[createGift] Inserted gift:", { id: giftId.toString() });

  // Safely pick N parts
  const freeParts = await partsCol
    .find({ owner: giver.toLowerCase(), listing: null })
    .limit(qty)
    .project({ _id: 1 })
    .toArray();

  console.log("[createGift] Free parts fetched:", freeParts.length);

  if (freeParts.length < qty) {
    throw new Error(`Could not find enough free parts to gift (found ${freeParts.length}, need ${qty})`);
  }

  const partIds = freeParts.map((p) => p._id);
  const updateRes = await partsCol.updateMany(
    { _id: { $in: partIds } },
    { $set: { listing: giftId.toString() } }
  );

  console.log("[createGift] Marked parts for gift:", {
    requested: qty,
    modified: updateRes.modifiedCount,
  });

  return giftId.toString();
}


export async function getGiftsForAddress(address) {
  const db = await connectDB();
  const giftsCol = db.collection("gifts");
  const now = new Date();

  return giftsCol
    .find({
      receiver: address.toLowerCase(),
      status: "ACTIVE",
      expires: { $gt: now },
    })
    .toArray();
}

export async function claimGift(data, verifiedAddress) {
  const { giftId, chainTx } = data;
  if (!giftId) throw new Error("Missing giftId");

  const db = await connectDB();
  const giftsCol = db.collection("gifts");
  const partsCol = db.collection("parts");
  const txCol = db.collection("transactions");
  const ptxCol = db.collection("partialtransactions");
  const nftsCol = db.collection("nfts");

  const gift = await giftsCol.findOne({ _id: new ObjectId(giftId) });
  if (!gift) throw new Error("Gift not found");
  if (gift.status !== "ACTIVE") throw new Error("Gift not active");
  if (gift.expires <= new Date()) throw new Error("Gift expired");
  if (verifiedAddress.toLowerCase() !== gift.receiver.toLowerCase()) {
    throw new Error("Receiver address mismatch");
  }

  const nft = await nftsCol.findOne({ _id: gift.nftId });
  if (!nft) throw new Error("NFT not found");

  // Build transaction doc
  const txId = new ObjectId();
  const txDoc = {
    _id: txId,
    type: "GIFT",
    nftId: gift.nftId,
    giver: gift.giver,
    receiver: gift.receiver,
    quantity: gift.quantity,
    chainTx: chainTx || null,
    currency: "ETH", // gifts are off-chain, but can log "ETH" for consistency
    amount: "0",
    timestamp: new Date(),
  };
  await txCol.insertOne(txDoc);

  // Find parts locked by this gift
  const giftedParts = await partsCol
    .find({ listing: gift._id.toString(), owner: gift.giver })
    .project({ _id: 1 })
    .toArray();

  if (giftedParts.length !== gift.quantity) {
    throw new Error(
      `Mismatch: gift quantity=${gift.quantity} but found ${giftedParts.length} parts`
    );
  }

  // Create partial transactions
  const partials = giftedParts.map((p) => ({
    part: p._id,
    txId: txId.toString(),
    from: gift.giver,
    to: gift.receiver,
    nftId: gift.nftId,
    transaction: txId.toString(),
    chainTx: chainTx || null,
    currency: "ETH",
    amount: "0",
    timestamp: new Date(),
  }));
  if (partials.length) await ptxCol.insertMany(partials);

  // Transfer ownership of gifted parts
  await partsCol.updateMany(
    { listing: gift._id.toString(), owner: gift.giver },
    { $set: { owner: gift.receiver, listing: null, reservation: null } }
  );

  await giftsCol.updateOne(
    { _id: gift._id },
    { $set: { status: "CLAIMED", claimedAt: new Date() } }
  );

  return txId.toString();
}

export async function refuseGift(data, verifiedAddress) {
  const { giftId } = data;
  if (!giftId) throw new Error("Missing giftId");

  const db = await connectDB();
  const giftsCol = db.collection("gifts");
  const partsCol = db.collection("parts");

  const gift = await giftsCol.findOne({ _id: new ObjectId(giftId) });
  if (!gift) throw new Error("Gift not found");
  if (gift.status !== "ACTIVE") throw new Error("Gift not active");
  if (gift.expires <= new Date()) throw new Error("Gift expired");
  if (verifiedAddress.toLowerCase() !== gift.receiver.toLowerCase()) {
    throw new Error("Receiver address mismatch");
  }

  // Release parts
  await partsCol.updateMany(
    { listing: gift._id.toString(), owner: gift.giver },
    { $set: { listing: null } }
  );

  await giftsCol.updateOne(
    { _id: gift._id },
    { $set: { status: "REFUSED", refusedAt: new Date() } }
  );
}
