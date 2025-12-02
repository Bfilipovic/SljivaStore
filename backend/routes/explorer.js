import express from "express";
import { getPartById, getPartsByTransactionId } from "../services/partService.js";
import {
  getTransactionById,
  getTransactionByChainTx,
  getPartialTransactionsByPart,
  getPartialTransactionsByTransactionId,
  getPartialTransactionsByChainTx,
} from "../services/transactionService.js";

const router = express.Router();

/**
 * Parse pagination parameters from query string
 */
function parsePagination(query) {
  const limit = Math.max(1, Math.min(100, parseInt(query.limit ?? "50", 10) || 50));
  const page = Math.max(0, parseInt(query.page ?? "0", 10) || 0);
  const skip = Math.max(0, parseInt(query.skip ?? String(page * limit), 10) || page * limit);
  return { skip, limit };
}

/**
 * Format timestamp to ISO string for Explorer API
 */
function formatTimestamp(timestamp) {
  if (!timestamp) return null;
  if (typeof timestamp === "string") return timestamp;
  if (timestamp instanceof Date) return timestamp.toISOString();
  return new Date(timestamp).toISOString();
}

/**
 * Format part document for Explorer API
 */
function formatPart(part) {
  if (!part) return null;
  return {
    _id: String(part._id || ""),
    part_no: Number(part.part_no || 0),
    parent_hash: String(part.parent_hash || ""),
    owner: String(part.owner || ""),
    listing: part.listing ? String(part.listing) : null,
  };
}

/**
 * Format transaction document for Explorer API
 */
function formatTransaction(transaction) {
  if (!transaction) return null;
  
  // Handle GIFT transactions: map giver/receiver to seller/buyer
  const isGift = transaction.type === "GIFT";
  const isMint = transaction.type === "MINT";
  
  let buyer, seller;
  if (isGift) {
    buyer = transaction.receiver || "";
    seller = transaction.giver || "";
  } else if (isMint) {
    // For MINT transactions, minter is both buyer and seller
    buyer = transaction.buyer || transaction.seller || "";
    seller = transaction.seller || transaction.buyer || "";
  } else {
    // Regular TRANSACTION
    buyer = transaction.buyer || "";
    seller = transaction.seller || "";
  }
  
  return {
    _id: String(transaction._id || ""),
    type: String(transaction.type || "TRANSACTION"),
    listingId: String(transaction.listingId || ""),
    reservationId: String(transaction.reservationId || ""),
    buyer: String(buyer),
    seller: String(seller),
    nftId: String(transaction.nftId || ""),
    quantity: Number(transaction.quantity || 0),
    chainTx: String(transaction.chainTx || ""),
    currency: String(transaction.currency || ""),
    amount: String(transaction.amount || ""),
    timestamp: formatTimestamp(transaction.timestamp),
  };
}

/**
 * Format partial transaction document for Explorer API
 */
function formatPartialTransaction(partial) {
  if (!partial) return null;
  // Use transaction field (preferred), fall back to txId for backward compatibility
  const transactionId = partial.transaction ? String(partial.transaction) : (partial.txId ? String(partial.txId) : undefined);
  return {
    part: String(partial.part || ""),
    transaction: transactionId,
    from: String(partial.from || ""),
    to: String(partial.to || ""),
    nftId: String(partial.nftId || ""),
    chainTx: String(partial.chainTx || ""),
    currency: String(partial.currency || ""),
    amount: String(partial.amount || ""),
    timestamp: formatTimestamp(partial.timestamp),
  };
}

/**
 * Log Explorer API query with timing
 */
function logQuery(req, startTime, statusCode = 200) {
  const duration = Date.now() - startTime;
  const method = req.method;
  const path = req.path;
  const params = Object.keys(req.params).length > 0 ? ` params=${JSON.stringify(req.params)}` : "";
  const query = Object.keys(req.query).length > 0 ? ` query=${JSON.stringify(req.query)}` : "";
  console.log(
    `[Explorer API] ${method} ${path}${params}${query} → ${statusCode} (${duration}ms)`
  );
}

