// backend/services/arweaveQueueService.js
/**
 * Service: Arweave Upload Queue and Maintenance Mode
 * 
 * Handles:
 * - Queuing failed Arweave uploads for retry
 * - Managing maintenance mode when Arweave is down
 * - Tracking failed uploads to prevent data loss
 */

import connectDB from "../db.js";
import { logInfo, logError } from "../utils/logger.js";
import { ARWEAVE_QUEUE_STATUS } from "../utils/statusConstants.js";
import { _uploadTransactionToArweaveInternal } from "./arweaveService.js";

const MAINTENANCE_MODE_KEY = "arweave_maintenance_mode";
const FAILURES_BEFORE_MAINTENANCE = 3; // Enter maintenance after 3 consecutive failures

/**
 * Add a failed transaction to the upload queue
 * @param {Object} transactionData - The transaction data that failed to upload
 * @param {number} transactionNumber - Transaction number
 * @param {string|null} previousArweaveTxId - Previous Arweave transaction ID
 * @param {Error} error - The error that occurred
 */
export async function queueFailedUpload(transactionData, transactionNumber, previousArweaveTxId, error) {
  const db = await connectDB();
  const queueCol = db.collection("arweave_upload_queue");
  
  const queueItem = {
    transactionData: transactionData,
    transactionNumber: transactionNumber,
    previousArweaveTxId: previousArweaveTxId,
    error: error.message || String(error),
    errorStack: error.stack || null,
    queuedAt: new Date(),
    retryCount: 0,
    status: ARWEAVE_QUEUE_STATUS.PENDING,
    _id: transactionData._id, // Use transaction ID as queue item ID (unique)
  };
  
  // Use upsert to avoid duplicates
  await queueCol.updateOne(
    { _id: transactionData._id },
    { $set: queueItem },
    { upsert: true }
  );
  
  logInfo("[arweaveQueueService] Queued failed upload", {
    transactionId: transactionData._id,
    transactionNumber,
    error: error.message
  });
}

/**
 * Check if we should enter maintenance mode based on recent failures
 * @returns {Promise<boolean>} True if maintenance mode should be enabled
 */
export async function shouldEnterMaintenanceMode() {
  const db = await connectDB();
  const queueCol = db.collection("arweave_upload_queue");
  
  // Count recent failures (last 10 minutes)
  const recentCutoff = new Date(Date.now() - 10 * 60 * 1000);
  const recentFailures = await queueCol.countDocuments({
    queuedAt: { $gte: recentCutoff },
    status: ARWEAVE_QUEUE_STATUS.PENDING
  });
  
  // If we have multiple recent failures, enter maintenance mode
  return recentFailures >= FAILURES_BEFORE_MAINTENANCE;
}

/**
 * Set maintenance mode on or off
 * @param {boolean} enabled - Whether maintenance mode should be enabled
 * @param {string} reason - Reason for the maintenance mode change
 */
export async function setMaintenanceMode(enabled, reason = "") {
  const db = await connectDB();
  const maintenanceCol = db.collection("system_state");
  
  await maintenanceCol.updateOne(
    { _id: MAINTENANCE_MODE_KEY },
    {
      $set: {
        _id: MAINTENANCE_MODE_KEY,
        enabled: enabled,
        reason: reason || (enabled ? "Arweave upload failures detected" : "Arweave uploads resumed"),
        updatedAt: new Date(),
      }
    },
    { upsert: true }
  );
  
  logInfo(`[arweaveQueueService] Maintenance mode ${enabled ? 'ENABLED' : 'DISABLED'}`, { reason });
}

/**
 * Check if maintenance mode is currently enabled
 * @returns {Promise<boolean>} True if maintenance mode is enabled
 */
export async function isMaintenanceModeEnabled() {
  const db = await connectDB();
  const maintenanceCol = db.collection("system_state");
  
  const state = await maintenanceCol.findOne({ _id: MAINTENANCE_MODE_KEY });
  return state?.enabled === true;
}

/**
 * Get maintenance mode details
 * @returns {Promise<{enabled: boolean, reason: string, updatedAt: Date}|null>}
 */
export async function getMaintenanceModeStatus() {
  const db = await connectDB();
  const maintenanceCol = db.collection("system_state");
  
  const state = await maintenanceCol.findOne({ _id: MAINTENANCE_MODE_KEY });
  if (!state) return { enabled: false, reason: "", updatedAt: null };
  
  return {
    enabled: state.enabled || false,
    reason: state.reason || "",
    updatedAt: state.updatedAt || null,
  };
}

/**
 * Get pending queue items
 * @param {number} limit - Maximum number of items to return
 * @returns {Promise<Array>} Array of pending queue items
 */
