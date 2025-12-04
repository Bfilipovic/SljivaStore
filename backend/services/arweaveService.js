// backend/services/arweaveService.js
/**
 * Service: Arweave Integration
 * 
 * Handles uploading transactions to Arweave for permanent storage.
 * Each transaction includes a link to the previous Arweave transaction.
 */

import Arweave from "arweave";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import connectDB from "../db.js";
import { logInfo, logError } from "../utils/logger.js";
import {
  queueFailedUpload,
  shouldEnterMaintenanceMode,
  setMaintenanceMode,
  isMaintenanceModeEnabled,
} from "./arweaveQueueService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let arweave = null;
let wallet = null;

/**
 * Initialize Arweave connection and load wallet
 */
async function initializeArweave() {
  if (arweave && wallet) {
    return { arweave, wallet };
  }

  // Initialize Arweave (default to mainnet, can be configured via env)
  const gateway = process.env.ARWEAVE_GATEWAY || "https://arweave.net";
  arweave = Arweave.init({
    host: new URL(gateway).hostname,
    port: new URL(gateway).port || (gateway.includes("https") ? 443 : 80),
    protocol: new URL(gateway).protocol.replace(":", ""),
  });

  // Load wallet keyfile
  const keyfilePath = path.join(__dirname, "..", "90Bf4dnKxkbLeOzJDua3axBqHn_i0WtOsoN9A2uzN6E.json");
  
  if (!fs.existsSync(keyfilePath)) {
    throw new Error(`Arweave keyfile not found at: ${keyfilePath}`);
  }

  const keyfileContent = fs.readFileSync(keyfilePath, "utf-8");
  wallet = JSON.parse(keyfileContent);

  logInfo("[arweaveService] Arweave initialized", { gateway });
  
  return { arweave, wallet };
}

/**
 * Get the next transaction number and the previous Arweave transaction ID
 * Uses atomic counter to prevent race conditions when multiple transactions are created simultaneously.
 * @returns {Promise<{transactionNumber: number, previousArweaveTxId: string|null}>}
 */
export async function getNextTransactionInfo() {
  const db = await connectDB();
  const counterCollection = db.collection("counters");
  const txCollection = db.collection("transactions");

  // CRITICAL: Atomic increment prevents race conditions
  // We only sync UP (never down) to prevent counter from going backwards
  
  // Get max existing transaction number
  const lastTx = await txCollection.findOne(
    { transaction_number: { $exists: true, $type: "number" } },
    { sort: { transaction_number: -1 } }
  );
  
  const maxExistingNumber = lastTx?.transaction_number || 0;
  
  // Get current counter value
  let currentCounter = await counterCollection.findOne({ _id: "transaction_number" });
  const currentCounterValue = currentCounter?.value || 0;
  
  // CRITICAL: Ensure counter exists and is initialized before incrementing
  // Initialize to maxExistingNumber if counter doesn't exist or is behind
  if (!currentCounter || maxExistingNumber > currentCounterValue) {
    // Counter doesn't exist or is behind - initialize/sync it to match max existing
    await counterCollection.updateOne(
      { _id: "transaction_number" },
      { $set: { value: maxExistingNumber } },
      { upsert: true }
    );
    logInfo("[arweaveService] Counter initialized/synced UP", { 
      from: currentCounterValue, 
      to: maxExistingNumber 
    });
  }

  // Atomic increment of transaction number using findOneAndUpdate
  // This ensures no two transactions get the same number, even under concurrent load
  const counterResult = await counterCollection.findOneAndUpdate(
    { _id: "transaction_number" },
    { $inc: { value: 1 } },
    { returnDocument: "after", upsert: false }
  );

  // Extract transaction number from the result
  // MongoDB findOneAndUpdate returns the document directly (not wrapped)
  // So counterResult = { _id: "transaction_number", value: number }
  let transactionNumber = null;
  
  if (counterResult && typeof counterResult.value === 'number') {
    transactionNumber = Number(counterResult.value);
  } else if (counterResult && counterResult.value && typeof counterResult.value.value === 'number') {
    // Fallback: in case the structure is different
    transactionNumber = Number(counterResult.value.value);
  }
  
  // Validate the transaction number
  if (!transactionNumber || !Number.isInteger(transactionNumber) || transactionNumber < 1) {
    logError("[arweaveService] Failed to get valid transaction number from findOneAndUpdate", {
      counterResult: counterResult,
      counterResultType: typeof counterResult,
      counterResultValue: counterResult?.value,
      counterResultValueType: typeof counterResult?.value,
      maxExistingNumber,
      currentCounterValue
    });
    
    // Fallback: read counter directly and increment manually (not atomic, but better than failing)
    const directCounter = await counterCollection.findOne({ _id: "transaction_number" });
    if (directCounter && typeof directCounter.value === 'number' && Number.isInteger(directCounter.value)) {
      transactionNumber = directCounter.value + 1;
      await counterCollection.updateOne(
        { _id: "transaction_number" },
        { $set: { value: transactionNumber } }
      );
      logInfo("[arweaveService] Used direct counter read/increment as fallback", { transactionNumber });
    } else {
      throw new Error(`Failed to get transaction number. Counter result: ${JSON.stringify(counterResult)}, Direct counter: ${JSON.stringify(directCounter)}`);
    }
  }
  
  // Get the previous transaction that has an Arweave ID (for linking)
  // Find the most recent transaction with arweaveTxId, sorted by transaction_number DESC
  // This ensures we link to the transaction with the highest transaction_number that was uploaded
  const previousTx = await txCollection
    .findOne(
      { 
        transaction_number: { $exists: true, $type: "number" },
        arweaveTxId: { $exists: true, $ne: null, $type: "string" }
      },
      { sort: { transaction_number: -1 } }
    );
  
  const previousArweaveTxId = previousTx?.arweaveTxId || null;

  logInfo("[arweaveService] getNextTransactionInfo", {
    transactionNumber,
    previousArweaveTxId: previousArweaveTxId || "null",
    previousTxNumber: previousTx?.transaction_number || "none",
    maxExistingBeforeIncrement: maxExistingNumber,
    counterBeforeIncrement: currentCounterValue
  });

  return { transactionNumber, previousArweaveTxId };
}

