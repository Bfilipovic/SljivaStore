import express from "express";
import connectDB from "../db.js";

const router = express.Router();

// GET /api/parts/:id
router.get("/:id", async (req, res) => {
  const db = await connectDB();
  const part = await db.collection("parts").findOne({ _id: req.params.id });
  if (!part) return res.status(404).json({ error: "Part not found" });
  res.json(part);
});

// GET /api/parts/owner/:address
router.get("/owner/:address", async (req, res) => {
  const db = await connectDB();
  const address = req.params.address.toLowerCase();
  const parts = await db.collection("parts").find({ owner: address }).toArray();
  res.json(parts);
});

export default router;
