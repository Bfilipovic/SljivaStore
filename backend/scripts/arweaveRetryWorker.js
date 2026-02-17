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

import { 
  processQueue, 
  getMaintenanceModeStatus, 
  getPendingQueueItems, 
  setMaintenanceMode 
} from "../services/arweaveQueueService.js";
import { logInfo, logError } from "../utils/logger.js";

const RETRY_INTERVAL_MS = 30 * 1000; // Retry every 30 seconds (more aggressive)
const BATCH_SIZE = 10; // Process 10 items at a time (more efficient)

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
    
    // When in maintenance mode, process items in batches until queue is empty
    // This ensures we process all pending items, not just one batch
    let totalProcessed = 0;
    let totalSucceeded = 0;
    let totalFailed = 0;
    let hasMore = true;
    
    while (hasMore) {
      const result = await processQueue(BATCH_SIZE);
      totalProcessed += result.processed;
      totalSucceeded += result.succeeded;
      totalFailed += result.failed;
      
      // Check if there are more items to process
      const remainingPending = await getPendingQueueItems(1);
      hasMore = remainingPending.length > 0 && result.processed > 0;
      
      if (hasMore) {
        logInfo("[arweaveRetryWorker] More items remaining, processing next batch", {
          remaining: remainingPending.length
        });
      }
    }
    
    logInfo("[arweaveRetryWorker] Queue processing complete", {
      processed: totalProcessed,
      succeeded: totalSucceeded,
      failed: totalFailed
    });
    
    // Check if we should exit maintenance mode (processQueue already handles this)
    const newStatus = await getMaintenanceModeStatus();
    if (!newStatus.enabled) {
      logInfo("[arweaveRetryWorker] Maintenance mode disabled - uploads are working again");
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
  
  // Startup check: Re-enable maintenance mode if there are pending items
  try {
    const pendingItems = await getPendingQueueItems(1);
    const maintenanceStatus = await getMaintenanceModeStatus();
    
    if (pendingItems.length > 0 && !maintenanceStatus.enabled) {
      logInfo("[arweaveRetryWorker] Startup check: Found pending uploads, re-enabling maintenance mode", {
        pendingCount: pendingItems.length
      });
      await setMaintenanceMode(true, `Server restart detected ${pendingItems.length} pending upload(s) - maintenance mode restored`);
    } else if (pendingItems.length > 0) {
      logInfo("[arweaveRetryWorker] Startup check: Maintenance mode already active with pending uploads", {
        pendingCount: pendingItems.length
      });
    } else {
      logInfo("[arweaveRetryWorker] Startup check: No pending uploads found");
    }
  } catch (error) {
    logError("[arweaveRetryWorker] Error during startup check", {
      error: error.message
    });
  }
  
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

