# Transaction Structure Management

## Overview

Transaction structure is now centralized to ensure consistency across all transaction types and prevent hash mismatches. When adding new fields to transactions, you only need to update a few places instead of 20+ files.

## Architecture

### Centralized Builder

**File**: `backend/utils/transactionBuilder.js`

The `createTransactionDoc()` function ensures all transaction types have the same structure with all fields present. This prevents hash mismatches that occur when fields are missing.

### Hash Function

**File**: `backend/utils/hash.js`

The `hashableTransaction()` function normalizes and hashes transaction documents. It must include all fields that `createTransactionDoc()` creates.

### Consistency Test

**File**: `backend/tests/transactionStructure.test.js`

This test ensures:
1. All transaction types include all required fields
2. The transaction builder matches what `hashableTransaction` expects
3. Field normalization is consistent between builder and hash function

## Adding New Fields

When you need to add a new field to transactions:

### Step 1: Update `transactionBuilder.js`

Add the field to the base structure in `createTransactionDoc()`:

```javascript
const base = {
  // ... existing fields ...
  newField: null,  // Add here with default value
};
```

Also add it to `getRequiredTransactionFields()`:

```javascript
export function getRequiredTransactionFields() {
  return [
    // ... existing fields ...
    'newField',  // Add here
  ];
}
```

### Step 2: Update `hash.js`

Add normalization logic in `hashableTransaction()`:

```javascript
const base = {
  // ... existing fields ...
  newField: rest.newField !== null && rest.newField !== undefined 
    ? String(rest.newField) 
    : null,
};
```

### Step 3: Run Tests

```bash
node --test backend/tests/transactionStructure.test.js
```

The test will fail if:
- A field is missing from either the builder or hash function
- Field normalization is inconsistent

### Step 4: Update Service Functions (Optional)

If the new field is type-specific, you can pass it via `overrides`:

```javascript
const txDoc = createTransactionDoc({
  type: TX_TYPES.MY_TYPE,
  transaction_number: transactionNumber,
  signer: verifiedAddress,
  signature: signature,
  overrides: {
    // ... existing overrides ...
    newField: someValue,  // Add here if needed
  },
});
```

## Usage Examples

### Creating a MINT Transaction

```javascript
import { createTransactionDoc } from "../utils/transactionBuilder.js";
import { TX_TYPES } from "../utils/transactionTypes.js";

const mintTxDoc = createTransactionDoc({
  type: TX_TYPES.MINT,
  transaction_number: transactionNumber,
  signer: verifiedAddress,
  signature: signature,
  overrides: {
    nftId: String(nftId),
    buyer: creatorLower,
    seller: creatorLower,
    quantity: partCount,
    currency: "ETH",
    amount: "0",
  },
});
```

### Creating a GIFT_REFUSE Transaction

```javascript
const refuseTxDoc = createTransactionDoc({
  type: TX_TYPES.GIFT_REFUSE,
  transaction_number: transactionNumber,
  signer: verifiedAddress,
  signature: signature,
  overrides: {
    giftId: giftId.toString(),
    nftId: String(gift.nftId),
    giver: gift.giver,
    receiver: gift.receiver,
    quantity: Number(gift.quantity || 0),
  },
});
```

## Benefits

1. **Single Source of Truth**: All transaction fields are defined in one place
2. **Automatic Consistency**: The builder ensures all fields are always present
3. **Test Coverage**: Tests catch missing fields before they cause hash mismatches
4. **Easy Updates**: Adding new fields requires updating only 2-3 files instead of 20+
5. **Type Safety**: Normalization logic is centralized and consistent

## Field Normalization

The builder automatically normalizes:
- **Addresses**: Converted to lowercase
- **Empty Strings**: Converted to `null` for consistency
- **Booleans**: Normalized to `true`/`false` or `null`
- **Numbers**: Converted to `Number` type
- **Objects**: Sorted keys for consistent hashing (e.g., `sellerWallets`)

## Transaction Types

All transaction types use the same structure:
- `MINT`
- `LISTING_CREATE`
- `LISTING_CANCEL`
- `NFT_BUY`
- `GIFT_CREATE`
- `GIFT_CLAIM`
- `GIFT_REFUSE`
- `GIFT_CANCEL`
- `UPLOAD`

## Testing

Run the consistency test:

```bash
node --test backend/tests/transactionStructure.test.js
```

This test verifies:
- All required fields are present
- Builder and hash function have matching fields
- All transaction types can be created
- Field normalization is consistent

## Migration Notes

All existing transaction creation functions have been refactored to use `createTransactionDoc()`. The old manual structure creation is no longer needed.

