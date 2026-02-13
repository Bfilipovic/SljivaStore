# Partial Transaction Structure Management

## Overview

Partial transaction structure is now centralized to ensure consistency across all transaction types. Partial transactions track individual part transfers within a transaction, linking parts to transactions and recording ownership changes.

## Architecture

### Centralized Builder

**File**: `backend/utils/partialTransactionBuilder.js`

The `createPartialTransactionDoc()` and `createPartialTransactionDocs()` functions ensure all partial transactions have consistent structure.

### Consistency Test

**File**: `backend/tests/partialTransactionStructure.test.js`

This test ensures:
1. All partial transactions include all required fields
2. Field normalization is consistent (addresses to lowercase, empty strings to null)
3. Bulk creation works correctly

## Partial Transaction Fields

All partial transactions include:
- `part`: Part ID (required)
- `transaction`: Transaction ID (required)
- `from`: Sender address (required, lowercase, or empty string for mint)
- `to`: Receiver address (required, lowercase)
- `nftId`: NFT ID (required)
- `chainTx`: Chain transaction hash (optional, defaults to null)
- `currency`: Currency (optional, defaults to null)
- `amount`: Amount (optional, defaults to null)
- `timestamp`: Timestamp (defaults to now)

## Usage Examples

### Creating a Single Partial Transaction

```javascript
import { createPartialTransactionDoc } from "../utils/partialTransactionBuilder.js";

const partial = createPartialTransactionDoc({
  part: partId,
  transaction: txId,
  from: "0xAAA",
  to: "0xBBB",
  nftId: nftId,
  chainTx: "0x123...",
  currency: "ETH",
  amount: "0.001",
  timestamp: new Date(),
});
```

### Creating Multiple Partial Transactions (Bulk)

```javascript
import { createPartialTransactionDocs } from "../utils/partialTransactionBuilder.js";

const parts = [
  { _id: "part1" },
  { _id: "part2" },
  { _id: "part3" },
];

const partials = createPartialTransactionDocs(parts, {
  transaction: txId,
  from: sellerAddress,
  to: buyerAddress,
  nftId: nftId,
  chainTx: chainTx,
  currency: "ETH",
  amount: "0.001",
  timestamp: new Date(),
});

await ptxCollection.insertMany(partials);
```

### Mint Example (Empty "from")

```javascript
const partials = createPartialTransactionDocs(mintedParts, {
  transaction: mintTxId,
  from: "", // Mint has no "from" - part is being created
  to: creatorAddress,
  nftId: nftId,
  chainTx: null,
  currency: "ETH",
  amount: "0",
  timestamp: new Date(),
});
```

## Field Normalization

The builder automatically normalizes:
- **Addresses**: Converted to lowercase (except empty string for mint)
- **Empty Strings**: Converted to `null` for `chainTx`, `currency`, `amount`
- **Timestamps**: Converted to `Date` objects

## Transaction Types Using Partial Transactions

All transaction types that transfer part ownership create partial transactions:
- **MINT**: Creates partial transactions for all minted parts
- **NFT_BUY**: Creates partial transactions for all purchased parts
- **GIFT_CLAIM**: Creates partial transactions for all gifted parts
- **UPLOAD**: Creates partial transaction for the part transferred to admin

## Benefits

1. **Single Source of Truth**: All partial transaction fields are defined in one place
2. **Automatic Consistency**: The builder ensures all fields are always present and normalized
3. **Test Coverage**: Tests catch missing fields before they cause issues
4. **Easy Updates**: Adding new fields requires updating only 1-2 files instead of 4+
5. **Type Safety**: Normalization logic is centralized and consistent

## Adding New Fields

When you need to add a new field to partial transactions:

### Step 1: Update `partialTransactionBuilder.js`

Add the field to the base structure in `createPartialTransactionDoc()`:

```javascript
return {
  // ... existing fields ...
  newField: normalizedNewField,  // Add here with normalization
};
```

Also add it to `getRequiredPartialTransactionFields()`:

```javascript
export function getRequiredPartialTransactionFields() {
  return [
    // ... existing fields ...
    'newField',  // Add here
  ];
}
```

### Step 2: Run Tests

```bash
node --test backend/tests/partialTransactionStructure.test.js
```

The test will fail if:
- A field is missing from the builder
- Field normalization is inconsistent

### Step 3: Update Service Functions (Optional)

If the new field is type-specific, you can pass it via the parameters:

```javascript
const partials = createPartialTransactionDocs(parts, {
  // ... existing parameters ...
  newField: someValue,  // Add here if needed
});
```

## Migration Notes

All existing partial transaction creation functions have been refactored to use `createPartialTransactionDoc()` or `createPartialTransactionDocs()`. The old manual structure creation is no longer needed.

