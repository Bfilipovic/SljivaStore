import express from "express";
import connectDB from "../db.js";
import { ObjectId } from "mongodb";
import { yrtToEth } from "../utils/currency.js";

const router = express.Router();

// POST /api/reservations
router.post("/", async (req, res) => {
  const db = await connectDB();
  const { listingId, reserver, parts } = req.body;
  const timestamp = new Date();

  if (!listingId || !reserver || !Array.isArray(parts) || parts.length === 0) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  let listing;
  try {
    listing = await db.collection("listings").findOne({ _id: new ObjectId(listingId) });
  } catch {
    return res.status(400).json({ error: "Invalid listingId format" });
  }
  if (!listing) return res.status(404).json({ error: "Listing not found" });

  if (listing.type === "BUNDLE") {
    const sameLength = parts.length === listing.parts.length;
    const sameSet = sameLength && parts.every((p) => listing.parts.includes(p));
    if (!sameSet) {
      return res.status(400).json({ error: "Must reserve all parts for a bundle listing" });
    }
  }

  const availableParts = listing.parts || [];
  const allAvailable = parts.every((p) => availableParts.includes(p));
  if (!allAvailable) {
    return res.status(409).json({ error: "Some parts already reserved or sold" });
  }

  const updateResult = await db.collection("listings").updateOne(
    { _id: listing._id, parts: { $all: parts } },
    { $pull: { parts: { $in: parts } } }
  );
  if (updateResult.modifiedCount === 0) {
    return res.status(409).json({ error: "Reservation failed" });
  }

  const totalYrt = parts.length * listing.price;
  const totalEth = await yrtToEth(totalYrt);

  const reservation = {
    listingId,
    reserver,
    timestamp,
    totalPriceYrt: totalYrt,
    totalPriceEth: totalEth,
    parts,
  };
  await db.collection("reservations").insertOne(reservation);

  res.json({ reservation });
});

export default router;
