/**
 * Centralized transaction document builder.
 * 
 * This ensures all transaction types have the same structure with all fields present,
 * preventing hash mismatches when fields are missing.
 * 
 * IMPORTANT: When adding new fields to transactions, update:
 * 1. This function (add field to base structure)
 * 2. hashableTransaction() in hash.js (add normalization logic)
 * 3. Run the test in transactionStructure.test.js to verify consistency
 */

import { TX_TYPES } from "./transactionTypes.js";
import { normalizeAddress } from "./addressUtils.js";

/**
 * Get all field names that should be present in every transaction.
 * This list must match what hashableTransaction() expects.
 */
export function getRequiredTransactionFields() {
  return [
    // Core fields
    'type',
    'transaction_number',
    'timestamp',
    // Entity references
    'listingId',
    'reservationId',
    'giftId',
    'uploadId',
    // NFT/Part fields
    'nftId',
    'quantity',
    // Party fields
    'buyer',
    'seller',
    'giver',
    'receiver',
    // Chain transaction fields
    'chainTx',
    'currency',
    'amount',
    // Listing-specific fields
    'price',
    'sellerWallets',
    'bundleSale',
    // Upload-specific fields
    'uploadedimageurl',
    'uploadedimagedescription',
    'uploadedimagename',
    // Verification fields
    'isVerificationConfirmation',
    'verifiedUserUsername',
    'verifiedUserBio',
    'verifiedUserEmail',
    'verifiedUserFullName',
    'verifiedUserCountry',
    'verifiedUserCity',
    'verifiedUserPhysicalAddress',
    // Signature fields
    'signer',
    'signature',
  ];
}

/**
 * Create a base transaction document with all fields initialized to null/defaults.
 * This ensures consistency across all transaction types.
 * 
 * @param {Object} params - Transaction parameters
 * @param {string} params.type - Transaction type (from TX_TYPES)
 * @param {number} params.transaction_number - Sequential transaction number
 * @param {string} params.signer - Address that signed the transaction (lowercase)
 * @param {string|null} params.signature - Signature from frontend
 * @param {Date} [params.timestamp] - Transaction timestamp (defaults to now)
 * @param {Object} [params.overrides] - Type-specific field overrides
 * @returns {Object} Complete transaction document with all fields
 */
