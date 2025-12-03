// frontend/src/lib/maintenance.ts
/**
 * Maintenance mode utilities for frontend
 */

import { apiFetch } from "./api";

export interface MaintenanceStatus {
  maintenanceMode: boolean;
  reason: string;
  updatedAt: string | null;
  pendingUploads: number;
}

let cachedStatus: MaintenanceStatus | null = null;
let cacheExpiry: number = 0;
const CACHE_DURATION_MS = 5000; // Cache for 5 seconds

/**
 * Check if system is in maintenance mode
 * @returns {Promise<MaintenanceStatus>}
 */
export async function checkMaintenanceMode(): Promise<MaintenanceStatus> {
  const now = Date.now();
  
  // Use cached status if still valid
  if (cachedStatus && now < cacheExpiry) {
    return cachedStatus;
  }
  
  try {
    const res = await apiFetch("/status/maintenance");
    const status = await res.json() as MaintenanceStatus;
    
    // Cache the result
    cachedStatus = status;
    cacheExpiry = now + CACHE_DURATION_MS;
    
    return status;
  } catch (error) {
    // If we can't check, assume not in maintenance
    // (better to allow operations than block if unsure)
    console.error("[maintenance] Failed to check maintenance status:", error);
    return {
      maintenanceMode: false,
      reason: "",
      updatedAt: null,
      pendingUploads: 0
    };
  }
}

/**
 * Clear the maintenance status cache
 */
export function clearMaintenanceCache() {
  cachedStatus = null;
  cacheExpiry = 0;
}

/**
 * Check if an error response indicates maintenance mode
 */
export function isMaintenanceError(error: any): boolean {
  if (!error || typeof error !== 'object') return false;
  
  // Check if error has maintenanceMode flag
  if ('maintenanceMode' in error) return true;
  
  // Check error message
  const message = String(error.message || error.error || '');
  return message.toLowerCase().includes('maintenance') || 
         message.toLowerCase().includes('temporarily unavailable');
}

/**
 * Extract maintenance message from error
 */
export function getMaintenanceMessage(error: any): string {
  if (!error || typeof error !== 'object') {
    return "Arweave is currently under maintenance. Please try again later.";
  }
  
  // Try to get reason from error object
  if (error.reason) return error.reason;
  if (error.message) return error.message;
  
  return "Arweave is currently under maintenance. Please try again later.";
}

