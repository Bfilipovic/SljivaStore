// frontend/src/lib/statusConstants.ts
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
} as const;

/**
 * Profile statuses
 */
export const PROFILE_STATUS = {
  NONE: "none", // No profile exists
  UNCONFIRMED: "UNCONFIRMED",
  CONFIRMED: "CONFIRMED",
} as const;

/**
 * Gift statuses
 */
export const GIFT_STATUS = {
  ACTIVE: "ACTIVE",
  CLAIMED: "CLAIMED",
  REFUSED: "REFUSED",
  CANCELED: "CANCELED",
} as const;

/**
 * Listing statuses
 */
export const LISTING_STATUS = {
  ACTIVE: "ACTIVE",
  COMPLETED: "COMPLETED",
  CANCELED: "CANCELED",
} as const;

/**
 * NFT statuses
 */
export const NFT_STATUS = {
  ACTIVE: "ACTIVE",
} as const;

/**
 * Type helpers for TypeScript
 */
export type UploadStatus = typeof UPLOAD_STATUS[keyof typeof UPLOAD_STATUS];
export type ProfileStatus = typeof PROFILE_STATUS[keyof typeof PROFILE_STATUS];
export type GiftStatus = typeof GIFT_STATUS[keyof typeof GIFT_STATUS];
export type ListingStatus = typeof LISTING_STATUS[keyof typeof LISTING_STATUS];
export type NftStatus = typeof NFT_STATUS[keyof typeof NFT_STATUS];

/**
 * Helper function to check if a status is valid for a given type
 */
export function isValidStatus(
  status: string,
  statusType: "UPLOAD" | "PROFILE" | "GIFT" | "LISTING" | "NFT"
): boolean {
  const statusMap = {
    UPLOAD: UPLOAD_STATUS,
    PROFILE: PROFILE_STATUS,
    GIFT: GIFT_STATUS,
    LISTING: LISTING_STATUS,
    NFT: NFT_STATUS,
  };

  const validStatuses = statusMap[statusType];
  if (!validStatuses) {
    return false;
  }

  return Object.values(validStatuses).includes(status as any);
}

