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
import { hashObject, hashableTransaction } from "../utils/hash.js";
import { getNextTransactionInfo, uploadTransactionToArweave } from "./arweaveService.js";
import { TX_TYPES } from "../utils/transactionTypes.js";
import { logInfo } from "../utils/logger.js";

/**
 * Create a new gift for NFT parts.
 *
 * @param {Object} data
 * @param {string} data.giver
 * @param {string} data.receiver
 * @param {string} data.nftId
 * @param {number} data.quantity
 * @param {string} verifiedAddress - Address verified via signature
 * @param {string} signature - Signature from frontend
 * @returns {Promise<string>} giftId
 */
export async function createGift(data, verifiedAddress, signature) {
  const { giver, receiver, nftId, quantity } = data;

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
    // No expiry - gifts are non-expiring, only cancelled/claimed/refused
    createdAt: new Date(),
  };

  await giftsCol.insertOne(gift);

  // Create GIFT_CREATE transaction
  const txCol = db.collection("transactions");
  const { transactionNumber, previousArweaveTxId } = await getNextTransactionInfo();
  
  const createTxDoc = {
    type: TX_TYPES.GIFT_CREATE,
    transaction_number: transactionNumber,
    giftId: giftId.toString(),
    nftId: String(nftId),
    giver: giver.toLowerCase(),
    receiver: receiver.toLowerCase(),
    quantity: qty,
    timestamp: new Date(),
    signer: String(verifiedAddress).toLowerCase(),
    signature: signature || null,
  };
  
  // Generate hash-based ID
  const createTxId = hashObject(hashableTransaction(createTxDoc));
  createTxDoc._id = createTxId;
  
  // Insert transaction
  await txCol.insertOne(createTxDoc);
  logInfo(`[createGift] Created GIFT_CREATE transaction: ${createTxId}`);
  
  // Upload to Arweave
  let arweaveTxId = null;
  try {
    arweaveTxId = await uploadTransactionToArweave(createTxDoc, transactionNumber, previousArweaveTxId);
    await txCol.updateOne(
      { _id: createTxId },
      { $set: { arweaveTxId: arweaveTxId } }
    );
    logInfo(`[createGift] GIFT_CREATE transaction uploaded to Arweave: ${arweaveTxId}`);
  } catch (error) {
    logInfo(`[createGift] Warning: Failed to upload GIFT_CREATE to Arweave: ${error.message}`);
  }

  // Safely pick N parts
  const freeParts = await partsCol
    .find({
      owner: giver.toLowerCase(),
      listing: null,
      parent_hash: String(nftId)
    })
    .limit(qty)
    .project({ _id: 1 })
    .toArray();

  if (freeParts.length < qty) {
    throw new Error(`Could not find enough free parts to gift (found ${freeParts.length}, need ${qty})`);
  }

  const partIds = freeParts.map((p) => p._id);
  const updateRes = await partsCol.updateMany(
    { _id: { $in: partIds } },
    { $set: { listing: giftId.toString() } }
  );

  return giftId.toString();
}


export async function getGiftsForAddress(address) {
  const db = await connectDB();
  const giftsCol = db.collection("gifts");

  // No expiry check - gifts are non-expiring
  return giftsCol
    .find({
      receiver: address.toLowerCase(),
      status: "ACTIVE",
    })
    .toArray();
}

/**
 * Get gifts created by an address (where they are the giver)
 * @param {string} address - The giver's address
 * @returns {Promise<Array>} Array of active gifts created by the address
 */
export async function getGiftsCreatedByAddress(address) {
  const db = await connectDB();
  const giftsCol = db.collection("gifts");

  // Return active gifts where the user is the giver
  return giftsCol
    .find({
      giver: address.toLowerCase(),
      status: "ACTIVE",
    })
    .toArray();
}

