import crypto from "crypto";

/**
 * Deterministic stringify function for consistent hashing.
 * Handles:
 * - Object key sorting
 * - Date serialization to ISO strings
 * - Null/undefined normalization
 * - Consistent ordering of all fields
 */
function deterministicStringify(obj) {
  if (obj === null) {
    return "null";
  }
  if (obj === undefined) {
    return "undefined";
  }
  
  // Handle primitives
  if (typeof obj !== "object") {
    return JSON.stringify(obj);
  }
  
  // Handle Date objects
  if (obj instanceof Date) {
    return JSON.stringify(obj.toISOString());
  }
  
  // Handle arrays
  if (Array.isArray(obj)) {
    const items = obj.map(item => deterministicStringify(item));
    return `[${items.join(",")}]`;
  }
  
  // Handle objects - sort keys for consistency
  const sortedKeys = Object.keys(obj).sort();
  const pairs = sortedKeys.map(key => {
    const value = obj[key];
    // Skip undefined values to maintain consistency
    if (value === undefined) {
      return null; // will filter out below
    }
    const serializedValue = deterministicStringify(value);
    return `${JSON.stringify(key)}:${serializedValue}`;
  }).filter(pair => pair !== null);
  
  return `{${pairs.join(",")}}`;
}

/**
 * Hash an object deterministically.
 * All fields are included in the hash, ensuring tamper detection.
 */
export function hashObject(obj) {
  const serialized = deterministicStringify(obj);
  return crypto.createHash("sha256").update(serialized).digest("hex");
}

/**
 * Create a hashable representation of an NFT for hashing.
 * Excludes _id if present (since _id will be the hash itself).
 */
export function hashableNFT(nft) {
  const { _id, ...rest } = nft;
  return {
    name: String(rest.name || ""),
    description: String(rest.description || ""),
    creator: String(rest.creator || "").toLowerCase(),
    imageurl: String(rest.imageurl || ""),
    imagehash: String(rest.imagehash || ""),
    time_created: rest.time_created instanceof Date 
      ? rest.time_created 
      : new Date(rest.time_created || Date.now()),
    part_count: Number(rest.part_count || 0),
    status: String(rest.status || "ACTIVE"),
  };
}

/**
 * Create a hashable representation of a Part for hashing.
 * Includes all fields that affect the part's state.
 * Used for verification of current state.
 */
export function hashablePart(part) {
  return {
    part_no: Number(part.part_no || 0),
    parent_hash: String(part.parent_hash || ""),
    owner: String(part.owner || "").toLowerCase(),
    listing: part.listing !== null && part.listing !== undefined 
      ? String(part.listing) 
      : null,
    reservation: part.reservation !== null && part.reservation !== undefined 
      ? String(part.reservation) 
      : null,
  };
}

/**
 * Create a hashable representation of a Part's immutable fields.
 * Used for generating a stable _id that doesn't change when state changes.
 * Parts have stable IDs based on immutable fields, but current state can be verified.
 */
export function hashablePartId(part) {
  return {
    part_no: Number(part.part_no || 0),
    parent_hash: String(part.parent_hash || ""),
    // Include initial owner for uniqueness if needed
    // For now, just part_no + parent_hash should be unique
  };
}

/**
 * Create a hashable representation of a Transaction for hashing.
 * Handles all transaction types with their specific fields.
 * Excludes technical metadata (_id, arweaveTxId, previous_arweave_tx).
 * 
 * IMPORTANT: Signatures are included in the hash to detect tampering.
 * All fields that matter for economic/ownership semantics must be included.
 */
