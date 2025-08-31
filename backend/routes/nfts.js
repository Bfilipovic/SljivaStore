import express from "express";
import multer from "multer";
import {
  getAllNFTs,
  getNFTsByCreator,
  mintNFT,
  getNFTById,
  getPartsByNFT
} from "../services/nftService.js";

const router = express.Router();
const upload = multer({ dest: "uploads/" });

// GET /api/nfts
router.get("/", async (req, res) => {
  try {
    const nfts = await getAllNFTs();
    res.json(nfts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/nfts/creator/:address
router.get("/creator/:address", async (req, res) => {
  try {
    const nfts = await getNFTsByCreator(req.params.address);
    res.json(nfts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/nfts/mint
router.post("/mint", upload.single("imageFile"), async (req, res) => {
  try {
    const result = await mintNFT(req.body, req.file);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/nfts/:id
router.get("/:id", async (req, res) => {
  try {
    const nft = await getNFTById(req.params.id);
    if (!nft) return res.status(404).json({ error: "NFT not found" });
    res.json(nft);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/nfts/:nftId/parts
router.get("/:nftId/parts", async (req, res) => {
  try {
    const parts = await getPartsByNFT(req.params.nftId);
    res.json(parts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
