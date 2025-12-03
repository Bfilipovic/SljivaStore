#!/usr/bin/env node
// backend/scripts/arweaveRetryWorker.js
/**
 * Background worker to retry failed Arweave uploads
 * 
 * Runs periodically to:
 * - Process queued failed uploads
 * - Exit maintenance mode when uploads succeed
 * 
 * Run this as a background process or scheduled task
 */

import { processQueue, getMaintenanceModeStatus } from "../services/arweaveQueueService.js";
import { logInfo, logError } from "../utils/logger.js";

const RETRY_INTERVAL_MS = 60 * 1000; // Retry every 60 seconds
const BATCH_SIZE = 5; // Process 5 items at a time

async function runRetryCycle() {
  try {
    const status = await getMaintenanceModeStatus();
    
    if (!status.enabled) {
      // Not in maintenance mode, check if there are any pending items anyway
      const result = await processQueue(BATCH_SIZE);
      if (result.processed > 0) {
        logInfo("[arweaveRetryWorker] Processed queue items (not in maintenance)", result);
      }
      return;
    }
    
    logInfo("[arweaveRetryWorker] Processing queue (maintenance mode active)", {
      enabled: status.enabled,
      reason: status.reason
    });
    
    const result = await processQueue(BATCH_SIZE);
    
    logInfo("[arweaveRetryWorker] Queue processing complete", result);
    
    // Check if we should exit maintenance mode
    if (result.succeeded > 0) {
      const newStatus = await getMaintenanceModeStatus();
      if (!newStatus.enabled) {
        logInfo("[arweaveRetryWorker] Maintenance mode disabled - uploads are working again");
      }
    }
  } catch (error) {
    logError("[arweaveRetryWorker] Error in retry cycle", {
      error: error.message,
      stack: error.stack
    });
  }
}

async function startWorker() {
  logInfo("[arweaveRetryWorker] Starting Arweave retry worker", {
    interval: `${RETRY_INTERVAL_MS / 1000}s`,
    batchSize: BATCH_SIZE
  });
  
  // Run immediately on startup
  await runRetryCycle();
  
  // Then run periodically
  setInterval(runRetryCycle, RETRY_INTERVAL_MS);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  startWorker().catch(error => {
    logError("[arweaveRetryWorker] Fatal error starting worker", error);
    process.exit(1);
  });
}

export { startWorker, runRetryCycle };

