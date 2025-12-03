# Hash-Based Verification System

## Overview

All records (NFTs, Parts, Transactions) now use hash-based verification to ensure data integrity and tamper detection. The hash is computed from all relevant fields of the record, allowing anyone with access to all transactions to reconstruct and verify everything.

## Key Principles

1. **Deterministic Hashing**: All hashes are computed deterministically, ensuring the same data always produces the same hash.
2. **Field Inclusion**: The hash includes all fields that define the record's identity and state.
3. **Tamper Detection**: Any change to a record's fields will result in a different hash, making tampering detectable.

## Record Types

### NFTs

- **Hash Source**: All fields (name, description, creator, imageurl, imagehash, time_created, part_count, status)
- **ID**: The hash of all fields serves as the `_id`
- **Immutable**: NFT records are immutable once created
- **Function**: `hashableNFT()` + `hashObject()`

```javascript
const nftObj = {
  name: "...",
  description: "...",
  creator: "...",
  // ... all fields
};
const nftId = hashObject(hashableNFT(nftObj));
nftObj._id = nftId;
```

### Parts

- **Hash Source**: Immutable fields (part_no, parent_hash) for stable `_id`
- **ID**: Hash of immutable fields ensures stable ID even when state changes
- **Mutable**: Parts can change state (owner, listing, reservation), but `_id` remains stable
- **Functions**: 
  - `hashablePartId()` - for stable `_id` (immutable fields)
  - `hashablePart()` - for verification of current state (all fields)

```javascript
const partDoc = {
  part_no: 1,
  parent_hash: nftId,
  owner: "...",
  listing: null,
  reservation: null,
};
const partId = hashObject(hashablePartId(partDoc)); // Stable ID
partDoc._id = partId;
```

### Transactions

- **Hash Source**: All fields, including type-specific fields, transaction_number, signer, and signature
- **ID**: Hash of all fields serves as the `_id`
- **Immutable**: Transaction records are immutable once created
- **Types**: MINT, LISTING_CREATE, LISTING_CANCEL, NFT_BUY, GIFT_CREATE, GIFT_CLAIM, GIFT_REFUSE, GIFT_CANCEL
- **Function**: `hashableTransaction()` + `hashObject()`

**Transaction Type Fields:**

All transaction types include:
- `type`: Transaction type (required)
- `transaction_number`: Sequential transaction number (required, part of hash)
- `signer`: Address that signed the transaction (required)
- `signature`: Signature from frontend (required)
- `timestamp`: Transaction timestamp (required)

**Type-Specific Fields:**

- **MINT**: nftId, buyer (minter), seller (minter), quantity, chainTx (null), currency, amount
- **LISTING_CREATE**: listingId, nftId, seller, quantity, price, sellerWallets, bundleSale
- **LISTING_CANCEL**: listingId, seller
- **NFT_BUY**: listingId, reservationId, nftId, buyer, seller, quantity, chainTx, currency, amount
- **GIFT_CREATE**: giftId, nftId, giver, receiver, quantity
- **GIFT_CLAIM**: giftId, nftId, giver, receiver, quantity, chainTx (optional), currency, amount
- **GIFT_REFUSE**: giftId, nftId, giver, receiver, quantity
- **GIFT_CANCEL**: giftId, nftId, giver, receiver, quantity

```javascript
const txDoc = {
  type: "NFT_BUY",
  transaction_number: 1,
  listingId: "...",
  buyer: "...",
  signer: "...",
  signature: "...",
  // ... all fields
};
const txId = hashObject(hashableTransaction(txDoc));
txDoc._id = txId;
```

**Hash Exclusion:**
The hash calculation excludes:
- `_id` (it IS the hash)
- `arweaveTxId` (set after hash calculation)

## Hash Functions

### Deterministic Serialization

The `deterministicStringify()` function ensures consistent serialization:
- Object keys are sorted alphabetically
- Dates are converted to ISO strings
- Null and undefined are handled consistently
- Arrays and nested objects are processed recursively

### Hash Computation

```javascript
import { hashObject, hashableNFT, hashablePart, hashablePartId, hashableTransaction } from "../utils/hash.js";

// NFT
const nftHash = hashObject(hashableNFT(nft));

// Part (stable ID)
const partId = hashObject(hashablePartId(part));

// Part (full state verification)
const partStateHash = hashObject(hashablePart(part));

// Transaction
const txHash = hashObject(hashableTransaction(transaction));
```

## Verification

### Verify Individual Record

```javascript
import { verifyRecordHash } from "../utils/hash.js";

// Check if NFT's _id matches its computed hash
const isCompliant = verifyRecordHash(nft, hashableNFT);

// Check if Transaction's _id matches its computed hash
const isCompliant = verifyRecordHash(tx, hashableTransaction);
```

### Verify All Records

Run the verification script:

```bash
node backend/scripts/verifyHashes.js
```

This will:
- Check all NFTs for hash compliance
- Check all Parts for hash compliance
- Check all Transactions for hash compliance
- Report summary statistics
- Show sample issues

## Backward Compatibility

- **Transactions**: The code supports legacy transaction types ("TRANSACTION" maps to NFT_BUY structure, "GIFT" maps to GIFT_CLAIM structure) for backward compatibility. The `getTransactionById()` function checks for both ObjectId-based IDs (legacy) and hash-based IDs (new).
- **Parts**: Existing parts may have different ID formats. The verification script will identify non-compliant records.
- **NFTs**: NFTs were already hash-based, now using deterministic hashing.
- **Signatures**: Legacy transactions may not have signature fields, but all new transactions must include signer and signature.

## Migration

New records automatically use hash-based IDs. Existing records can be verified using the verification script. If migration is needed (to update non-compliant records), it can be done separately without affecting new records.

## Benefits

1. **Data Integrity**: Any tampering with record fields will be detectable through hash mismatch
2. **Reconstruction**: All records can be reconstructed from transactions if needed
3. **Verification**: Anyone with access to all transactions can verify the entire system state
4. **Deterministic**: Same data always produces the same hash, ensuring consistency

## Notes

- Parts use stable IDs (based on immutable fields) to maintain referential integrity when state changes
- Transactions are fully immutable and hash-based
- NFTs are fully immutable and hash-based
- The hash includes all fields that define the record's identity and state

