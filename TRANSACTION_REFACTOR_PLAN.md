# Transaction Type Refactoring - Implementation Plan

## Overview
This document outlines the comprehensive refactoring to introduce a canonical transaction-type model with user signatures for all state-changing actions.

## Transaction Types (8 total)
1. MINT - Creates NFT and parts
2. LISTING_CREATE - Creates a listing
3. LISTING_CANCEL - Cancels a listing
4. LISTING_BUY - Buys from a listing (replaces TRANSACTION)
5. GIFT_CREATE - Creates a gift envelope
6. GIFT_CLAIM - Claims a gift (replaces GIFT)
7. GIFT_REFUSE - Refuses a gift
8. GIFT_CANCEL - Cancels a gift by giver

## Implementation Steps

### Phase 1: Core Infrastructure ✅
- [x] Create transaction type constants (`backend/utils/transactionTypes.js`)

### Phase 2: Hash Function
- [ ] Update `hashableTransaction()` to handle all 8 types
- [ ] Include signature fields in hash
- [ ] Exclude technical metadata (_id, arweaveTxId, previous_arweave_tx)

### Phase 3: Services Refactoring
- [ ] Update `listingService.js`: Add LISTING_CREATE and LISTING_CANCEL transactions
- [ ] Update `transactionService.js`: Rename TRANSACTION to LISTING_BUY
- [ ] Update `giftService.js`: 
  - Add GIFT_CREATE transaction
  - Rename GIFT to GIFT_CLAIM
  - Add GIFT_REFUSE transaction
  - Add GIFT_CANCEL transaction
  - Remove expiry logic
- [ ] Update `nftService.js`: Ensure MINT uses correct type

### Phase 4: Signature Integration
- [ ] Store signatures in all transaction documents
- [ ] Verify signatures match expected signer role
- [ ] Include signatures in hash calculation

### Phase 5: Arweave Integration
- [ ] Update Arweave upload to handle all new types
- [ ] Ensure signatures are included in Arweave payload

### Phase 6: Documentation & Tests
- [ ] Update ARWEAVE_INTEGRATION.md
- [ ] Update HASH_VERIFICATION.md
- [ ] Update integration tests
- [ ] Add signature verification tests

## Current Status
Working on Phase 2 - Hash Function

