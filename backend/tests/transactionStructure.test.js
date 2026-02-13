/**
 * Test to ensure transaction structure consistency.
 * 
 * This test verifies that:
 * 1. All transaction types include all required fields
 * 2. The transaction builder matches what hashableTransaction expects
 * 3. Adding new fields requires updating both the builder and hash function
 * 
 * Run with: node --test backend/tests/transactionStructure.test.js
 */

import { test } from "node:test";
import assert from "node:assert";
import { createTransactionDoc, getRequiredTransactionFields } from "../utils/transactionBuilder.js";
import { hashableTransaction } from "../utils/hash.js";
import { TX_TYPES } from "../utils/transactionTypes.js";

test("getRequiredTransactionFields returns all expected fields", () => {
  const fields = getRequiredTransactionFields();
  
  // Core fields
  assert(fields.includes("type"), "Missing 'type' field");
  assert(fields.includes("transaction_number"), "Missing 'transaction_number' field");
  assert(fields.includes("timestamp"), "Missing 'timestamp' field");
  
  // Entity references
  assert(fields.includes("listingId"), "Missing 'listingId' field");
  assert(fields.includes("reservationId"), "Missing 'reservationId' field");
  assert(fields.includes("giftId"), "Missing 'giftId' field");
  assert(fields.includes("uploadId"), "Missing 'uploadId' field");
  
  // Signature fields
  assert(fields.includes("signer"), "Missing 'signer' field");
  assert(fields.includes("signature"), "Missing 'signature' field");
  
  console.log(`✓ Found ${fields.length} required transaction fields`);
});

test("createTransactionDoc includes all required fields", () => {
  const txDoc = createTransactionDoc({
    type: TX_TYPES.MINT,
    transaction_number: 1,
    signer: "0x123",
    signature: "sig123",
  });
  
  const requiredFields = getRequiredTransactionFields();
  
  for (const field of requiredFields) {
    assert(
      field in txDoc,
      `Missing required field: ${field}`
    );
  }
  
  console.log("✓ Transaction doc includes all required fields");
});

test("hashableTransaction includes all fields from createTransactionDoc", () => {
  const txDoc = createTransactionDoc({
    type: TX_TYPES.MINT,
    transaction_number: 1,
    signer: "0x123",
    signature: "sig123",
  });
  
  const hashable = hashableTransaction(txDoc);
  const requiredFields = getRequiredTransactionFields();
  
  for (const field of requiredFields) {
    assert(
      field in hashable,
      `hashableTransaction missing field: ${field}. Update hash.js to include this field.`
    );
  }
  
  console.log("✓ hashableTransaction includes all required fields");
});

test("createTransactionDoc fields match hashableTransaction fields", () => {
  const txDoc = createTransactionDoc({
    type: TX_TYPES.MINT,
    transaction_number: 1,
    signer: "0x123",
    signature: "sig123",
  });
  
  const hashable = hashableTransaction(txDoc);
  
  // Get all fields from both (excluding _id, arweaveTxId, previous_arweave_tx)
  const docFields = new Set(Object.keys(txDoc).filter(f => !['_id', 'arweaveTxId', 'previous_arweave_tx'].includes(f)));
  const hashableFields = new Set(Object.keys(hashable));
  
  // Check that all doc fields are in hashable
  for (const field of docFields) {
    assert(
      hashableFields.has(field),
      `Field '${field}' in transaction doc but not in hashableTransaction. Update hash.js.`
    );
  }
  
  // Check that all hashable fields are in doc
  for (const field of hashableFields) {
    assert(
      docFields.has(field),
      `Field '${field}' in hashableTransaction but not in createTransactionDoc. Update transactionBuilder.js.`
    );
  }
  
  console.log("✓ Transaction doc and hashableTransaction have matching fields");
});

test("All transaction types can be created with createTransactionDoc", () => {
  const transactionTypes = [
    TX_TYPES.MINT,
    TX_TYPES.LISTING_CREATE,
    TX_TYPES.LISTING_CANCEL,
    TX_TYPES.NFT_BUY,
    TX_TYPES.GIFT_CREATE,
    TX_TYPES.GIFT_CLAIM,
    TX_TYPES.GIFT_REFUSE,
    TX_TYPES.GIFT_CANCEL,
    TX_TYPES.UPLOAD,
  ];
  
  for (const txType of transactionTypes) {
    const txDoc = createTransactionDoc({
      type: txType,
      transaction_number: 1,
      signer: "0x123",
      signature: "sig123",
    });
    
    assert.strictEqual(txDoc.type, txType, `Type mismatch for ${txType}`);
    
    // Verify hashableTransaction can process it
    const hashable = hashableTransaction(txDoc);
    assert(hashable, `hashableTransaction failed for ${txType}`);
  }
  
  console.log(`✓ All ${transactionTypes.length} transaction types can be created and hashed`);
});

test("Transaction doc normalization matches hashableTransaction normalization", () => {
  // Test empty string normalization
  const txDoc1 = createTransactionDoc({
    type: TX_TYPES.MINT,
    transaction_number: 1,
    signer: "0x123",
    signature: "sig123",
    overrides: {
      chainTx: "",
      currency: "",
      amount: "",
      verifiedUserUsername: "",
    },
  });
  
  const hashable1 = hashableTransaction(txDoc1);
  
  assert.strictEqual(hashable1.chainTx, null, "Empty chainTx should be normalized to null");
  assert.strictEqual(hashable1.currency, null, "Empty currency should be normalized to null");
  assert.strictEqual(hashable1.amount, null, "Empty amount should be normalized to null");
  assert.strictEqual(hashable1.verifiedUserUsername, null, "Empty verifiedUserUsername should be normalized to null");
  
  console.log("✓ Empty string normalization works correctly");
});

