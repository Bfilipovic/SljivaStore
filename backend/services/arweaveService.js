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
import { logInfo } from "../utils/logger.js";

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
 * @returns {Promise<{transactionNumber: number, previousArweaveTxId: string|null}>}
 */
export async function getNextTransactionInfo() {
  const db = await connectDB();
  const txCollection = db.collection("transactions");

  // Get the highest transaction number
  const lastTx = await txCollection
    .findOne(
      { transaction_number: { $exists: true } },
      { sort: { transaction_number: -1 } }
    );

  const transactionNumber = lastTx ? (lastTx.transaction_number + 1) : 1;
  
  // Get the previous transaction that has an Arweave ID (for linking)
  // Find the most recent transaction with arweaveTxId, sorted by transaction_number
  const previousTx = await txCollection
    .findOne(
      { 
        transaction_number: { $exists: true },
        arweaveTxId: { $exists: true, $ne: null }
      },
      { sort: { transaction_number: -1 } }
    );
  
  const previousArweaveTxId = previousTx?.arweaveTxId || null;

  return { transactionNumber, previousArweaveTxId };
}

/**
 * Upload a transaction to Arweave
 * 
 * The uploaded data includes:
 * - transactionId: The hash-based transaction ID (local _id) for verification
 * - All transaction fields (type, buyer, seller, chainTx, etc.)
 * - transaction_number: Sequential transaction number
 * - previous_arweave_tx: Link to previous Arweave transaction
 * - chainTx: Blockchain transaction hash (if applicable)
 * 
 * Users can verify the transaction by:
 * 1. Retrieving the transaction from Arweave
 * 2. Extracting all fields except transactionId and previous_arweave_tx
 * 3. Using hashableTransaction() and hashObject() to recalculate the hash
 * 4. Comparing the calculated hash to the transactionId field
 * 
 * @param {Object} transactionData - The transaction data to upload
 * @param {number} transactionNumber - Sequential transaction number
 * @param {string|null} previousArweaveTxId - ID of previous Arweave transaction
 * @returns {Promise<string>} Arweave transaction ID
 */
export async function uploadTransactionToArweave(transactionData, transactionNumber, previousArweaveTxId) {
  const { arweave: arw, wallet: w } = await initializeArweave();

  // Prepare the data to upload - exclude MongoDB-specific fields (_id, arweaveTxId)
  // But include _id as transactionId so users can verify the hash
  const { _id, arweaveTxId, ...cleanData } = transactionData;
  
  // Ensure chainTx is explicitly included (can be null for mints/off-chain gifts)
  const chainTx = transactionData.chainTx !== null && transactionData.chainTx !== undefined 
    ? String(transactionData.chainTx) 
    : null;
  
  const dataToUpload = {
    ...cleanData,
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
  transaction.addTag("App-Name", "SljivaStore");
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

