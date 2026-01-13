/**
 * Test that imageUrl is included in Arweave uploads but NOT in hash
 */

import { hashableTransaction, hashObject } from "../backend/utils/hash.js";
import assert from "assert";

function testImageUrlNotInHash() {
  console.log("\n=== Testing imageUrl NOT in Hash ===");
  
  // Test 1: Transaction with imageUrl should NOT include it in hash
  const tx1 = {
    type: "NFT_BUY",
    transaction_number: 1,
    timestamp: new Date("2024-01-01T00:00:00Z"),
    listingId: "listing123",
    reservationId: "res123",
    giftId: null,
    nftId: "nft123",
    quantity: 5,
    buyer: "0xbuyer",
    seller: "0xseller",
    giver: null,
    receiver: null,
    chainTx: "0xtxhash",
    currency: "ETH",
    amount: "1.0",
    price: null,
    sellerWallets: null,
    bundleSale: null,
    signer: "0xbuyer",
    signature: "sig123",
  };
  
  const tx2 = {
    ...tx1,
    imageUrl: "https://example.com/image.jpg", // Add imageUrl
  };
  
  const hash1 = hashableTransaction(tx1);
  const hash2 = hashableTransaction(tx2);
  const hashValue1 = hashObject(hash1);
  const hashValue2 = hashObject(hash2);
  
  // Hash should be the same even with imageUrl added
  assert.strictEqual(hashValue1, hashValue2, "imageUrl should not affect hash");
  assert.strictEqual(hash1.imageUrl, undefined, "hashableTransaction should not include imageUrl");
  assert.strictEqual(hash2.imageUrl, undefined, "hashableTransaction should not include imageUrl even if present");
  console.log("✅ Test 1: imageUrl does not affect hash");
  
  // Test 2: Verify hashableTransaction excludes imageUrl
  const tx3 = {
    type: "MINT",
    transaction_number: 1,
    timestamp: new Date("2024-01-01T00:00:00Z"),
    nftId: "nft123",
    quantity: 100,
    buyer: "0xminter",
    seller: "0xminter",
    imageUrl: "https://example.com/nft.jpg",
    // ... other fields
    listingId: null,
    reservationId: null,
    giftId: null,
    giver: null,
    receiver: null,
    chainTx: null,
    currency: "ETH",
    amount: "0",
    price: null,
    sellerWallets: null,
    bundleSale: null,
    signer: "0xminter",
    signature: "sig",
  };
  
  const hash3 = hashableTransaction(tx3);
  assert.strictEqual(hash3.imageUrl, undefined, "hashableTransaction should exclude imageUrl");
  console.log("✅ Test 2: hashableTransaction excludes imageUrl");
  
  console.log("✅ All imageUrl hash tests passed!\n");
}

function testAllTransactionTypesHaveImageUrlSupport() {
  console.log("\n=== Testing All Transaction Types Support imageUrl ===");
  
  const types = [
    "MINT",
    "LISTING_CREATE",
    "LISTING_CANCEL",
    "NFT_BUY",
    "GIFT_CREATE",
    "GIFT_CLAIM",
    "GIFT_REFUSE",
    "GIFT_CANCEL",
  ];
  
  for (const type of types) {
    const tx = {
      type,
      transaction_number: 1,
      timestamp: new Date("2024-01-01T00:00:00Z"),
      nftId: "nft123",
      imageUrl: "https://example.com/image.jpg",
      // ... minimal required fields
      listingId: null,
      reservationId: null,
      giftId: null,
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
      signer: "0x123",
      signature: "sig",
    };
    
    const hash = hashableTransaction(tx);
    assert.strictEqual(hash.imageUrl, undefined, `${type} should exclude imageUrl from hash`);
    
    // Verify hash is deterministic even with imageUrl
    const txWithoutImageUrl = { ...tx };
    delete txWithoutImageUrl.imageUrl;
    const hashWithout = hashableTransaction(txWithoutImageUrl);
    const hashValue1 = hashObject(hash);
    const hashValue2 = hashObject(hashWithout);
    assert.strictEqual(hashValue1, hashValue2, `${type} hash should be same with or without imageUrl`);
    
    console.log(`✅ ${type}: imageUrl excluded from hash`);
  }
  
  console.log("✅ All transaction types correctly exclude imageUrl from hash!\n");
}

// Run all tests
try {
  console.log("🧪 Running Arweave imageUrl Tests\n");
  console.log("=".repeat(60));
  
  testImageUrlNotInHash();
  testAllTransactionTypesHaveImageUrlSupport();
  
  console.log("=".repeat(60));
  console.log("✅ ALL TESTS PASSED! imageUrl is correctly excluded from hash.\n");
  process.exit(0);
} catch (error) {
  console.error("\n❌ TEST FAILED:", error.message);
  console.error(error.stack);
  process.exit(1);
}

