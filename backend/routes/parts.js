import express from "express";
import { 
  getPartById,
  getPartsByOwner,
  getPartsByListing,
  countPartsByListing,
  getPartsByOwnerAndNFT,
  countPartsByOwnerAndNFT
} from "../services/partService.js";


const router = express.Router();

// GET /api/parts/:id
router.get("/:id", async (req, res) => {
  try {
    const part = await getPartById(req.params.id);
    if (!part) return res.status(404).json({ error: "Part not found" });
    res.json(part);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/parts/owner/:address?skip=0&limit=100
router.get("/owner/:address", async (req, res) => {
  try {
    const { skip = 0, limit = 100 } = req.query;
    const parts = await getPartsByOwner(req.params.address, {
      skip: parseInt(skip, 10),
      limit: parseInt(limit, 10),
    });
    res.json(parts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ...

// GET /api/parts/listing/:listingId?skip=0&limit=50
router.get("/listing/:listingId", async (req, res) => {
  try {
    const { skip = 0, limit = 50 } = req.query;
    const parts = await getPartsByListing(req.params.listingId, {
      skip: parseInt(skip, 10),
      limit: parseInt(limit, 10),
    });
    const total = await countPartsByListing(req.params.listingId);
    res.json({ total, parts });
  } catch (err) {
    console.error("[GET /api/parts/listing/:listingId] Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/parts/owner/:address/nft/:nftId?skip=0&limit=50
router.get("/owner/:address/nft/:nftId", async (req, res) => {
  try {
    const { skip = 0, limit = 50 } = req.query;
    const parts = await getPartsByOwnerAndNFT(req.params.address, req.params.nftId, {
      skip: parseInt(skip, 10),
      limit: parseInt(limit, 10),
    });
    const total = await countPartsByOwnerAndNFT(req.params.address, req.params.nftId);
    res.json({ total, parts });
  } catch (err) {
    console.error("[GET /api/parts/owner/:address/nft/:nftId] Error:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
