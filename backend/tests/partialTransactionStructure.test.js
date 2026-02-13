/**
 * Test to ensure partial transaction structure consistency.
 * 
 * This test verifies that:
 * 1. All partial transactions include all required fields
 * 2. Field normalization is consistent
 * 
 * Run with: node --test backend/tests/partialTransactionStructure.test.js
 */

import { test } from "node:test";
import assert from "node:assert";
import { 
  createPartialTransactionDoc, 
  createPartialTransactionDocs,
  getRequiredPartialTransactionFields 
} from "../utils/partialTransactionBuilder.js";

test("getRequiredPartialTransactionFields returns all expected fields", () => {
  const fields = getRequiredPartialTransactionFields();
  
  assert(fields.includes("part"), "Missing 'part' field");
  assert(fields.includes("transaction"), "Missing 'transaction' field");
  assert(fields.includes("from"), "Missing 'from' field");
  assert(fields.includes("to"), "Missing 'to' field");
  assert(fields.includes("nftId"), "Missing 'nftId' field");
  assert(fields.includes("chainTx"), "Missing 'chainTx' field");
  assert(fields.includes("currency"), "Missing 'currency' field");
  assert(fields.includes("amount"), "Missing 'amount' field");
  assert(fields.includes("timestamp"), "Missing 'timestamp' field");
  
  console.log(`✓ Found ${fields.length} required partial transaction fields`);
});

test("createPartialTransactionDoc includes all required fields", () => {
  const partialDoc = createPartialTransactionDoc({
    part: "part123",
    transaction: "tx123",
    from: "0xAAA",
    to: "0xBBB",
    nftId: "nft123",
  });
  
  const requiredFields = getRequiredPartialTransactionFields();
  
  for (const field of requiredFields) {
    assert(
      field in partialDoc,
      `Missing required field: ${field}`
    );
  }
  
  console.log("✓ Partial transaction doc includes all required fields");
});

test("createPartialTransactionDoc normalizes addresses to lowercase", () => {
  const partialDoc = createPartialTransactionDoc({
    part: "part123",
    transaction: "tx123",
    from: "0xAAA",
    to: "0xBBB",
    nftId: "nft123",
  });
  
  assert.strictEqual(partialDoc.from, "0xaaa", "from should be lowercase");
  assert.strictEqual(partialDoc.to, "0xbbb", "to should be lowercase");
  
  console.log("✓ Address normalization works correctly");
});

test("createPartialTransactionDoc handles empty string for from (mint case)", () => {
  const partialDoc = createPartialTransactionDoc({
    part: "part123",
    transaction: "tx123",
    from: "", // Mint has no "from"
    to: "0xBBB",
    nftId: "nft123",
  });
  
  assert.strictEqual(partialDoc.from, "", "from should remain empty string for mint");
  
  console.log("✓ Empty string from (mint case) handled correctly");
});

test("createPartialTransactionDoc normalizes empty strings to null for chainTx, currency, amount", () => {
  const partialDoc = createPartialTransactionDoc({
    part: "part123",
    transaction: "tx123",
    from: "0xAAA",
    to: "0xBBB",
    nftId: "nft123",
    chainTx: "",
    currency: "",
    amount: "",
  });
  
  assert.strictEqual(partialDoc.chainTx, null, "Empty chainTx should be normalized to null");
  assert.strictEqual(partialDoc.currency, null, "Empty currency should be normalized to null");
  assert.strictEqual(partialDoc.amount, null, "Empty amount should be normalized to null");
  
  console.log("✓ Empty string normalization works correctly");
});

test("createPartialTransactionDocs creates multiple partial transactions", () => {
  const parts = [
    { _id: "part1" },
    { _id: "part2" },
    { _id: "part3" },
  ];
  
  const partials = createPartialTransactionDocs(parts, {
    transaction: "tx123",
    from: "0xAAA",
    to: "0xBBB",
    nftId: "nft123",
  });
  
  assert.strictEqual(partials.length, 3, "Should create 3 partial transactions");
  assert.strictEqual(partials[0].part, "part1", "First partial should have correct part ID");
  assert.strictEqual(partials[1].part, "part2", "Second partial should have correct part ID");
  assert.strictEqual(partials[2].part, "part3", "Third partial should have correct part ID");
  
  // All should have same transaction, from, to, nftId
  for (const partial of partials) {
    assert.strictEqual(partial.transaction, "tx123");
    assert.strictEqual(partial.from, "0xaaa");
    assert.strictEqual(partial.to, "0xbbb");
    assert.strictEqual(partial.nftId, "nft123");
  }
  
  console.log("✓ createPartialTransactionDocs works correctly");
});

test("createPartialTransactionDocs returns empty array for empty input", () => {
  const partials = createPartialTransactionDocs([], {
    transaction: "tx123",
    from: "0xAAA",
    to: "0xBBB",
    nftId: "nft123",
  });
  
  assert.strictEqual(partials.length, 0, "Should return empty array");
  
  console.log("✓ Empty array handling works correctly");
});

