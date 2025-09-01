import connectDB from "../db.js";
import { ObjectId } from "mongodb";

export async function createTransaction(data, verifiedAddress) {
  const { listingId, reservationId, buyer, timestamp, chainTx } = data;

  if (verifiedAddress.toLowerCase() !== buyer.toLowerCase()) {
    throw new Error("Buyer address mismatch");
  }
  if (!listingId || !reservationId || !buyer || !timestamp) {
    throw new Error("Missing required fields");
  }

  const db = await connectDB();

  const reservation = await db.collection("reservations").findOne({ _id: new ObjectId(reservationId) });
  if (!reservation) throw new Error("Reservation not found");
  if (reservation.reserver !== buyer) throw new Error("Reserver does not match buyer");

  const listing = await db.collection("listings").findOne({ _id: new ObjectId(listingId) });
  if (!listing) throw new Error("Listing not found");

  const nft = await db.collection("nfts").findOne({ _id: listing.nftId });
  if (!nft) throw new Error("NFT not found");

  const txCount = await db.collection("transactions").countDocuments();
  const transactionNumber = txCount + 1;

  const transaction = {
    transactionNumber,
    from: listing.seller,
    to: buyer,
    listingId: listing._id,
    nftId: nft._id,
    numParts: reservation.parts.length,
    partHashes: reservation.parts,
    pricePerPartYrt: listing.price,
    totalPriceYrt: reservation.totalPriceYrt,
    totalPriceEth: reservation.totalPriceEth,
    time: timestamp,
    chainTx: chainTx || null,
    status: "CONFIRMED",
  };

  const txResult = await db.collection("transactions").insertOne(transaction);

  const partialTransactions = reservation.parts.map((partHash) => ({
    part: partHash,
    from: listing.seller,
    to: buyer,
    pricePerPartYrt: listing.price,
    pricePerPartEth: reservation.totalPriceEth / reservation.parts.length,
    timestamp,
    transaction: txResult.insertedId,
    chainTx: chainTx || null,
  }));
  if (partialTransactions.length > 0) {
    await db.collection("partialtransactions").insertMany(partialTransactions);
  }

  await db.collection("parts").updateMany(
    { _id: { $in: reservation.parts } },
    { $set: { owner: buyer, listing: null } }
  );

  await db.collection("reservations").deleteOne({ _id: reservation._id });

  return txResult.insertedId;
}

export async function getPartialTransactionsByPart(partHash) {
  const db = await connectDB();
  return db.collection("partialtransactions").find({ part: partHash }).toArray();
}
