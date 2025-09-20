// backend/services/transactionService.js
/**
 * Service: Transaction handling
 *
 * Functions:
 * - createTransaction(data, verifiedAddress):
 *     Finalize a transaction from a reservation.
 *     Expected body (signed):
 *       {
 *         listingId: string,
 *         reservationId: string,
 *         buyer: string,          // ETH address (canonical identity)
 *         chainTx: string,        // blockchain transaction hash/id
 *         timestamp: number       // optional, client-provided
 *       }
 *
 *     Notes:
 *     - We trust amounts from the reservation (totalPriceCrypto).
 *     - Parts were already pulled from listing at reservation time.
 *     - Ownership of parts is transferred to buyer here.
 *     - Reservation is deleted after successful processing.
 */

import { ObjectId } from "mongodb";
import connectDB from "../db.js";

export async function createTransaction(data, verifiedAddress) {
  const { listingId, reservationId, buyer, chainTx, timestamp } = data || {};

  if (!listingId || !reservationId || !buyer || !chainTx) {
    throw new Error("Missing required fields");
  }
  if (verifiedAddress.toLowerCase() !== String(buyer).toLowerCase()) {
    throw new Error("Buyer address mismatch");
  }

  const db = await connectDB();

  const reservation = await db
    .collection("reservations")
    .findOne({ _id: new ObjectId(reservationId) });
  if (!reservation) throw new Error("Reservation not found");
  if (reservation.reserver !== buyer.toLowerCase()) {
    throw new Error("Reserver does not match buyer");
  }

  const listing = await db
    .collection("listings")
    .findOne({ _id: new ObjectId(listingId) });
  if (!listing) throw new Error("Listing not found");

  const nft = await db.collection("nfts").findOne({ _id: listing.nftId });
  if (!nft) throw new Error("NFT not found");

  const parts = reservation.parts || [];
  if (!Array.isArray(parts) || parts.length === 0) {
    throw new Error("Reservation has no parts");
  }

  const totalPriceCrypto = reservation.totalPriceCrypto;
  if (
    !totalPriceCrypto ||
    !totalPriceCrypto.currency ||
    totalPriceCrypto.amount == null
  ) {
    throw new Error("Reservation missing totalPriceCrypto");
  }

  const currency = totalPriceCrypto.currency.toUpperCase();
  const amount = String(totalPriceCrypto.amount);

  const txCollection = db.collection("transactions");
  const ptxCollection = db.collection("partialtransactions");
  const partsCollection = db.collection("parts");

  const seller = String(listing.seller).toLowerCase();

  const transactionDoc = {
    nftId: listing.nftId,
    listingId: listing._id,
    buyer: buyer.toLowerCase(),
    seller,
    currency,
    totalPriceCrypto: { currency, amount },
    chainTx,
    parts,
    timestamp: new Date(timestamp || Date.now()),
  };

  const txResult = await txCollection.insertOne(transactionDoc);
  const insertedTxId = txResult.insertedId;

  const partials = parts.map((partHash) => ({
    transaction: insertedTxId,
    txId: insertedTxId.toString(),
    nftId: listing.nftId,
    part: partHash,
    from: seller,
    to: buyer.toLowerCase(),
    currency,
    chainTx,
    timestamp: transactionDoc.timestamp,
  }));
  if (partials.length > 0) {
    await ptxCollection.insertMany(partials);
  }

  // Transfer ownership of parts to the buyer and clear listing pointer
  await partsCollection.updateMany(
    { _id: { $in: parts } },
    { $set: { owner: buyer.toLowerCase(), listing: null } }
  );

  // Update listing status (do not pull parts again)
  const remaining = (listing.parts || []).length - parts.length;
  await db.collection("listings").updateOne(
    { _id: listing._id },
    {
      $set: {
        status: remaining <= 0 ? "SOLD_OUT" : listing.status,
      },
    }
  );

  await db.collection("reservations").deleteOne({ _id: reservation._id });

  return insertedTxId.toString();
}

export async function getPartialTransactionsByPart(partHash) {
  const db = await connectDB();
  return db
    .collection("partialtransactions")
    .find({ part: partHash })
    .toArray();
}
