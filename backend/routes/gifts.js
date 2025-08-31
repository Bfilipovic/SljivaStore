import express from "express";
import connectDB from "../db.js";
import { ObjectId } from "mongodb";
import { verifySignature } from "../utils/verifySignature.js";

const router = express.Router();

// POST /api/gifts
router.post("/", verifySignature, async (req, res) => {
  const { giver, receiver, nftId, parts } = req.verifiedData;

  if (giver.toLowerCase() !== req.verifiedAddress.toLowerCase()) {
    return res.status(401).json({ error: "Giver address mismatch" });
  }

  const db = await connectDB();
  const partsCol = db.collection("parts");
  const giftsCol = db.collection("gifts");

  const foundParts = await partsCol.find({ _id: { $in: parts } }).toArray();
  if (foundParts.length !== parts.length) {
    return res.status(400).json({ error: "Some parts not found" });
  }
  for (const p of foundParts) {
    if (p.owner !== giver) return res.status(403).json({ error: `Part ${p._id} not owned by giver` });
    if (p.listing) return res.status(400).json({ error: `Part ${p._id} already listed or gifted` });
  }

  const gift = {
    giver: giver.toLowerCase(),
    receiver: receiver.toLowerCase(),
    nftId,
    parts,
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
    createdAt: new Date(),
    status: "ACTIVE",
  };
  const result = await giftsCol.insertOne(gift);
  const giftId = result.insertedId;

  await partsCol.updateMany(
    { _id: { $in: parts } },
    { $set: { listing: giftId.toString() } }
  );

  res.json({ success: true, giftId: giftId.toString() });
});

// GET /api/gifts/:address
router.get("/:address", async (req, res) => {
  const db = await connectDB();
  const giftsCol = db.collection("gifts");
  const now = new Date();
  const gifts = await giftsCol.find({
    receiver: req.params.address.toLowerCase(),
    status: "ACTIVE",
    expires: { $gt: now },
  }).toArray();
  res.json({ success: true, gifts });
});

// POST /api/gifts/claim
router.post("/claim", verifySignature, async (req, res) => {
  const { giftId, chainTx } = req.verifiedData;
  const verifiedAddr = req.verifiedAddress;

  const db = await connectDB();
  const giftsCol = db.collection("gifts");
  const partsCol = db.collection("parts");
  const txCol = db.collection("transactions");
  const ptxCol = db.collection("partialtransactions");
  const nftsCol = db.collection("nfts");

  const gift = await giftsCol.findOne({ _id: new ObjectId(giftId) });
  if (!gift) return res.status(404).json({ error: "Gift not found" });
  if (gift.status !== "ACTIVE") return res.status(400).json({ error: "Gift not active" });
  if (gift.expires <= new Date()) return res.status(400).json({ error: "Gift expired" });
  if (verifiedAddr.toLowerCase() !== gift.receiver.toLowerCase()) {
    return res.status(401).json({ error: "Receiver address mismatch" });
  }

  await partsCol.updateMany(
    { _id: { $in: gift.parts } },
    { $set: { owner: gift.receiver, listing: null } }
  );

  const nft = await nftsCol.findOne({ _id: gift.nftId });
  const txCount = await txCol.countDocuments();
  const transactionNumber = txCount + 1;
  const timestamp = new Date();

  const transaction = {
    transactionNumber,
    from: gift.giver,
    to: gift.receiver,
    listingId: gift._id,
    nftId: gift.nftId,
    numParts: gift.parts.length,
    partHashes: gift.parts,
    pricePerPartYrt: "0",
    totalPriceYrt: "0",
    totalPriceEth: "0",
    time: timestamp,
    chainTx: chainTx || null,
    status: "CONFIRMED",
  };
  const txResult = await txCol.insertOne(transaction);

  const partialTransactions = gift.parts.map((partId) => ({
    part: partId,
    from: gift.giver,
    to: gift.receiver,
    pricePerPartYrt: "0",
    pricePerPartEth: "0",
    timestamp,
    transaction: txResult.insertedId,
    chainTx: chainTx || null,
  }));
  if (partialTransactions.length > 0) {
    await ptxCol.insertMany(partialTransactions);
  }

  await giftsCol.updateOne(
    { _id: gift._id },
    { $set: { status: "CLAIMED", claimedAt: new Date() } }
  );

  res.json({ success: true, transactionId: txResult.insertedId });
});

// POST /api/gifts/refuse
router.post("/refuse", verifySignature, async (req, res) => {
  const { giftId } = req.verifiedData;
  const verifiedAddr = req.verifiedAddress;

  const db = await connectDB();
  const giftsCol = db.collection("gifts");
  const partsCol = db.collection("parts");

  const gift = await giftsCol.findOne({ _id: new ObjectId(giftId) });
  if (!gift) return res.status(404).json({ error: "Gift not found" });
  if (gift.expires <= new Date()) return res.status(400).json({ error: "Gift expired" });
  if (verifiedAddr.toLowerCase() !== gift.receiver.toLowerCase()) {
    return res.status(401).json({ error: "Receiver mismatch" });
  }
  if (gift.status !== "ACTIVE") return res.status(400).json({ error: "Gift not active" });

  await giftsCol.updateOne(
    { _id: gift._id },
    { $set: { status: "REFUSED", refusedAt: new Date() } }
  );

  await partsCol.updateMany(
    { _id: { $in: gift.parts } },
    { $set: { listing: null } }
  );

  res.json({ success: true });
});

export default router;