export async function claimGift(data, verifiedAddress, signature) {
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
  // No expiry check - gifts are non-expiring
  if (verifiedAddress.toLowerCase() !== gift.receiver.toLowerCase()) {
    throw new Error("Receiver address mismatch");
  }

  const nft = await nftsCol.findOne({ _id: gift.nftId });
  if (!nft) throw new Error("NFT not found");

  // Get next transaction number and previous Arweave transaction ID
  const { transactionNumber, previousArweaveTxId } = await getNextTransactionInfo();

  // Build transaction doc (without _id first)
  const txDoc = {
    type: TX_TYPES.GIFT_CLAIM,
    transaction_number: transactionNumber,
    giftId: giftId.toString(),
    nftId: gift.nftId,
    giver: gift.giver,
    receiver: gift.receiver,
    quantity: gift.quantity,
    chainTx: chainTx || null,
    currency: "ETH", // gifts are off-chain, but can log "ETH" for consistency
    amount: "0",
    timestamp: new Date(),
    signer: String(verifiedAddress).toLowerCase(),
    signature: signature || null,
  };
  
  // Generate hash-based ID (includes transaction_number)
  const txId = hashObject(hashableTransaction(txDoc));
  txDoc._id = txId;
  await txCol.insertOne(txDoc);

  // Upload to Arweave (includes previous_arweave_tx link)
  let arweaveTxId = null;
  try {
    arweaveTxId = await uploadTransactionToArweave(txDoc, transactionNumber, previousArweaveTxId);
    
    // Update transaction with Arweave ID (this doesn't affect the hash)
    await txCol.updateOne(
      { _id: txId },
      { $set: { arweaveTxId: arweaveTxId } }
    );
    
    logInfo(`[claimGift] Gift transaction ${txId} uploaded to Arweave: ${arweaveTxId}`);
  } catch (error) {
    logInfo(`[claimGift] Warning: Failed to upload to Arweave: ${error.message}`);
    // Continue even if Arweave upload fails - transaction is still valid
  }

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
    transaction: txId,
    from: gift.giver,
    to: gift.receiver,
    nftId: gift.nftId,
    chainTx: chainTx || null,
    currency: "ETH",
    amount: "0",
    timestamp: new Date(),
  }));
  if (partials.length) await ptxCol.insertMany(partials);

  // Transfer ownership of gifted parts
  await partsCol.updateMany(
    { listing: gift._id.toString(), owner: gift.giver },
    { $set: { owner: gift.receiver, listing: null}, $unset: { reservation: "" } }
  );

  await giftsCol.updateOne(
    { _id: gift._id },
    { $set: { status: "CLAIMED", claimedAt: new Date() } }
  );

  return txId;
}

export async function refuseGift(data, verifiedAddress, signature) {
  const { giftId } = data;
  if (!giftId) throw new Error("Missing giftId");

  const db = await connectDB();
  const giftsCol = db.collection("gifts");
  const partsCol = db.collection("parts");
  const txCol = db.collection("transactions");

  const gift = await giftsCol.findOne({ _id: new ObjectId(giftId) });
  if (!gift) throw new Error("Gift not found");
  if (gift.status !== "ACTIVE") throw new Error("Gift not active");
  // No expiry check - gifts are non-expiring
  if (verifiedAddress.toLowerCase() !== gift.receiver.toLowerCase()) {
    throw new Error("Receiver address mismatch");
  }

  // Create GIFT_REFUSE transaction
  const { transactionNumber, previousArweaveTxId } = await getNextTransactionInfo();
  
  const refuseTxDoc = {
    type: TX_TYPES.GIFT_REFUSE,
    transaction_number: transactionNumber,
    giftId: giftId.toString(),
    nftId: gift.nftId,
    giver: gift.giver,
    receiver: gift.receiver,
    quantity: gift.quantity,
    timestamp: new Date(),
    signer: String(verifiedAddress).toLowerCase(),
    signature: signature || null,
  };
  
  // Generate hash-based ID
  const refuseTxId = hashObject(hashableTransaction(refuseTxDoc));
  refuseTxDoc._id = refuseTxId;
  
  // Insert transaction
  await txCol.insertOne(refuseTxDoc);
  logInfo(`[refuseGift] Created GIFT_REFUSE transaction: ${refuseTxId}`);
  
  // Upload to Arweave
  let arweaveTxId = null;
  try {
    arweaveTxId = await uploadTransactionToArweave(refuseTxDoc, transactionNumber, previousArweaveTxId);
    await txCol.updateOne(
      { _id: refuseTxId },
      { $set: { arweaveTxId: arweaveTxId } }
    );
    logInfo(`[refuseGift] GIFT_REFUSE transaction uploaded to Arweave: ${arweaveTxId}`);
  } catch (error) {
    logInfo(`[refuseGift] Warning: Failed to upload GIFT_REFUSE to Arweave: ${error.message}`);
  }

  // Release parts (clear listing and reservation fields)
  const releaseResult = await partsCol.updateMany(
    { listing: gift._id.toString(), owner: gift.giver },
    { $set: { listing: null }, $unset: { reservation: "" } }
  );
  
  logInfo(`[refuseGift] Released ${releaseResult.modifiedCount} parts from gift ${giftId}`);
  
  if (releaseResult.modifiedCount !== gift.quantity) {
    logInfo(`[refuseGift] Warning: Expected to release ${gift.quantity} parts, but released ${releaseResult.modifiedCount}`);
  }

  await giftsCol.updateOne(
    { _id: gift._id },
    { $set: { status: "REFUSED", refusedAt: new Date() } }
  );
}

