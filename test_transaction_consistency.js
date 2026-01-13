/**
 * Test script to verify transaction field consistency and null handling
 * Run with: node test_transaction_consistency.js
 */

import { hashableTransaction, hashObject } from './backend/utils/hash.js';

// Test helper to create a transaction with all fields
function createTestTransaction(overrides = {}) {
  return {
    type: "TEST",
    transaction_number: 1,
    listingId: null,
    reservationId: null,
    giftId: null,
    nftId: "test-nft",
    quantity: 1,
    buyer: null,
    seller: null,
    giver: null,
    receiver: null,
    chainTx: null,
    currency: null,
    amount: null,
    price: null,
    sellerWallets: null,
    bundleSale: null,
    timestamp: new Date('2024-01-01T00:00:00Z'),
    signer: "0x1234",
    signature: "sig123",
    ...overrides
  };
}

console.log("=== Testing Transaction Consistency ===\n");

// Test 1: Null handling consistency
console.log("Test 1: Null handling");
const tx1 = createTestTransaction({
  listingId: null,
  reservationId: null,
  giftId: null,
  nftId: null,
  buyer: null,
  seller: null,
  giver: null,
  receiver: null,
  chainTx: null,
  currency: null,
  amount: null,
  price: null,
  sellerWallets: null,
  bundleSale: null,
});
const hashable1 = hashableTransaction(tx1);
console.log("All nulls:", Object.keys(hashable1).map(k => `${k}: ${hashable1[k]}`).join(", "));

// Test 2: sellerWallets with multiple currencies
console.log("\nTest 2: sellerWallets with multiple currencies");
const tx2 = createTestTransaction({
  type: "LISTING_CREATE",
  sellerWallets: {
    ETH: "0x1111111111111111111111111111111111111111",
    SOL: "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM"
  },
  price: "100",
  currency: "YRT",
  seller: "0x2222222222222222222222222222222222222222"
});
const hashable2 = hashableTransaction(tx2);
console.log("sellerWallets:", JSON.stringify(hashable2.sellerWallets));

// Test 3: sellerWallets with different key order (should hash same)
console.log("\nTest 3: sellerWallets with different key order");
const tx3a = createTestTransaction({
  type: "LISTING_CREATE",
  sellerWallets: {
    ETH: "0x1111111111111111111111111111111111111111",
    SOL: "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM"
  }
});
const tx3b = createTestTransaction({
  type: "LISTING_CREATE",
  sellerWallets: {
    SOL: "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",
    ETH: "0x1111111111111111111111111111111111111111"
  }
});
const hashable3a = hashableTransaction(tx3a);
const hashable3b = hashableTransaction(tx3b);
const hash3a = hashObject(hashable3a);
const hash3b = hashObject(hashable3b);
console.log("Hash with ETH first:", hash3a);
console.log("Hash with SOL first:", hash3b);
console.log("Hashes match:", hash3a === hash3b);

// Test 4: Empty vs null sellerWallets
console.log("\nTest 4: Empty object vs null sellerWallets");
const tx4a = createTestTransaction({
  type: "LISTING_CREATE",
  sellerWallets: {}
});
const tx4b = createTestTransaction({
  type: "LISTING_CREATE",
  sellerWallets: null
});
const hashable4a = hashableTransaction(tx4a);
const hashable4b = hashableTransaction(tx4b);
console.log("Empty object sellerWallets:", hashable4a.sellerWallets);
console.log("Null sellerWallets:", hashable4b.sellerWallets);
console.log("Should be different:", hashable4a.sellerWallets !== hashable4b.sellerWallets);

// Test 5: String vs number quantity
console.log("\nTest 5: String vs number quantity");
const tx5a = createTestTransaction({ quantity: 5 });
const tx5b = createTestTransaction({ quantity: "5" });
const hashable5a = hashableTransaction(tx5a);
const hashable5b = hashableTransaction(tx5b);
console.log("Number quantity:", hashable5a.quantity, typeof hashable5a.quantity);
console.log("String quantity:", hashable5b.quantity, typeof hashable5b.quantity);
console.log("Should be same:", hashable5a.quantity === hashable5b.quantity);

// Test 6: Different null representations
console.log("\nTest 6: Undefined vs null handling");
const tx6a = createTestTransaction({ listingId: null });
const tx6b = createTestTransaction({ listingId: undefined });
const hashable6a = hashableTransaction(tx6a);
const hashable6b = hashableTransaction(tx6b);
console.log("Null listingId:", hashable6a.listingId);
console.log("Undefined listingId:", hashable6b.listingId);
console.log("Should be same (both null):", hashable6a.listingId === hashable6b.listingId);

// Test 7: BundleSale boolean vs string
console.log("\nTest 7: BundleSale boolean vs string");
const tx7a = createTestTransaction({ bundleSale: true });
const tx7b = createTestTransaction({ bundleSale: "true" });
const tx7c = createTestTransaction({ bundleSale: false });
const hashable7a = hashableTransaction(tx7a);
const hashable7b = hashableTransaction(tx7b);
const hashable7c = hashableTransaction(tx7c);
console.log("Boolean true:", hashable7a.bundleSale, typeof hashable7a.bundleSale);
console.log("String 'true':", hashable7b.bundleSale, typeof hashable7b.bundleSale);
console.log("Boolean false:", hashable7c.bundleSale, typeof hashable7c.bundleSale);
console.log("true values should match:", hashable7a.bundleSale === hashable7b.bundleSale);

// Test 8: Address case normalization
console.log("\nTest 8: Address case normalization");
const tx8a = createTestTransaction({ buyer: "0xABCDEF", seller: "0xabcdef" });
const tx8b = createTestTransaction({ buyer: "0xabcdef", seller: "0xABCDEF" });
const hashable8a = hashableTransaction(tx8a);
const hashable8b = hashableTransaction(tx8b);
console.log("Mixed case buyer:", hashable8a.buyer);
console.log("Mixed case seller:", hashable8a.seller);
console.log("Should be lowercase:", hashable8a.buyer === "0xabcdef" && hashable8a.seller === "0xabcdef");

console.log("\n=== Tests Complete ===");

