import express from "express";
import connectDB from "../db.js";
import { ObjectId } from "mongodb";
import { verifySignature } from "../utils/verifySignature.js";

const router = express.Router();

// POST /api/transactions
router.post("/", verifySignature, async (req, res) => {
  const db = await connectDB();
  const { listingId, reservationId, buyer, timestamp, chainTx } = req.verifiedData;

  if (req.verifiedAddress.toLowerCase() !== buyer.toLowerCase()) {
    return res.status(401).json({ error: "Buyer address mismatch" });
  }
  if (!listingId || !reservationId || !buyer || !timestamp) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const reservation = await db.collection("reservations").findOne({ _id: new ObjectId(reservationId) });
  if (!reservation) return res.status(404).json({ error: "Reservation not found" });
  if (reservation.reserver !== buyer) return res.status(403).json({ error: "Reserver mismatch" });

  const listing = await db.collection("listings").findOne({ _id: new ObjectId(listingId) });
  if (!listing) return res.status(404).json({ error: "Listing not found" });

  const nft = await db.collection("nfts").findOne({ _id: listing.nftId });
  if (!nft) return res.status(404).json({ error: "NFT not found" });

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

  res.json({ success: true, transactionId: txResult.insertedId });
});

// GET /api/transactions/partial/:partHash
router.get("/partial/:partHash", async (req, res) => {
  const db = await connectDB();
  const { partHash } = req.params;
  const partials = await db.collection("partialtransactions").find({ part: partHash }).toArray();
  res.json(partials);
});

export default router;
