import express from "express";
import {
  getAllNFTs,
  getNFTsByCreator,
  getNFTsByOwner,
  mintNFT,
  getNFTById,
  getPartsByNFT,
  countPartsByNFT,
} from "../services/nftService.js";
import { verifySignature } from "../utils/verifySignature.js";
import { checkMaintenanceMode } from "../utils/checkMaintenanceMode.js";

const router = express.Router();

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
router.post("/mint", verifySignature, checkMaintenanceMode, async (req, res) => {
  try {
    const result = await mintNFT(req.verifiedData, req.verifiedAddress, req.signature);
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


// GET /api/nfts/:id/parts?skip=0&limit=50
router.get("/:id/parts", async (req, res) => {
  try {
    const { skip = 0, limit = 50 } = req.query;

    const parts = await getPartsByNFT(req.params.id, {
      skip: parseInt(skip, 10),
      limit: parseInt(limit, 10),
    });
    const total = await countPartsByNFT(req.params.id);

    res.json({ total, parts });
  } catch (err) {
    console.error("[GET /api/nfts/:id/parts] Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/nfts/owner/:address
router.get("/owner/:address", async (req, res) => {
  try {
    const result = await getNFTsByOwner(req.params.address);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/nfts/:id/parts?skip=0&limit=100
router.get("/:id/parts", async (req, res) => {
  try {
    const { skip = 0, limit = 100 } = req.query;
    const parts = await getPartsByNFT(req.params.id, {
      skip: parseInt(skip, 10),
      limit: parseInt(limit, 10),
    });
    res.json(parts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
