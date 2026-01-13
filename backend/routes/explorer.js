import express from "express";
import { getPartById, getPartsByTransactionId } from "../services/partService.js";
import {
  getTransactionById,
  getTransactionByChainTx,
  getPartialTransactionsByPart,
  getPartialTransactionsByTransactionId,
  getPartialTransactionsByChainTx,
  getLastTransaction,
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
 * 
 * IMPORTANT: Must include ALL standardized fields for hash verification to work.
 * All transaction types now have the same structure with consistent fields.
 */
function formatTransaction(transaction) {
  if (!transaction) return null;
  
  const txType = String(transaction.type || "TRANSACTION");
  
  // Handle different transaction types for buyer/seller/giver/receiver mapping
  const isGiftType = txType === "GIFT" || txType === "GIFT_CREATE" || txType === "GIFT_CLAIM" || txType === "GIFT_REFUSE" || txType === "GIFT_CANCEL";
  const isMint = txType === "MINT";
  const isListingCreate = txType === "LISTING_CREATE";
  const isListingCancel = txType === "LISTING_CANCEL";
  
  let buyer, seller;
  if (isGiftType) {
    buyer = transaction.receiver || "";
    seller = transaction.giver || "";
  } else if (isMint) {
    // For MINT transactions, minter is both buyer and seller
    buyer = transaction.buyer || transaction.seller || "";
    seller = transaction.seller || transaction.buyer || "";
  } else {
    // Regular TRANSACTION, NFT_BUY, LISTING_CREATE, LISTING_CANCEL
    buyer = transaction.buyer || "";
    seller = transaction.seller || "";
  }
  
  // Include ALL standardized fields for hash verification
  const formatted = {
    _id: String(transaction._id || ""),
    type: txType,
    transaction_number: transaction.transaction_number !== undefined ? Number(transaction.transaction_number) : undefined,
    // Entity references (null if not present)
    listingId: transaction.listingId !== null && transaction.listingId !== undefined ? String(transaction.listingId) : null,
    reservationId: transaction.reservationId !== null && transaction.reservationId !== undefined ? String(transaction.reservationId) : null,
    giftId: transaction.giftId !== null && transaction.giftId !== undefined ? String(transaction.giftId) : null,
    // NFT/Part fields
    nftId: transaction.nftId !== null && transaction.nftId !== undefined ? String(transaction.nftId) : null,
    quantity: transaction.quantity !== undefined ? Number(transaction.quantity) : 0,
    // Party fields
    buyer: transaction.buyer !== null && transaction.buyer !== undefined ? String(transaction.buyer).toLowerCase() : null,
    seller: transaction.seller !== null && transaction.seller !== undefined ? String(transaction.seller).toLowerCase() : null,
    giver: transaction.giver !== null && transaction.giver !== undefined ? String(transaction.giver).toLowerCase() : null,
    receiver: transaction.receiver !== null && transaction.receiver !== undefined ? String(transaction.receiver).toLowerCase() : null,
    // Chain transaction fields
    chainTx: transaction.chainTx !== null && transaction.chainTx !== undefined ? String(transaction.chainTx) : null,
    currency: transaction.currency !== null && transaction.currency !== undefined ? String(transaction.currency) : null,
    amount: transaction.amount !== null && transaction.amount !== undefined ? String(transaction.amount) : null,
    // Listing-specific fields
    price: transaction.price !== null && transaction.price !== undefined ? String(transaction.price) : null,
    sellerWallets: (transaction.sellerWallets && typeof transaction.sellerWallets === 'object' && Object.keys(transaction.sellerWallets).length > 0) 
      ? transaction.sellerWallets 
      : null,
    bundleSale: transaction.bundleSale !== null && transaction.bundleSale !== undefined
      ? (transaction.bundleSale === true || transaction.bundleSale === "true")
      : null,
    // Metadata fields
    arweaveTxId: transaction.arweaveTxId ? String(transaction.arweaveTxId) : undefined,
    timestamp: formatTimestamp(transaction.timestamp),
    // Signature fields
    signer: transaction.signer !== null && transaction.signer !== undefined ? String(transaction.signer).toLowerCase() : null,
    signature: transaction.signature !== null && transaction.signature !== undefined ? String(transaction.signature) : null,
  };
  
  return formatted;
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

// GET /api/explorer/last-transaction
router.get("/last-transaction", async (req, res) => {
  const startTime = Date.now();
  try {
    const lastTransaction = await getLastTransaction();

    if (!lastTransaction) {
      logQuery(req, startTime, 404);
      // Disable caching for 404 as well
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
      return res.status(404).json({ error: "No transactions found" });
    }

    const response = {
      transaction: formatTransaction(lastTransaction),
    };

    // Disable caching - always return fresh data since transactions change frequently
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");

    logQuery(req, startTime, 200);
    res.json(response);
  } catch (err) {
    logQuery(req, startTime, 500);
    console.error("[Explorer API] Error in /last-transaction:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;

