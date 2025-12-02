# Arweave Integration

## Overview

All transactions (TRANSACTION, GIFT, MINT) are automatically uploaded to Arweave for permanent, immutable storage. Each transaction on Arweave includes a link to the previous transaction, creating a chronological chain.

## Features

1. **Automatic Upload**: Every transaction is uploaded to Arweave after being created
2. **Transaction Chaining**: Each Arweave transaction links to the previous one via `previous_arweave_tx` field
3. **Sequential Numbering**: Each transaction has a `transaction_number` starting from 1
4. **Hash Integrity**: `transaction_number` is included in the hash, but `arweaveTxId` is excluded (set after hash calculation)

## Implementation Details

### Transaction Number

- First transaction is numbered 1
- Each subsequent transaction increments by 1
- Stored in database as `transaction_number` field
- Included in hash calculation for verification

### Arweave Fields

- **`arweaveTxId`**: Stored in database after successful upload (not in hash)
- **`previous_arweave_tx`**: Stored in Arweave transaction data, links to previous transaction's Arweave ID
- **`transaction_number`**: Included in both database and Arweave upload

### Hash Calculation

The transaction hash includes:
- `transaction_number` ✅
- All transaction type-specific fields ✅
- `chainTx`, `currency`, `amount`, `timestamp`, etc. ✅

The transaction hash excludes:
- `_id` (it IS the hash)
- `arweaveTxId` (set after hash calculation)
- `previous_arweave_tx` (only in Arweave data, not database)

### Transaction Flow

1. Get next `transaction_number` and `previousArweaveTxId`
2. Build transaction document with `transaction_number`
3. Calculate hash (includes `transaction_number`)
4. Insert transaction to database
5. Upload to Arweave with `previous_arweave_tx` link
6. Update database with `arweaveTxId`

## Arweave Service

### Location
`backend/services/arweaveService.js`

### Key Functions

- **`getNextTransactionInfo()`**: Returns next transaction number and previous Arweave transaction ID
- **`uploadTransactionToArweave(transactionData, transactionNumber, previousArweaveTxId)`**: Uploads transaction to Arweave
- **`getTransactionFromArweave(arweaveTxId)`**: Retrieves transaction data from Arweave

### Configuration

- **Keyfile**: `backend/90Bf4dnKxkbLeOzJDua3axBqHn_i0WtOsoN9A2uzN6E.json`
- **Gateway**: Configurable via `ARWEAVE_GATEWAY` env var (default: `https://arweave.net`)
- **Tags**: Each transaction is tagged with:
  - `Content-Type`: `application/json`
  - `App-Name`: `SljivaStore`
  - `Transaction-Number`: Sequential number
  - `Transaction-Type`: TRANSACTION, GIFT, or MINT

## Database Schema

Transactions now include:
- `transaction_number`: Number (required, part of hash)
- `arweaveTxId`: String (optional, set after upload)

## Error Handling

- If Arweave upload fails, the transaction is still saved to the database
- Warning is logged but transaction processing continues
- This ensures system availability even if Arweave is temporarily unavailable

## Transaction Chaining

You can traverse the transaction history on Arweave:

1. Start with the latest transaction
2. Get its `previous_arweave_tx` field
3. Fetch that transaction from Arweave
4. Repeat until `previous_arweave_tx` is null (first transaction)

## Examples

### Fetching Transaction Chain

```javascript
import { getTransactionFromArweave } from "./services/arweaveService.js";

async function getTransactionChain(startArweaveTxId) {
  const chain = [];
  let currentTxId = startArweaveTxId;
  
  while (currentTxId) {
    const tx = await getTransactionFromArweave(currentTxId);
    chain.push(tx);
    currentTxId = tx.previous_arweave_tx || null;
  }
  
  return chain.reverse(); // Oldest first
}
```

## Testing

The integration test (`tests/integration-hash-verification.test.mjs`) validates:
- Transaction creation with transaction numbers
- Hash integrity including transaction_number
- Arweave upload functionality (if configured)

## Notes

- Arweave uploads are asynchronous and non-blocking
- Transaction numbers are sequential and immutable
- The transaction chain on Arweave provides complete audit trail
- All transaction types (TRANSACTION, GIFT, MINT) are uploaded

