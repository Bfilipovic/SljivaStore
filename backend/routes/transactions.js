import express from "express";
import { verifySignature } from "../utils/verifySignature.js";
import { checkMaintenanceMode } from "../utils/checkMaintenanceMode.js";
import {
  createTransaction,
  getPartialTransactionsByPart,
} from "../services/transactionService.js";
import connectDB from "../db.js";

const router = express.Router();

// POST /api/transactions
router.post("/", verifySignature, checkMaintenanceMode, async (req, res) => {
  try {
    const txId = await createTransaction(req.verifiedData, req.verifiedAddress, req.signature);
    res.json({ success: true, transactionId: txId });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/transactions/partial/:partHash
router.get("/partial/:partHash", async (req, res) => {
  try {
    const { items } = await getPartialTransactionsByPart(req.params.partHash);
    
    // Fetch parent transaction types for each partial transaction
    const db = await connectDB();
    const txCollection = db.collection("transactions");
    
    // Get unique transaction IDs
    const txIds = [...new Set(items.map(pt => pt.transaction || pt.txId).filter(Boolean))];
    
    // Fetch transaction types
    const transactions = await txCollection.find({
      _id: { $in: txIds }
    }).project({ _id: 1, type: 1 }).toArray();
    
    const txTypeMap = {};
    transactions.forEach(tx => {
      const txId = String(tx._id);
      txTypeMap[txId] = tx.type || "TRANSACTION";
    });
    
    // Add transaction type to each partial transaction
    const enriched = items.map(pt => {
      const txId = String(pt.transaction || pt.txId || "");
      return {
        ...pt,
        transactionType: txTypeMap[txId] || "TRANSACTION"
      };
    });
    
    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
