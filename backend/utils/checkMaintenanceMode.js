// backend/utils/checkMaintenanceMode.js
/**
 * Middleware to check if Arweave maintenance mode is enabled
 * Blocks state-changing operations when maintenance mode is active
 */

import { isMaintenanceModeEnabled, getMaintenanceModeStatus, getPendingQueueCount } from "../services/arweaveQueueService.js";
import { logInfo } from "./logger.js";

/**
 * Middleware to check maintenance mode before processing requests
 * Returns 503 Service Unavailable if maintenance mode is enabled
 */
export async function checkMaintenanceMode(req, res, next) {
  try {
    const maintenanceStatus = await getMaintenanceModeStatus();
    
    if (maintenanceStatus.enabled) {
      // Get pending upload count for better error message
      let pendingCount = 0;
      try {
        pendingCount = await getPendingQueueCount();
      } catch (err) {
        // If we can't get count, continue anyway
        logInfo("[checkMaintenanceMode] Could not get pending count", { error: err.message });
      }
      
      logInfo("[checkMaintenanceMode] Request blocked - maintenance mode enabled", {
        path: req.path,
        reason: maintenanceStatus.reason,
        pendingUploads: pendingCount
      });
      
      const message = pendingCount > 0
        ? `Arweave is currently under maintenance. ${pendingCount} upload(s) pending. Please try again later.`
        : "Arweave is currently under maintenance. Please try again later.";
      
      return res.status(503).json({
        error: "Service temporarily unavailable",
        maintenanceMode: true,
        message: message,
        reason: maintenanceStatus.reason || "Arweave upload failures detected",
        pendingUploads: pendingCount
      });
    }
    
    next();
  } catch (error) {
    // If we can't check maintenance mode, allow the request through
    // (better to allow than block if we're not sure)
    console.error("[checkMaintenanceMode] Error checking maintenance mode:", error);
    next();
  }
}

/**
 * Check if maintenance mode is enabled (non-middleware function)
 * @returns {Promise<boolean>} True if maintenance mode is enabled
 */
export async function isInMaintenanceMode() {
  try {
    return await isMaintenanceModeEnabled();
  } catch (error) {
    console.error("[checkMaintenanceMode] Error checking maintenance mode:", error);
    return false; // Default to not in maintenance if check fails
  }
}

