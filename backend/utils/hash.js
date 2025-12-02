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
 * Handles different transaction types (TRANSACTION, GIFT, MINT).
 * Excludes _id if present (since _id will be the hash itself).
 */
export function hashableTransaction(transaction) {
  const { _id, ...rest } = transaction;
  const type = String(rest.type || "TRANSACTION");
  
  const base = {
    type,
    nftId: String(rest.nftId || ""),
    quantity: Number(rest.quantity || 0),
    chainTx: rest.chainTx !== null && rest.chainTx !== undefined 
      ? String(rest.chainTx) 
      : null,
    currency: String(rest.currency || "ETH"),
    amount: String(rest.amount || "0"),
    timestamp: rest.timestamp instanceof Date 
      ? rest.timestamp 
      : new Date(rest.timestamp || Date.now()),
  };
  
  // Add type-specific fields
  if (type === "GIFT") {
    base.giver = String(rest.giver || "").toLowerCase();
    base.receiver = String(rest.receiver || "").toLowerCase();
  } else if (type === "MINT") {
    const minter = String(rest.buyer || rest.seller || rest.creator || "").toLowerCase();
    base.buyer = minter;
    base.seller = minter;
  } else {
    // TRANSACTION type
    base.listingId = rest.listingId !== null && rest.listingId !== undefined 
      ? String(rest.listingId) 
      : null;
    base.reservationId = rest.reservationId !== null && rest.reservationId !== undefined 
      ? String(rest.reservationId) 
      : null;
    base.buyer = String(rest.buyer || "").toLowerCase();
    base.seller = String(rest.seller || "").toLowerCase();
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
