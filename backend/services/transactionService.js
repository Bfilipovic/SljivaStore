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
        reservation: null,
      },
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
export async function getPartialTransactionsByPart(partHash) {
  const db = await connectDB();
  return db
    .collection("partialtransactions")
    .find({ part: String(partHash) })
    .toArray();
}
