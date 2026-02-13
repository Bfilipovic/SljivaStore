# Hash Synchronization Testing

## Overview

This document describes the hash synchronization tests that ensure transaction verification works correctly across backend and explorer.

## Critical Importance

**Hash functions MUST produce identical results** in:
- `backend/utils/hash.js` - `hashableTransaction()` function
- `explorer/src/lib/utils/hash.ts` - `hashableTransaction()` function

If these functions diverge, transaction verification will fail, breaking the entire verification system.

## Test Files

### 1. `backend/tests/hashSync.test.js`
**Purpose**: Tests backend hash function consistency and correctness.

**What it tests**:
- All transaction types (MINT, LISTING_CREATE, NFT_BUY, GIFT_CLAIM, UPLOAD, etc.)
- Edge cases (empty strings, null values, uppercase addresses, boolean normalization)
- Hash determinism (same input produces same hash)
- Field exclusion (metadata fields like `_id`, `arweaveTxId` are excluded)

**Run manually**:
```bash
node backend/tests/hashSync.test.js
```

### 2. `backend/tests/hashSyncComparison.test.mjs`
**Purpose**: Compares backend and explorer hash functions to ensure they match.

**What it tests**:
- Same transaction objects produce identical hashes in both implementations
- All transaction types are tested
- Edge cases are verified

**Requirements**:
- Explorer directory must exist
- TypeScript execution tool (`tsx` or `ts-node`) must be installed in explorer

**Run manually**:
```bash
node backend/tests/hashSyncComparison.test.mjs
```

## Pre-commit Hook

A pre-commit hook (`.git/hooks/pre-commit`) automatically runs these tests before every commit.

**What happens**:
1. Basic hash tests run (always)
2. Comparison tests run (if explorer is available)
3. Commit is blocked if any test fails

**To skip (NOT RECOMMENDED)**:
```bash
git commit --no-verify
```

**To manually test before committing**:
```bash
# Test backend hash function
node backend/tests/hashSync.test.js

# Test backend vs explorer comparison (if explorer available)
node backend/tests/hashSyncComparison.test.mjs
```

## Adding New Transaction Fields

When adding new fields to transactions:

1. **Update `backend/utils/transactionBuilder.js`** - Add field to transaction structure
2. **Update `backend/utils/hash.js`** - Add field normalization in `hashableTransaction()`
3. **Update `explorer/src/lib/utils/hash.ts`** - Add same field normalization
4. **Run tests** - Verify both implementations match:
   ```bash
   node backend/tests/hashSync.test.js
   node backend/tests/hashSyncComparison.test.mjs
   ```
5. **Update test data** - Add new field to test transactions in test files

## Troubleshooting

### Test fails: "Hash mismatch"
- Check that both `hashableTransaction()` functions include the same fields
- Verify field normalization is identical (lowercase addresses, null for empty strings, etc.)
- Check that excluded fields (`_id`, `arweaveTxId`) are not included

### Test fails: "Explorer not available"
- Ensure `explorer/` directory exists
- Install TypeScript execution tool in explorer: `cd explorer && npm install tsx --save-dev`
- Or use ts-node: `cd explorer && npm install ts-node --save-dev`

### Pre-commit hook not running
- Check that hook is executable: `chmod +x .git/hooks/pre-commit`
- Verify hook exists: `ls -la .git/hooks/pre-commit`

## Test Coverage

The tests cover:
- ✅ All 9 transaction types (MINT, LISTING_CREATE, LISTING_CANCEL, NFT_BUY, GIFT_CREATE, GIFT_CLAIM, GIFT_REFUSE, GIFT_CANCEL, UPLOAD)
- ✅ Edge cases (empty strings, null values, uppercase addresses)
- ✅ Field normalization (addresses to lowercase, empty strings to null)
- ✅ Field exclusion (metadata fields excluded from hash)
- ✅ Hash determinism (same input = same output)

## Continuous Integration

These tests should also be run in CI/CD pipelines to catch synchronization issues early.