// GET /api/explorer/parts/:partHash
router.get("/parts/:partHash", async (req, res) => {
  const startTime = Date.now();
  try {
    const partHash = req.params.partHash;
    const part = await getPartById(partHash);

    if (!part) {
      logQuery(req, startTime, 404);
      return res.status(404).json({ error: "Part not found" });
    }

    const { skip, limit } = parsePagination(req.query);
    // Use the actual part _id (which might differ in case from the search parameter)
    const actualPartId = String(part._id || partHash);
    const { items, total } = await getPartialTransactionsByPart(actualPartId, { skip, limit });

    const response = {
      part: formatPart(part),
      partialTransactions: items.map(formatPartialTransaction),
      pagination: { total, skip, limit },
    };

    logQuery(req, startTime, 200);
    res.json(response);
  } catch (err) {
    logQuery(req, startTime, 500);
    console.error("[Explorer API] Error in /parts/:partHash:", err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/explorer/transactions/id/:txId
router.get("/transactions/id/:txId", async (req, res) => {
  const startTime = Date.now();
  try {
    const txId = req.params.txId;
    const transaction = await getTransactionById(txId);

    if (!transaction) {
      logQuery(req, startTime, 404);
      return res.status(404).json({ error: "Transaction not found" });
    }

    const { skip, limit } = parsePagination(req.query);
    const { parts, total } = await getPartsByTransactionId(txId, { skip, limit });

    const response = {
      transaction: formatTransaction(transaction),
      parts: parts.map(formatPart),
      pagination: { total, skip, limit },
      partialTransactions: [],
    };

    logQuery(req, startTime, 200);
    res.json(response);
  } catch (err) {
    logQuery(req, startTime, 500);
    console.error("[Explorer API] Error in /transactions/id/:txId:", err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/explorer/transactions/chain/:chainTx
router.get("/transactions/chain/:chainTx", async (req, res) => {
  const startTime = Date.now();
  try {
    const chainTx = req.params.chainTx;
    const transaction = await getTransactionByChainTx(chainTx);

    if (!transaction) {
      logQuery(req, startTime, 404);
      return res.status(404).json({ error: "Transaction not found" });
    }

    const { skip, limit } = parsePagination(req.query);
    const txId = transaction._id?.toString() || transaction._id;
    const { parts, total } = await getPartsByTransactionId(txId, { skip, limit });

    const response = {
      transaction: formatTransaction(transaction),
      parts: parts.map(formatPart),
      pagination: { total, skip, limit },
      partialTransactions: [],
    };

    logQuery(req, startTime, 200);
    res.json(response);
  } catch (err) {
    logQuery(req, startTime, 500);
    console.error("[Explorer API] Error in /transactions/chain/:chainTx:", err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/explorer/partial-transactions/part/:partHash
router.get("/partial-transactions/part/:partHash", async (req, res) => {
  const startTime = Date.now();
  try {
    const { skip, limit } = parsePagination(req.query);
    const { items, total } = await getPartialTransactionsByPart(req.params.partHash, { skip, limit });

    const response = {
      partialTransactions: items.map(formatPartialTransaction),
      pagination: { total, skip, limit },
    };

    logQuery(req, startTime, 200);
    res.json(response);
  } catch (err) {
    logQuery(req, startTime, 500);
    console.error("[Explorer API] Error in /partial-transactions/part/:partHash:", err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/explorer/partial-transactions/id/:txId
router.get("/partial-transactions/id/:txId", async (req, res) => {
  const startTime = Date.now();
  try {
    const { skip, limit } = parsePagination(req.query);
    const { items, total } = await getPartialTransactionsByTransactionId(req.params.txId, { skip, limit });

    const response = {
      partialTransactions: items.map(formatPartialTransaction),
      pagination: { total, skip, limit },
    };

    logQuery(req, startTime, 200);
    res.json(response);
  } catch (err) {
    logQuery(req, startTime, 500);
    console.error("[Explorer API] Error in /partial-transactions/id/:txId:", err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/explorer/partial-transactions/chain/:chainTx
router.get("/partial-transactions/chain/:chainTx", async (req, res) => {
  const startTime = Date.now();
  try {
    const { skip, limit } = parsePagination(req.query);
    const { items, total } = await getPartialTransactionsByChainTx(req.params.chainTx, { skip, limit });

    const response = {
      partialTransactions: items.map(formatPartialTransaction),
      pagination: { total, skip, limit },
    };

    logQuery(req, startTime, 200);
    res.json(response);
  } catch (err) {
    logQuery(req, startTime, 500);
    console.error("[Explorer API] Error in /partial-transactions/chain/:chainTx:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;

