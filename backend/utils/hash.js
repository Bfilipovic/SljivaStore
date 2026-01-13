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
 * All transactions now have the same structure with consistent fields.
 * Excludes technical metadata (_id, arweaveTxId, previous_arweave_tx).
 * 
 * IMPORTANT: Signatures are included in the hash to detect tampering.
 * All fields are included consistently for all transaction types.
 */
export function hashableTransaction(transaction) {
  // Exclude technical metadata that should not be in hash
  const { _id, arweaveTxId, previous_arweave_tx, ...rest } = transaction;
  
  // Normalize all fields consistently - all transactions now have the same structure
  const base = {
    type: String(rest.type || ""),
    transaction_number: Number(rest.transaction_number || 0),
    timestamp: rest.timestamp instanceof Date 
      ? rest.timestamp 
      : new Date(rest.timestamp || Date.now()),
    // Entity references
    listingId: rest.listingId !== null && rest.listingId !== undefined 
      ? String(rest.listingId) 
      : null,
    reservationId: rest.reservationId !== null && rest.reservationId !== undefined 
      ? String(rest.reservationId) 
      : null,
    giftId: rest.giftId !== null && rest.giftId !== undefined 
      ? String(rest.giftId) 
      : null,
    // NFT/Part fields
    nftId: rest.nftId !== null && rest.nftId !== undefined 
      ? String(rest.nftId) 
      : null,
    quantity: Number(rest.quantity || 0),
    // Party fields
    buyer: rest.buyer !== null && rest.buyer !== undefined 
      ? String(rest.buyer).toLowerCase() 
      : null,
    seller: rest.seller !== null && rest.seller !== undefined 
      ? String(rest.seller).toLowerCase() 
      : null,
    giver: rest.giver !== null && rest.giver !== undefined 
      ? String(rest.giver).toLowerCase() 
      : null,
    receiver: rest.receiver !== null && rest.receiver !== undefined 
      ? String(rest.receiver).toLowerCase() 
      : null,
    // Chain transaction fields
    chainTx: rest.chainTx !== null && rest.chainTx !== undefined 
      ? String(rest.chainTx) 
      : null,
    currency: rest.currency !== null && rest.currency !== undefined 
      ? String(rest.currency) 
      : null,
    amount: rest.amount !== null && rest.amount !== undefined 
      ? String(rest.amount) 
      : null,
    // Listing-specific fields
    price: rest.price !== null && rest.price !== undefined 
      ? String(rest.price) 
      : null,
    sellerWallets: (rest.sellerWallets && typeof rest.sellerWallets === 'object' && Object.keys(rest.sellerWallets).length > 0) 
      ? Object.keys(rest.sellerWallets).sort().reduce((acc, key) => {
          acc[key] = String(rest.sellerWallets[key]);
          return acc;
        }, {})
      : null,
    bundleSale: rest.bundleSale !== null && rest.bundleSale !== undefined
      ? (rest.bundleSale === true || rest.bundleSale === "true")
      : null,
    // Signature fields
    signer: rest.signer !== null && rest.signer !== undefined 
      ? String(rest.signer).toLowerCase() 
      : null,
    signature: rest.signature !== null && rest.signature !== undefined 
      ? String(rest.signature) 
      : null,
  };
  
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
