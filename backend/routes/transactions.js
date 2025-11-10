import express from "express";
import { verifySignature } from "../utils/verifySignature.js";
import {
  createTransaction,
  getPartialTransactionsByPart,
} from "../services/transactionService.js";

const router = express.Router();

// POST /api/transactions
router.post("/", verifySignature, async (req, res) => {
  try {
    const txId = await createTransaction(req.verifiedData, req.verifiedAddress);
    res.json({ success: true, transactionId: txId });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/transactions/partial/:partHash
router.get("/partial/:partHash", async (req, res) => {
  try {
    const { items } = await getPartialTransactionsByPart(req.params.partHash);
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
