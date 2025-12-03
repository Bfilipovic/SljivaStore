import express from "express";
import { verifySignature } from "../utils/verifySignature.js";
import { checkMaintenanceMode } from "../utils/checkMaintenanceMode.js";
import {
  createGift,
  getGiftsForAddress,
  getGiftsCreatedByAddress,
  claimGift,
  refuseGift,
  cancelGift,
} from "../services/giftService.js";

const router = express.Router();

// POST /api/gifts
router.post("/", verifySignature, checkMaintenanceMode, async (req, res) => {
  try {
    const giftId = await createGift(req.verifiedData, req.verifiedAddress, req.signature);
    res.json({ success: true, giftId });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/gifts/:address - Get gifts received by address
router.get("/:address", async (req, res) => {
  try {
    const gifts = await getGiftsForAddress(req.params.address);
    res.json({ success: true, gifts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/gifts/created/:address - Get gifts created by address
router.get("/created/:address", async (req, res) => {
  try {
    const gifts = await getGiftsCreatedByAddress(req.params.address);
    res.json({ success: true, gifts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/gifts/claim
router.post("/claim", verifySignature, checkMaintenanceMode, async (req, res) => {
  try {
    const txId = await claimGift(req.verifiedData, req.verifiedAddress, req.signature);
    res.json({ success: true, transactionId: txId });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/gifts/refuse
router.post("/refuse", verifySignature, checkMaintenanceMode, async (req, res) => {
  try {
    await refuseGift(req.verifiedData, req.verifiedAddress, req.signature);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/gifts/cancel
router.post("/cancel", verifySignature, checkMaintenanceMode, async (req, res) => {
  try {
    await cancelGift(req.verifiedData, req.verifiedAddress, req.signature);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