/**
 * Cancel a gift (can only be done by the giver)
 *
 * @param {Object} data
 * @param {string} data.giftId
 * @param {string} verifiedAddress - Address verified via signature
 * @param {string} signature - Signature from frontend
 * @returns {Promise<void>}
 */
export async function cancelGift(data, verifiedAddress, signature) {
  const { giftId } = data;
  if (!giftId) throw new Error("Missing giftId");

  const db = await connectDB();
  const giftsCol = db.collection("gifts");
  const partsCol = db.collection("parts");
  const txCol = db.collection("transactions");

  const gift = await giftsCol.findOne({ _id: new ObjectId(giftId) });
  if (!gift) throw new Error("Gift not found");
  if (gift.status !== "ACTIVE") throw new Error("Gift not active");
  // Only giver can cancel
  if (verifiedAddress.toLowerCase() !== gift.giver.toLowerCase()) {
    throw new Error("Only the giver can cancel a gift");
  }

  // Create GIFT_CANCEL transaction
  const { transactionNumber, previousArweaveTxId } = await getNextTransactionInfo();
  
  const cancelTxDoc = {
    type: TX_TYPES.GIFT_CANCEL,
    transaction_number: transactionNumber,
    giftId: giftId.toString(),
    nftId: gift.nftId,
    giver: gift.giver,
    receiver: gift.receiver,
    quantity: gift.quantity,
    timestamp: new Date(),
    signer: String(verifiedAddress).toLowerCase(),
    signature: signature || null,
  };
  
  // Generate hash-based ID
  const cancelTxId = hashObject(hashableTransaction(cancelTxDoc));
  cancelTxDoc._id = cancelTxId;
  
  // Insert transaction
  await txCol.insertOne(cancelTxDoc);
  logInfo(`[cancelGift] Created GIFT_CANCEL transaction: ${cancelTxId}`);
  
  // Upload to Arweave
  let arweaveTxId = null;
  try {
    arweaveTxId = await uploadTransactionToArweave(cancelTxDoc, transactionNumber, previousArweaveTxId);
    await txCol.updateOne(
      { _id: cancelTxId },
      { $set: { arweaveTxId: arweaveTxId } }
    );
    logInfo(`[cancelGift] GIFT_CANCEL transaction uploaded to Arweave: ${arweaveTxId}`);
  } catch (error) {
    logInfo(`[cancelGift] Warning: Failed to upload GIFT_CANCEL to Arweave: ${error.message}`);
  }

  // Release parts (clear listing and reservation fields)
  const releaseResult = await partsCol.updateMany(
    { listing: gift._id.toString(), owner: gift.giver },
    { $set: { listing: null }, $unset: { reservation: "" } }
  );
  
  logInfo(`[cancelGift] Released ${releaseResult.modifiedCount} parts from gift ${giftId}`);
  
  if (releaseResult.modifiedCount !== gift.quantity) {
    logInfo(`[cancelGift] Warning: Expected to release ${gift.quantity} parts, but released ${releaseResult.modifiedCount}`);
  }

  await giftsCol.updateOne(
    { _id: gift._id },
    { $set: { status: "CANCELLED", cancelledAt: new Date() } }
  );
}