/**
 * Upload a transaction to Arweave (internal function - throws on failure)
 * Used directly by retry worker to avoid double-queueing
 * 
 * @param {Object} transactionData - The transaction data to upload
 * @param {number} transactionNumber - Sequential transaction number
 * @param {string|null} previousArweaveTxId - ID of previous Arweave transaction
 * @returns {Promise<string>} Arweave transaction ID
 * @throws {Error} If upload fails
 */
export async function _uploadTransactionToArweaveInternal(transactionData, transactionNumber, previousArweaveTxId) {
  const { arweave: arw, wallet: w } = await initializeArweave();

  // Prepare the data to upload - exclude MongoDB-specific fields (_id, arweaveTxId)
  // But include _id as transactionId so users can verify the hash
  // All other fields are included (type, signer, signature, transaction-specific fields, etc.)
  const { _id, arweaveTxId, ...cleanData } = transactionData;
  
  // Ensure chainTx is explicitly included (can be null for mints/off-chain gifts)
  const chainTx = transactionData.chainTx !== null && transactionData.chainTx !== undefined 
    ? String(transactionData.chainTx) 
    : null;
  
  const dataToUpload = {
    ...cleanData, // Includes all transaction fields: type, signer, signature, and type-specific fields
    transactionId: _id, // Include hash-based transaction ID for verification
    transaction_number: transactionNumber,
    previous_arweave_tx: previousArweaveTxId,
    chainTx: chainTx, // Explicitly include chainTx field
    timestamp: transactionData.timestamp instanceof Date 
      ? transactionData.timestamp.toISOString() 
      : new Date(transactionData.timestamp).toISOString(),
  };
  
  logInfo("[arweaveService] Data to upload includes", {
    type: cleanData.type || "TRANSACTION",
    transactionId: _id,
    chainTx: chainTx || "null",
    transaction_number: transactionNumber,
    hasChainTx: chainTx !== null
  });

  // Get wallet address and check balance
  const address = await arw.wallets.jwkToAddress(w);
  const balance = await arw.wallets.getBalance(address);
  const balanceInAR = arw.ar.winstonToAr(balance);
  
  // Estimate transaction cost
  const dataString = JSON.stringify(dataToUpload);
  const dataSize = Buffer.byteLength(dataString, "utf8");
  const estimatedCost = await arw.transactions.getPrice(dataSize);
  const estimatedCostInAR = arw.ar.winstonToAr(estimatedCost);
  
  logInfo("[arweaveService] Wallet and cost check", {
    address,
    balance: balanceInAR + " AR",
    dataSize: `${dataSize} bytes`,
    estimatedCost: estimatedCostInAR + " AR"
  });

  // Check balance but don't fail - just warn (in case balance check is wrong)
  if (parseFloat(balanceInAR) < parseFloat(estimatedCostInAR)) {
    logInfo("[arweaveService] Warning: Balance may be insufficient. Will attempt upload anyway.");
  }

  // Create transaction
  const transaction = await arw.createTransaction(
    {
      data: dataString,
    },
    w
  );

  // Add tags for easier searching
  transaction.addTag("Content-Type", "application/json");
  transaction.addTag("App-Name", "Nomin");
  transaction.addTag("Transaction-Number", String(transactionNumber));
  transaction.addTag("Transaction-Type", cleanData.type || "TRANSACTION");

  // Sign transaction
  await arw.transactions.sign(transaction, w);

  // Submit transaction
  try {
    const response = await arw.transactions.post(transaction);

    if (response.status === 200 || response.status === 208) {
      const txId = transaction.id;
      logInfo("[arweaveService] Transaction uploaded to Arweave", {
        arweaveTxId: txId,
        transactionNumber,
        previousArweaveTxId,
      });
      return txId;
    } else {
      // Try to get error message
      let errorMessage = `HTTP ${response.status}`;
      try {
        if (typeof response.text === 'function') {
          const errorText = await response.text();
          errorMessage = errorText || errorMessage;
        } else if (response.statusText) {
          errorMessage = response.statusText;
        }
      } catch (e) {
        logInfo("[arweaveService] Could not read error response", { error: e.message });
      }
      
      logInfo("[arweaveService] Arweave upload failed", {
        status: response.status,
        error: errorMessage,
        txId: transaction.id
      });
      
      throw new Error(`Failed to upload to Arweave: ${response.status} - ${errorMessage}`);
    }
  } catch (error) {
    // If it's already our error, re-throw it
    if (error.message.includes("Failed to upload to Arweave")) {
      throw error;
    }
    
    // Otherwise, wrap it with more context
    logInfo("[arweaveService] Exception during Arweave upload", {
      error: error.message,
      stack: error.stack
    });
    
    throw new Error(`Arweave upload exception: ${error.message}`);
  }
}