export function hashableTransaction(transaction) {
  // Exclude technical metadata that should not be in hash
  const { _id, arweaveTxId, previous_arweave_tx, ...rest } = transaction;
  const type = String(rest.type || "");
  
  // Base fields present in all transaction types
  const base = {
    type,
    transaction_number: Number(rest.transaction_number || 0),
    timestamp: rest.timestamp instanceof Date 
      ? rest.timestamp 
      : new Date(rest.timestamp || Date.now()),
  };
  
  // Type-specific field handling
  switch (type) {
    case "MINT": {
      const minter = String(rest.buyer || rest.seller || rest.creator || "").toLowerCase();
      base.nftId = String(rest.nftId || "");
      base.quantity = Number(rest.quantity || 0);
      base.buyer = minter;
      base.seller = minter;
      base.chainTx = rest.chainTx !== null && rest.chainTx !== undefined 
        ? String(rest.chainTx) 
        : null;
      base.currency = String(rest.currency || "ETH");
      base.amount = String(rest.amount || "0");
      // Include signature fields
      if (rest.signer) base.signer = String(rest.signer).toLowerCase();
      if (rest.signature) base.signature = String(rest.signature);
      break;
    }
    
    case "LISTING_CREATE": {
      base.listingId = rest.listingId !== null && rest.listingId !== undefined 
        ? String(rest.listingId) 
        : null;
      base.nftId = String(rest.nftId || "");
      base.seller = String(rest.seller || "").toLowerCase();
      base.quantity = Number(rest.quantity || 0);
      base.price = String(rest.price || "");
      base.currency = String(rest.currency || "");
      if (rest.sellerWallets && typeof rest.sellerWallets === 'object') {
        // Sort wallet keys for deterministic hashing
        base.sellerWallets = Object.keys(rest.sellerWallets).sort().reduce((acc, key) => {
          acc[key] = String(rest.sellerWallets[key]);
          return acc;
        }, {});
      }
      base.bundleSale = rest.bundleSale === true || rest.bundleSale === "true";
      // Include signature fields
      if (rest.signer) base.signer = String(rest.signer).toLowerCase();
      if (rest.signature) base.signature = String(rest.signature);
      break;
    }
    
    case "LISTING_CANCEL": {
      base.listingId = rest.listingId !== null && rest.listingId !== undefined 
        ? String(rest.listingId) 
        : null;
      base.seller = String(rest.seller || "").toLowerCase();
      // Include signature fields
      if (rest.signer) base.signer = String(rest.signer).toLowerCase();
      if (rest.signature) base.signature = String(rest.signature);
      break;
    }
    
    case "NFT_BUY": {
      base.listingId = rest.listingId !== null && rest.listingId !== undefined 
        ? String(rest.listingId) 
        : null;
      base.reservationId = rest.reservationId !== null && rest.reservationId !== undefined 
        ? String(rest.reservationId) 
        : null;
      base.nftId = String(rest.nftId || "");
      base.buyer = String(rest.buyer || "").toLowerCase();
      base.seller = String(rest.seller || "").toLowerCase();
      base.quantity = Number(rest.quantity || 0);
      base.chainTx = rest.chainTx !== null && rest.chainTx !== undefined 
        ? String(rest.chainTx) 
        : null;
      base.currency = String(rest.currency || "ETH");
      base.amount = String(rest.amount || "0");
      // Include signature fields
      if (rest.signer) base.signer = String(rest.signer).toLowerCase();
      if (rest.signature) base.signature = String(rest.signature);
      break;
    }
    
    case "GIFT_CREATE": {
      base.giftId = rest.giftId !== null && rest.giftId !== undefined 
        ? String(rest.giftId) 
        : null;
      base.nftId = String(rest.nftId || "");
      base.giver = String(rest.giver || "").toLowerCase();
      base.receiver = String(rest.receiver || "").toLowerCase();
      base.quantity = Number(rest.quantity || 0);
      // Include signature fields
      if (rest.signer) base.signer = String(rest.signer).toLowerCase();
      if (rest.signature) base.signature = String(rest.signature);
      break;
    }
    
    case "GIFT_CLAIM": {
      base.giftId = rest.giftId !== null && rest.giftId !== undefined 
        ? String(rest.giftId) 
        : null;
      base.nftId = String(rest.nftId || "");
      base.giver = String(rest.giver || "").toLowerCase();
      base.receiver = String(rest.receiver || "").toLowerCase();
      base.quantity = Number(rest.quantity || 0);
      base.chainTx = rest.chainTx !== null && rest.chainTx !== undefined 
        ? String(rest.chainTx) 
        : null;
      base.currency = String(rest.currency || "ETH");
      base.amount = String(rest.amount || "0");
      // Include signature fields
      if (rest.signer) base.signer = String(rest.signer).toLowerCase();
      if (rest.signature) base.signature = String(rest.signature);
      break;
    }
    
    case "GIFT_REFUSE": {
      base.giftId = rest.giftId !== null && rest.giftId !== undefined 
        ? String(rest.giftId) 
        : null;
      base.giver = String(rest.giver || "").toLowerCase();
      base.receiver = String(rest.receiver || "").toLowerCase();
      // Include signature fields
      if (rest.signer) base.signer = String(rest.signer).toLowerCase();
      if (rest.signature) base.signature = String(rest.signature);
      break;
    }
    
    case "GIFT_CANCEL": {
      base.giftId = rest.giftId !== null && rest.giftId !== undefined 
        ? String(rest.giftId) 
        : null;
      base.giver = String(rest.giver || "").toLowerCase();
      base.receiver = String(rest.receiver || "").toLowerCase();
      // Include signature fields
      if (rest.signer) base.signer = String(rest.signer).toLowerCase();
      if (rest.signature) base.signature = String(rest.signature);
      break;
    }
    
    // Legacy types for backward compatibility during migration
    case "TRANSACTION": {
      // Legacy TRANSACTION type - map to NFT_BUY structure
      base.listingId = rest.listingId !== null && rest.listingId !== undefined 
        ? String(rest.listingId) 
        : null;
      base.reservationId = rest.reservationId !== null && rest.reservationId !== undefined 
        ? String(rest.reservationId) 
        : null;
      base.nftId = String(rest.nftId || "");
      base.buyer = String(rest.buyer || "").toLowerCase();
      base.seller = String(rest.seller || "").toLowerCase();
      base.quantity = Number(rest.quantity || 0);
      base.chainTx = rest.chainTx !== null && rest.chainTx !== undefined 
        ? String(rest.chainTx) 
        : null;
      base.currency = String(rest.currency || "ETH");
      base.amount = String(rest.amount || "0");
      if (rest.signer) base.signer = String(rest.signer).toLowerCase();
      if (rest.signature) base.signature = String(rest.signature);
      break;
    }
    
    case "GIFT": {
      // Legacy GIFT type - map to GIFT_CLAIM structure
      base.nftId = String(rest.nftId || "");
      base.giver = String(rest.giver || "").toLowerCase();
      base.receiver = String(rest.receiver || "").toLowerCase();
      base.quantity = Number(rest.quantity || 0);
      base.chainTx = rest.chainTx !== null && rest.chainTx !== undefined 
        ? String(rest.chainTx) 
        : null;
      base.currency = String(rest.currency || "ETH");
      base.amount = String(rest.amount || "0");
      if (rest.signer) base.signer = String(rest.signer).toLowerCase();
      if (rest.signature) base.signature = String(rest.signature);
      break;
    }
    
    default:
      throw new Error(`Unknown transaction type: ${type}`);
  }
  
  return base;
}

/**
 * Verify if an existing record's _id matches its computed hash.
 * Returns true if the record already complies with hash-based verification.
 */
export function verifyRecordHash(record, hashableFn) {
  if (!record || !record._id) {
    return false;
  }
  
  const hashable = hashableFn(record);
  const computedHash = hashObject(hashable);
  
  return String(record._id) === computedHash;
}
