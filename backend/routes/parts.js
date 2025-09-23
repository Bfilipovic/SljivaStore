import express from "express";
import { getPartById, getPartsByOwner } from "../services/partService.js";

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

export default router;