export function createTransactionDoc({
  type,
  transaction_number,
  signer,
  signature = null,
  timestamp = new Date(),
  overrides = {},
}) {
  if (!type || !transaction_number || !signer) {
    throw new Error("Missing required fields: type, transaction_number, signer");
  }

  // Base structure with all fields initialized to null/defaults
  const base = {
    // Core fields
    type: String(type),
    transaction_number: Number(transaction_number),
    timestamp: timestamp instanceof Date ? timestamp : new Date(timestamp || Date.now()),
    
    // Entity references
    listingId: null,
    reservationId: null,
    giftId: null,
    uploadId: null,
    
    // NFT/Part fields
    nftId: null,
    quantity: 0,
    
    // Party fields
    buyer: null,
    seller: null,
    giver: null,
    receiver: null,
    
    // Chain transaction fields
    chainTx: null,
    currency: null,
    amount: null,
    
    // Listing-specific fields
    price: null,
    sellerWallets: null,
    bundleSale: null,
    
    // Upload-specific fields
    uploadedimageurl: null,
    uploadedimagedescription: null,
    uploadedimagename: null,
    
    // Verification fields
    isVerificationConfirmation: null,
    verifiedUserUsername: null,
    verifiedUserBio: null,
    verifiedUserEmail: null,
    verifiedUserFullName: null,
    verifiedUserCountry: null,
    verifiedUserCity: null,
    verifiedUserPhysicalAddress: null,
    
    // Signature fields
    signer: normalizeAddress(signer),
    signature: signature !== null && signature !== undefined ? String(signature) : null,
  };

  // Apply type-specific overrides
  // Normalize string fields to lowercase where appropriate
  const normalizedOverrides = { ...overrides };
  
  if (normalizedOverrides.buyer !== undefined) {
    normalizedOverrides.buyer = normalizeAddress(normalizedOverrides.buyer);
  }
  if (normalizedOverrides.seller !== undefined) {
    normalizedOverrides.seller = normalizeAddress(normalizedOverrides.seller);
  }
  if (normalizedOverrides.giver !== undefined) {
    normalizedOverrides.giver = normalizeAddress(normalizedOverrides.giver);
  }
  if (normalizedOverrides.receiver !== undefined) {
    normalizedOverrides.receiver = normalizeAddress(normalizedOverrides.receiver);
  }
  
  // Normalize chainTx, currency, amount - empty strings become null
  if (normalizedOverrides.chainTx !== undefined) {
    normalizedOverrides.chainTx = (normalizedOverrides.chainTx && String(normalizedOverrides.chainTx).trim()) || null;
  }
  if (normalizedOverrides.currency !== undefined) {
    normalizedOverrides.currency = (normalizedOverrides.currency && String(normalizedOverrides.currency).trim()) || null;
  }
  if (normalizedOverrides.amount !== undefined) {
    normalizedOverrides.amount = (normalizedOverrides.amount && String(normalizedOverrides.amount).trim()) || null;
  }
  
  // Normalize upload fields - empty strings become null
  if (normalizedOverrides.uploadedimageurl !== undefined) {
    normalizedOverrides.uploadedimageurl = (normalizedOverrides.uploadedimageurl && String(normalizedOverrides.uploadedimageurl).trim()) || null;
  }
  if (normalizedOverrides.uploadedimagedescription !== undefined) {
    normalizedOverrides.uploadedimagedescription = (normalizedOverrides.uploadedimagedescription && String(normalizedOverrides.uploadedimagedescription).trim()) || null;
  }
  if (normalizedOverrides.uploadedimagename !== undefined) {
    normalizedOverrides.uploadedimagename = (normalizedOverrides.uploadedimagename && String(normalizedOverrides.uploadedimagename).trim()) || null;
  }
  
  // Normalize verification fields - empty strings become null
  if (normalizedOverrides.verifiedUserUsername !== undefined) {
    normalizedOverrides.verifiedUserUsername = (normalizedOverrides.verifiedUserUsername && String(normalizedOverrides.verifiedUserUsername).trim()) || null;
  }
  if (normalizedOverrides.verifiedUserBio !== undefined) {
    normalizedOverrides.verifiedUserBio = (normalizedOverrides.verifiedUserBio && String(normalizedOverrides.verifiedUserBio).trim()) || null;
  }
  if (normalizedOverrides.verifiedUserEmail !== undefined) {
    normalizedOverrides.verifiedUserEmail = (normalizedOverrides.verifiedUserEmail && String(normalizedOverrides.verifiedUserEmail).trim()) || null;
  }
  if (normalizedOverrides.verifiedUserFullName !== undefined) {
    normalizedOverrides.verifiedUserFullName = (normalizedOverrides.verifiedUserFullName && String(normalizedOverrides.verifiedUserFullName).trim()) || null;
  }
  if (normalizedOverrides.verifiedUserCountry !== undefined) {
    normalizedOverrides.verifiedUserCountry = (normalizedOverrides.verifiedUserCountry && String(normalizedOverrides.verifiedUserCountry).trim()) || null;
  }
  if (normalizedOverrides.verifiedUserCity !== undefined) {
    normalizedOverrides.verifiedUserCity = (normalizedOverrides.verifiedUserCity && String(normalizedOverrides.verifiedUserCity).trim()) || null;
  }
  if (normalizedOverrides.verifiedUserPhysicalAddress !== undefined) {
    normalizedOverrides.verifiedUserPhysicalAddress = (normalizedOverrides.verifiedUserPhysicalAddress && String(normalizedOverrides.verifiedUserPhysicalAddress).trim()) || null;
  }
  
  // Normalize boolean fields
  if (normalizedOverrides.bundleSale !== undefined) {
    normalizedOverrides.bundleSale = normalizedOverrides.bundleSale !== null && normalizedOverrides.bundleSale !== undefined
      ? (normalizedOverrides.bundleSale === true || normalizedOverrides.bundleSale === "true")
      : null;
  }
  if (normalizedOverrides.isVerificationConfirmation !== undefined) {
    normalizedOverrides.isVerificationConfirmation = normalizedOverrides.isVerificationConfirmation !== null && normalizedOverrides.isVerificationConfirmation !== undefined
      ? (normalizedOverrides.isVerificationConfirmation === true || normalizedOverrides.isVerificationConfirmation === "true")
      : null;
  }
  
  // Normalize string fields
  if (normalizedOverrides.listingId !== undefined) {
    normalizedOverrides.listingId = normalizedOverrides.listingId !== null ? String(normalizedOverrides.listingId) : null;
  }
  if (normalizedOverrides.reservationId !== undefined) {
    normalizedOverrides.reservationId = normalizedOverrides.reservationId !== null ? String(normalizedOverrides.reservationId) : null;
  }
  if (normalizedOverrides.giftId !== undefined) {
    normalizedOverrides.giftId = normalizedOverrides.giftId !== null ? String(normalizedOverrides.giftId) : null;
  }
  if (normalizedOverrides.uploadId !== undefined) {
    normalizedOverrides.uploadId = normalizedOverrides.uploadId !== null ? String(normalizedOverrides.uploadId) : null;
  }
  if (normalizedOverrides.nftId !== undefined) {
    normalizedOverrides.nftId = normalizedOverrides.nftId !== null ? String(normalizedOverrides.nftId) : null;
  }
  if (normalizedOverrides.quantity !== undefined) {
    normalizedOverrides.quantity = Number(normalizedOverrides.quantity || 0);
  }
  if (normalizedOverrides.price !== undefined) {
    normalizedOverrides.price = normalizedOverrides.price !== null ? String(normalizedOverrides.price) : null;
  }
  
  // Normalize sellerWallets object
  if (normalizedOverrides.sellerWallets !== undefined) {
    if (normalizedOverrides.sellerWallets && typeof normalizedOverrides.sellerWallets === 'object' && Object.keys(normalizedOverrides.sellerWallets).length > 0) {
      normalizedOverrides.sellerWallets = Object.keys(normalizedOverrides.sellerWallets).sort().reduce((acc, key) => {
        acc[key] = String(normalizedOverrides.sellerWallets[key]);
        return acc;
      }, {});
    } else {
      normalizedOverrides.sellerWallets = null;
    }
  }

  return { ...base, ...normalizedOverrides };
}

