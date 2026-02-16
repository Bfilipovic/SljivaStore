// backend/utils/statusConstants.js
/**
 * Status Constants
 * 
 * Centralized status values to prevent typos and ensure consistency.
 * 
 * IMPORTANT: When adding new statuses, update both:
 * - backend/utils/statusConstants.js
 * - frontend/src/lib/statusConstants.ts
 * 
 * These must stay in sync!
 */

/**
 * Upload statuses
 */
export const UPLOAD_STATUS = {
  PENDING: "PENDING",
  CONFIRMED: "CONFIRMED",
  CANCELED: "CANCELED",
  REFUSED: "REFUSED",
};

/**
 * Profile statuses
 */
export const PROFILE_STATUS = {
  NONE: "none", // No profile exists
  UNCONFIRMED: "UNCONFIRMED",
  CONFIRMED: "CONFIRMED",
};

/**
 * Gift statuses
 */
export const GIFT_STATUS = {
  ACTIVE: "ACTIVE",
  CLAIMED: "CLAIMED",
  REFUSED: "REFUSED",
  CANCELED: "CANCELED",
};

/**
 * Listing statuses
 */
export const LISTING_STATUS = {
  ACTIVE: "ACTIVE",
  COMPLETED: "COMPLETED",
  CANCELED: "CANCELED",
};

/**
 * NFT statuses
 */
export const NFT_STATUS = {
  ACTIVE: "ACTIVE",
};

/**
 * Arweave upload queue statuses
 */
export const ARWEAVE_QUEUE_STATUS = {
  PENDING: "PENDING",
  SUCCESS: "SUCCESS",
};

/**
 * Reservation statuses
 */
export const RESERVATION_STATUS = {
  PENDING: "PENDING",       // Just created, can expire after 60s
  PROCESSING: "PROCESSING", // Transaction creation started, non-deletable
  PAID: "PAID",             // Chain transaction verified, payment confirmed, non-deletable
  COMPLETED: "COMPLETED",   // All done (parts transferred, partials created, Arweave confirmed), deletable
};

/**
 * Helper function to check if a status is valid for a given type
 */
export function isValidStatus(status, statusType) {
  const statusMap = {
    UPLOAD: UPLOAD_STATUS,
    PROFILE: PROFILE_STATUS,
    GIFT: GIFT_STATUS,
    LISTING: LISTING_STATUS,
    NFT: NFT_STATUS,
    ARWEAVE_QUEUE: ARWEAVE_QUEUE_STATUS,
    RESERVATION: RESERVATION_STATUS,
  };
  
  const validStatuses = statusMap[statusType];
  if (!validStatuses) {
    return false;
  }
  
  return Object.values(validStatuses).includes(status);
}

/**
 * Get all valid statuses for a given type
 */
export function getValidStatuses(statusType) {
  const statusMap = {
    UPLOAD: UPLOAD_STATUS,
    PROFILE: PROFILE_STATUS,
    GIFT: GIFT_STATUS,
    LISTING: LISTING_STATUS,
    NFT: NFT_STATUS,
    ARWEAVE_QUEUE: ARWEAVE_QUEUE_STATUS,
    RESERVATION: RESERVATION_STATUS,
  };
  
  return statusMap[statusType] || {};
}

