import express from "express";
import { verifySignature } from "../utils/verifySignature.js";
import {
  createGift,
  getGiftsForAddress,
  claimGift,
  refuseGift,
} from "../services/giftService.js";

const router = express.Router();

// POST /api/gifts
router.post("/", verifySignature, async (req, res) => {
  try {
    const giftId = await createGift(req.verifiedData, req.verifiedAddress);
    res.json({ success: true, giftId });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/gifts/:address
router.get("/:address", async (req, res) => {
  try {
    const gifts = await getGiftsForAddress(req.params.address);
    res.json({ success: true, gifts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/gifts/claim
router.post("/claim", verifySignature, async (req, res) => {
  try {
    const txId = await claimGift(req.verifiedData, req.verifiedAddress);
    res.json({ success: true, transactionId: txId });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/gifts/refuse
router.post("/refuse", verifySignature, async (req, res) => {
  try {
    await refuseGift(req.verifiedData, req.verifiedAddress);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