/**
 * Upload a transaction to Arweave with automatic queueing on failure
 * 
 * Supports all transaction types:
 * - MINT: NFT minting transactions
 * - LISTING_CREATE: Creating a listing for sale
 * - LISTING_CANCEL: Cancelling a listing
 * - NFT_BUY: Purchasing from a listing
 * - GIFT_CREATE: Creating a gift
 * - GIFT_CLAIM: Claiming a gift
 * - GIFT_REFUSE: Refusing a gift
 * - GIFT_CANCEL: Cancelling a gift
 * 
 * If upload fails:
 * - Transaction is queued for retry
 * - Maintenance mode may be enabled if multiple failures occur
 * - Error is thrown (transaction still saved to MongoDB)
 * 
 * @param {Object} transactionData - The transaction data to upload (includes type, fields, signer, signature)
 * @param {number} transactionNumber - Sequential transaction number
 * @param {string|null} previousArweaveTxId - ID of previous Arweave transaction
 * @returns {Promise<string>} Arweave transaction ID
 * @throws {Error} If upload fails (transaction is queued for retry)
 */
export async function uploadTransactionToArweave(transactionData, transactionNumber, previousArweaveTxId) {
  try {
    return await _uploadTransactionToArweaveInternal(transactionData, transactionNumber, previousArweaveTxId);
  } catch (error) {
    // Queue the failed upload for retry
    try {
      await queueFailedUpload(transactionData, transactionNumber, previousArweaveTxId, error);
      
      // Check if we should enter maintenance mode
      const shouldMaintain = await shouldEnterMaintenanceMode();
      if (shouldMaintain) {
        const isCurrentlyMaintained = await isMaintenanceModeEnabled();
        if (!isCurrentlyMaintained) {
          await setMaintenanceMode(true, `Multiple Arweave upload failures detected. ${error.message}`);
        }
      }
    } catch (queueError) {
      logError("[arweaveService] Failed to queue failed upload", {
        transactionId: transactionData._id,
        queueError: queueError.message
      });
      // Continue to throw original error even if queueing fails
    }
    
    // Re-throw original error
    throw error;
  }
}

/**
 * Get transaction from Arweave by transaction ID
 * @param {string} arweaveTxId - Arweave transaction ID
 * @returns {Promise<Object>} Transaction data from Arweave
 */
export async function getTransactionFromArweave(arweaveTxId) {
  const { arweave: arw } = await initializeArweave();

  const transaction = await arw.transactions.get(arweaveTxId);
  const data = JSON.parse(transaction.get("data", { decode: true, string: true }));

  return data;
}

