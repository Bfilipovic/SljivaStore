import express from "express";
import { getPartById } from "../services/partService.js";
import {
  getTransactionById,
  getTransactionByChainTx,
  getPartialTransactionsByPart,
} from "../services/transactionService.js";

const router = express.Router();

function parsePagination(query) {
  const limit = Math.max(1, Math.min(100, parseInt(query.limit ?? "50", 10) || 50));
  const page = Math.max(0, parseInt(query.page ?? "0", 10) || 0);
  const skip = Math.max(0, parseInt(query.skip ?? String(page * limit), 10) || page * limit);
  return { skip, limit };
}

// GET /api/explorer/parts/:partHash
router.get("/parts/:partHash", async (req, res) => {
  try {
    const partHash = req.params.partHash;
    const part = await getPartById(partHash);

    if (!part) {
      return res.status(404).json({ error: "Part not found" });
    }

    const { skip, limit } = parsePagination(req.query);
    const { items, total } = await getPartialTransactionsByPart(partHash, { skip, limit });
    res.json({
      part,
      partialTransactions: items,
      pagination: { total, skip, limit }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/explorer/transactions/id/:txId
router.get("/transactions/id/:txId", async (req, res) => {
  try {
    const txId = req.params.txId;
    const transaction = await getTransactionById(txId);

    if (!transaction) {
      return res.status(404).json({ error: "Transaction not found" });
    }

    res.json({
      transaction,
      partialTransactions: [],
      pagination: { total: 0, skip: 0, limit: 0 }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/explorer/transactions/chain/:chainTx
router.get("/transactions/chain/:chainTx", async (req, res) => {
  try {
    const chainTx = req.params.chainTx;
    const transaction = await getTransactionByChainTx(chainTx);

    if (!transaction) {
      return res.status(404).json({ error: "Transaction not found" });
    }

    res.json({
      transaction,
      partialTransactions: [],
      pagination: { total: 0, skip: 0, limit: 0 }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/explorer/partial-transactions/part/:partHash
router.get("/partial-transactions/part/:partHash", async (req, res) => {
  try {
    const { skip, limit } = parsePagination(req.query);
    const { items, total } = await getPartialTransactionsByPart(req.params.partHash, { skip, limit });
    res.json({
      partialTransactions: items,
      pagination: { total, skip, limit }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

