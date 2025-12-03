// backend/utils/checkMaintenanceMode.js
/**
 * Middleware to check if Arweave maintenance mode is enabled
 * Blocks state-changing operations when maintenance mode is active
 */

import { isMaintenanceModeEnabled, getMaintenanceModeStatus } from "../services/arweaveQueueService.js";
import { logInfo } from "./logger.js";

/**
 * Middleware to check maintenance mode before processing requests
 * Returns 503 Service Unavailable if maintenance mode is enabled
 */
export async function checkMaintenanceMode(req, res, next) {
  try {
    const maintenanceStatus = await getMaintenanceModeStatus();
    
    if (maintenanceStatus.enabled) {
      logInfo("[checkMaintenanceMode] Request blocked - maintenance mode enabled", {
        path: req.path,
        reason: maintenanceStatus.reason
      });
      
      return res.status(503).json({
        error: "Service temporarily unavailable",
        maintenanceMode: true,
        message: "Arweave is currently under maintenance. Please try again later.",
        reason: maintenanceStatus.reason || "Arweave upload failures detected"
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

