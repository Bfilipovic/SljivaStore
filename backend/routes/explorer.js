import express from "express";
import { getPartById } from "../services/partService.js";
import {
  getTransactionById,
  getTransactionByChainTx,
  getPartialTransactionsByPart,
  getPartialTransactionsByTransactionId,
  getPartialTransactionsByChainTx,
} from "../services/transactionService.js";

const router = express.Router();

// GET /api/explorer/parts/:partHash
router.get("/parts/:partHash", async (req, res) => {
  try {
    const partHash = req.params.partHash;
    const part = await getPartById(partHash);

    if (!part) {
      return res.status(404).json({ error: "Part not found" });
    }

    const partialTransactions = await getPartialTransactionsByPart(partHash);
    res.json({ part, partialTransactions });
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

    const partialTransactions = await getPartialTransactionsByTransactionId(txId);
    res.json({ transaction, partialTransactions });
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

    const partialTransactions = await getPartialTransactionsByChainTx(chainTx);
    res.json({ transaction, partialTransactions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/explorer/partial-transactions/part/:partHash
router.get("/partial-transactions/part/:partHash", async (req, res) => {
  try {
    const partialTransactions = await getPartialTransactionsByPart(req.params.partHash);
    res.json({ partialTransactions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/explorer/partial-transactions/id/:txId
router.get("/partial-transactions/id/:txId", async (req, res) => {
  try {
    const partialTransactions = await getPartialTransactionsByTransactionId(req.params.txId);
    res.json({ partialTransactions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/explorer/partial-transactions/chain/:chainTx
router.get("/partial-transactions/chain/:chainTx", async (req, res) => {
  try {
    const partialTransactions = await getPartialTransactionsByChainTx(req.params.chainTx);
    res.json({ partialTransactions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