export async function getPendingQueueItems(limit = 100) {
  const db = await connectDB();
  const queueCol = db.collection("arweave_upload_queue");
  
  return queueCol
    .find({ status: ARWEAVE_QUEUE_STATUS.PENDING })
    .sort({ queuedAt: 1 }) // Oldest first
    .limit(limit)
    .toArray();
}

/**
 * Mark a queue item as successfully uploaded
 * @param {string} transactionId - Transaction ID
 * @param {string} arweaveTxId - Arweave transaction ID
 */
export async function markQueueItemSuccess(transactionId, arweaveTxId) {
  const db = await connectDB();
  const queueCol = db.collection("arweave_upload_queue");
  const txCol = db.collection("transactions");
  
  // Update queue item
  await queueCol.updateOne(
    { _id: transactionId },
    {
      $set: {
        status: ARWEAVE_QUEUE_STATUS.SUCCESS,
        arweaveTxId: arweaveTxId,
        completedAt: new Date(),
      }
    }
  );
  
  // Update transaction in database
  await txCol.updateOne(
    { _id: transactionId },
    { $set: { arweaveTxId: arweaveTxId } }
  );
  
  logInfo("[arweaveQueueService] Queue item marked as success", {
    transactionId,
    arweaveTxId
  });
}

/**
 * Increment retry count for a queue item
 * @param {string} transactionId - Transaction ID
 */
export async function incrementRetryCount(transactionId) {
  const db = await connectDB();
  const queueCol = db.collection("arweave_upload_queue");
  
  await queueCol.updateOne(
    { _id: transactionId },
    { $inc: { retryCount: 1 } }
  );
}

/**
 * Get the current previous Arweave transaction ID without incrementing counter
 * @returns {Promise<string|null>} Previous Arweave transaction ID
 */
async function getCurrentPreviousArweaveTxId() {
  const db = await connectDB();
  const txCollection = db.collection("transactions");
  
  // Find the most recent transaction with arweaveTxId, sorted by transaction_number DESC
  // This ensures we link to the transaction with the highest transaction_number that was uploaded
  const previousTx = await txCollection.findOne(
    { 
      transaction_number: { $exists: true, $type: "number" },
      arweaveTxId: { $exists: true, $ne: null, $type: "string" }
    },
    { sort: { transaction_number: -1 } }
  );
  
  return previousTx?.arweaveTxId || null;
}

/**
 * Retry uploading a queued transaction
 * @param {Object} queueItem - Queue item to retry
 * @returns {Promise<{success: boolean, arweaveTxId?: string, error?: string}>}
 */
export async function retryUpload(queueItem) {
  try {
    await incrementRetryCount(queueItem._id);
    
    // Get current previous transaction ID (may have changed if other transactions succeeded)
    // Use stored value as fallback, but prefer current value if available
    const currentPreviousId = await getCurrentPreviousArweaveTxId();
    const previousId = currentPreviousId || queueItem.previousArweaveTxId;
    
    // Use the internal upload function directly to avoid double-queueing
    const arweaveTxId = await _uploadTransactionToArweaveInternal(
      queueItem.transactionData,
      queueItem.transactionNumber,
      previousId
    );
    
    await markQueueItemSuccess(queueItem._id, arweaveTxId);
    
    return { success: true, arweaveTxId };
  } catch (error) {
    logError("[arweaveQueueService] Retry upload failed", {
      transactionId: queueItem._id,
      error: error.message,
      retryCount: queueItem.retryCount + 1
    });
    
    return { success: false, error: error.message };
  }
}

/**
 * Process pending queue items
 * @param {number} batchSize - Number of items to process in this batch
 * @returns {Promise<{processed: number, succeeded: number, failed: number}>}
 */
export async function processQueue(batchSize = 10) {
  const pendingItems = await getPendingQueueItems(batchSize);
  
  if (pendingItems.length === 0) {
    return { processed: 0, succeeded: 0, failed: 0 };
  }
  
  let succeeded = 0;
  let failed = 0;
  
  for (const item of pendingItems) {
    const result = await retryUpload(item);
    if (result.success) {
      succeeded++;
    } else {
      failed++;
    }
    
    // Small delay between retries to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // If we succeeded in processing all items, check if we should exit maintenance mode
  if (succeeded > 0 && failed === 0 && pendingItems.length === succeeded) {
    const remainingPending = await getPendingQueueItems(1);
    if (remainingPending.length === 0) {
      // All queue items processed successfully, exit maintenance mode
      await setMaintenanceMode(false, "All queued uploads completed successfully");
    }
  }
  
  return {
    processed: pendingItems.length,
    succeeded,
    failed
  };
}

