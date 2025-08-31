import express from "express";
import connectDB from "../db.js";
import { ObjectId } from "mongodb";
import { verifySignature } from "../utils/verifySignature.js";

const router = express.Router();

// POST /api/listings
router.post("/", verifySignature, async (req, res) => {
  const { price, nftId, seller, parts, bundleSale } = req.verifiedData;

  if (!price || !nftId || !seller || !Array.isArray(parts) || parts.length === 0) {
    return res.status(400).json({ error: "Missing or invalid listing fields" });
  }

  if (seller.toLowerCase() !== req.verifiedAddress.toLowerCase()) {
    return res.status(401).json({ error: "Seller address mismatch" });
  }

  const db = await connectDB();
  const listingDoc = {
    price,
    nftId,
    seller: seller.toLowerCase(),
    parts,
    status: "ACTIVE",
    type: bundleSale ? "BUNDLE" : "STANDARD",
    time_created: new Date(),
  };

  const result = await db.collection("listings").insertOne(listingDoc);
  const listingId = result.insertedId;

  await db.collection("parts").updateMany(
    { _id: { $in: parts } },
    { $set: { listing: listingId.toString() } }
  );

  res.json({ success: true, id: listingId });
});

// GET /api/listings
router.get("/", async (req, res) => {
  const db = await connectDB();
  const listings = await db.collection("listings").find({ status: { $ne: "DELETED" } }).toArray();
  res.json(listings);
});

// DELETE /api/listings/:id
router.delete("/:id", verifySignature, async (req, res) => {
  const db = await connectDB();
  const listingId = req.params.id;
  const { seller } = req.verifiedData;

  const listing = await db.collection("listings").findOne({ _id: new ObjectId(listingId) });
  if (!listing) return res.status(404).json({ error: "Listing not found" });
  if (listing.seller !== seller.toLowerCase()) {
    return res.status(403).json({ error: "Not authorized" });
  }

  if (listing.parts?.length > 0) {
    await db.collection("parts").updateMany(
      { _id: { $in: listing.parts } },
      { $set: { listing: null } }
    );
  }

  await db.collection("listings").updateOne(
    { _id: new ObjectId(listingId) },
    { $set: { status: "DELETED" } }
  );

  res.json({ success: true });
});

export default router;
