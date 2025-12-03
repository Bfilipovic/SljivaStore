# Transaction Numbering and Previous Transaction Fixes

## Issues Identified

1. **All transactions have transaction_number of 1**: Counter initialization or increment logic may be flawed
2. **Multiple transactions have same previous Arweave transaction**: Previous transaction lookup may not be using transaction_number correctly
3. **Last transaction display incorrect**: Sorting may not be working properly

## Fixes Applied

### 1. Counter Initialization (`backend/services/arweaveService.js`)

**Problem**: Counter might reset to 0 or not initialize from existing transactions properly.

**Fix**: 
- Always check if counter needs initialization before incrementing
- Ensure counter is initialized from max existing transaction_number
- Add type checking for transaction_number field

### 2. Previous Transaction Lookup

**Problem**: Previous transaction lookup might not be using transaction_number for sorting, causing multiple transactions to reference the same previous transaction.

**Fix**:
- Always sort by `transaction_number: -1` (descending) to get highest number
- Ensure previous transaction has both `arweaveTxId` AND valid `transaction_number`
- Add type checking to ensure transaction_number is a number

### 3. Last Transaction Display (`backend/services/transactionService.js`)

**Problem**: `getLastTransaction()` might not be sorting correctly if transaction_number is missing or incorrect.

**Fix**:
- Sort by `transaction_number: -1` first (highest number)
- Fall back to timestamp-based sorting if no transaction_number exists
- Add type checking

### 4. Retry Logic (`backend/services/arweaveQueueService.js`)

**Problem**: When retrying queued transactions, previous transaction ID might be stale.

**Fix**:
- Always fetch current previous transaction ID before retrying
- Use transaction_number-based lookup for previous transaction
- Prefer current value over stored value

## Verification

To verify the fixes are working:

1. **Check counter value**:
   ```javascript
   db.counters.findOne({ _id: "transaction_number" })
   ```

2. **Check transaction numbers**:
   ```javascript
   db.transactions.find({}).sort({ transaction_number: -1 }).limit(5).pretty()
   ```

3. **Check previous transaction references**:
   ```javascript
   db.transactions.find({ arweaveTxId: { $exists: true } }).sort({ transaction_number: -1 }).limit(1)
   ```

4. **Check for duplicate transaction numbers**:
   ```javascript
   db.transactions.aggregate([
     { $group: { _id: "$transaction_number", count: { $sum: 1 } } },
     { $match: { count: { $gt: 1 } } }
   ])
   ```

## Migration Script

If existing transactions have incorrect transaction numbers, run the migration script:

```bash
node backend/scripts/fixTransactionNumbers.js
```

This script will:
1. Find all transactions
2. Assign correct sequential transaction numbers
3. Update the counter to match
4. Recalculate previous transaction references

## Testing

After fixes:

1. Create a new transaction - verify it gets next sequential number
2. Check previous transaction reference - should point to highest numbered uploaded transaction
3. Check last transaction endpoint - should return transaction with highest transaction_number
4. Verify retry logic updates previous transaction correctly

