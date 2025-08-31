import express from "express";
import multer from "multer";
import connectDB from "../db.js";
import crypto from "crypto";
import { hashObject } from "../utils/hash.js";

const router = express.Router();
const upload = multer({ dest: "uploads/" });

// GET /api/nfts
router.get("/", async (req, res) => {
  const db = await connectDB();
  const nfts = await db.collection("nfts").find({}).toArray();
  res.json(nfts);
});

// GET /api/nfts/creator/:address
router.get("/creator/:address", async (req, res) => {
  const db = await connectDB();
  const creator = req.params.address.toLowerCase();
  const nfts = await db.collection("nfts").find({ creator }).toArray();
  res.json(nfts);
});

// POST /api/nfts/mint
router.post("/mint", upload.single("imageFile"), async (req, res) => {
  const db = await connectDB();
  const { name, description, parts, creator } = req.body;
  const file = req.file;
  const imageurl = file ? `/uploads/${file.filename}` : req.body.imageUrl;

  if (!name || !description || !parts || !creator || !imageurl) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const nftObj = {
    name,
    description,
    creator: creator.toLowerCase(),
    imageurl,
    imagehash: crypto.createHash("sha256").update(imageurl).digest("hex"),
    time_created: new Date(),
    part_count: parseInt(parts),
    status: "minted",
  };

  const nftId = hashObject(nftObj);
  nftObj._id = nftId;

  const partDocs = [];
  for (let i = 0; i < nftObj.part_count; i++) {
    const part = {
      part_no: i,
      parent_hash: nftId,
      owner: creator.toLowerCase(),
      listing: null,
    };
    part._id = hashObject(part);
    partDocs.push(part);
  }

  try {
    await db.collection("nfts").insertOne(nftObj);
    await db.collection("parts").insertMany(partDocs);
    res.json({ success: true, id: nftId });
  } catch (e) {
    res.status(500).json({ error: "Failed to mint NFT" });
  }
});

// GET /api/nfts/:id
router.get("/:id", async (req, res) => {
  const db = await connectDB();
  const nft = await db.collection("nfts").findOne({ _id: req.params.id });
  if (!nft) return res.status(404).json({ error: "NFT not found" });
  res.json(nft);
});

// GET /api/nfts/:nftId/parts
router.get("/:nftId/parts", async (req, res) => {
  const db = await connectDB();
  const parts = await db.collection("parts").find({ parent_hash: req.params.nftId }).toArray();
  res.json(parts);
});

export default router;
