#!/usr/bin/env node

/**
 * Integration Test: Hash-Based Verification with Full Transaction Flow
 * 
 * Tests the complete flow:
 * 1. Create two test users
 * 2. User 1 mints an NFT with parts
 * 3. User 1 sells a part (creates listing)
 * 4. User 2 buys the part (creates reservation and transaction)
 * 5. User 2 gifts the part back to User 1
 * 6. Verify part has exactly 2 transactions (TRANSACTION and GIFT)
 * 7. Verify all records use hash-based IDs
 */

import connectDB from "../backend/db.js";
import { addAdmin } from "../backend/services/adminService.js";
import { mintNFT } from "../backend/services/nftService.js";
import { createListing } from "../backend/services/listingService.js";
import { createReservation } from "../backend/services/reservationService.js";
import { createTransaction } from "../backend/services/transactionService.js";
import { createGift } from "../backend/services/giftService.js";
import { claimGift } from "../backend/services/giftService.js";
import { getPartById } from "../backend/services/partService.js";
import { getPartialTransactionsByPart } from "../backend/services/transactionService.js";
import { getNFTById } from "../backend/services/nftService.js";
import { hashObject, hashableNFT, hashablePartId, hashableTransaction, verifyRecordHash } from "../backend/utils/hash.js";

// Test utilities
function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function logTest(testName, passed) {
  const status = passed ? '✅' : '❌';
  console.log(`${status} ${testName}`);
}

// Test addresses (dummy addresses for testing)
const USER1_ADDRESS = "0x1111111111111111111111111111111111111111";
const USER2_ADDRESS = "0x2222222222222222222222222222222222222222";

async function cleanupTestData() {
  const db = await connectDB();
  
  // Clean up test data (in reverse order of dependencies)
  await db.collection("partialtransactions").deleteMany({
    $or: [
      { from: USER1_ADDRESS.toLowerCase() },
      { to: USER1_ADDRESS.toLowerCase() },
      { from: USER2_ADDRESS.toLowerCase() },
      { to: USER2_ADDRESS.toLowerCase() }
    ]
  });
  
  await db.collection("transactions").deleteMany({
    $or: [
      { buyer: USER1_ADDRESS.toLowerCase() },
      { seller: USER1_ADDRESS.toLowerCase() },
      { buyer: USER2_ADDRESS.toLowerCase() },
      { seller: USER2_ADDRESS.toLowerCase() },
      { giver: USER1_ADDRESS.toLowerCase() },
      { receiver: USER1_ADDRESS.toLowerCase() },
      { giver: USER2_ADDRESS.toLowerCase() },
      { receiver: USER2_ADDRESS.toLowerCase() }
    ]
  });
  
  await db.collection("gifts").deleteMany({
    $or: [
      { giver: USER1_ADDRESS.toLowerCase() },
      { receiver: USER1_ADDRESS.toLowerCase() },
      { giver: USER2_ADDRESS.toLowerCase() },
      { receiver: USER2_ADDRESS.toLowerCase() }
    ]
  });
  
  await db.collection("reservations").deleteMany({
    reserver: USER2_ADDRESS.toLowerCase()
  });
  
  await db.collection("listings").deleteMany({
    seller: USER1_ADDRESS.toLowerCase()
  });
  
  // Find and delete test NFTs and parts
  const testNFTs = await db.collection("nfts").find({
    creator: USER1_ADDRESS.toLowerCase()
  }).toArray();
  
  for (const nft of testNFTs) {
    await db.collection("parts").deleteMany({ parent_hash: nft._id });
    await db.collection("nfts").deleteOne({ _id: nft._id });
  }
  
  // Clean up admins (optional - comment out if you want to keep test users as admins)
  // await db.collection("admins").deleteMany({
  //   address: { $in: [USER1_ADDRESS.toLowerCase(), USER2_ADDRESS.toLowerCase()] }
  // });
}

async function testFullTransactionFlow() {
  let nftId = null;
  let partId = null;
  let listingId = null;
  let reservationId = null;
  let transactionId1 = null;
  let giftId = null;
  let transactionId2 = null;
  
  try {
    console.log("\n🧪 Starting Full Transaction Flow Test...\n");
    
    const db = await connectDB();
    
    // Setup: Make users admins so they can mint
    await addAdmin(USER1_ADDRESS);
    await addAdmin(USER2_ADDRESS);
    console.log("✓ Set up test users as admins");
    
    // Step 1: User 1 mints an NFT with 10 parts
    console.log("\n📦 Step 1: Minting NFT...");
    const mintResult = await mintNFT(
      {
        name: "Test NFT for Hash Verification",
        description: "Integration test NFT",
        parts: 10,
        imageUrl: "https://example.com/test-image.png",
        creator: USER1_ADDRESS
      },
      USER1_ADDRESS
    );
    
    nftId = mintResult.nftId;
    assert(nftId, "NFT should be created with an ID");
    console.log(`  ✓ NFT minted: ${nftId.substring(0, 16)}...`);
    
    // Verify NFT uses hash-based ID
    const nft = await getNFTById(nftId);
    assert(nft, "NFT should exist in database");
    const isNFTCompliant = verifyRecordHash(nft, hashableNFT);
    assert(isNFTCompliant, "NFT should use hash-based ID");
    console.log(`  ✓ NFT uses hash-based ID`);
    
    // Get the first part
    const parts = await db.collection("parts")
      .find({ parent_hash: nftId })
      .sort({ part_no: 1 })
      .limit(1)
      .toArray();
    
    assert(parts.length > 0, "NFT should have parts");
    partId = parts[0]._id;
    console.log(`  ✓ Found test part: ${partId.substring(0, 16)}...`);
    
    // Verify part uses hash-based ID
    const expectedPartId = hashObject(hashablePartId(parts[0]));
    assert(String(partId) === expectedPartId, "Part should use hash-based ID");
    console.log(`  ✓ Part uses hash-based ID`);
    
    // Step 2: User 1 creates a listing for 1 part
    console.log("\n💰 Step 2: Creating listing...");
    listingId = await createListing(
      {
        price: "1.5",
        nftId: nftId,
        seller: USER1_ADDRESS,
        sellerWallets: { ETH: USER1_ADDRESS },
        quantity: 1,
        bundleSale: false
      },
      USER1_ADDRESS
    );
    
    assert(listingId, "Listing should be created with an ID");
    console.log(`  ✓ Listing created: ${listingId}`);
    
    // Step 3: User 2 creates a reservation
    console.log("\n🔒 Step 3: Creating reservation...");
    const reservationResult = await createReservation({
      listingId: listingId,
      reserver: USER2_ADDRESS,
      quantity: 1,
      currency: "ETH",
      buyerWallet: USER2_ADDRESS
    });
    
    reservationId = reservationResult._id || reservationResult;
    assert(reservationId, "Reservation should be created with an ID");
    console.log(`  ✓ Reservation created: ${reservationId}`);
    
    // Step 4: User 2 completes the transaction (buys the part)
    console.log("\n💸 Step 4: Completing transaction (User 2 buys from User 1)...");
    transactionId1 = await createTransaction(
      {
        listingId: listingId,
        reservationId: reservationId,
        buyer: USER2_ADDRESS,
        chainTx: "0x" + "a".repeat(64), // Dummy chain transaction hash
        timestamp: Date.now()
      },
      USER2_ADDRESS
    );
    
    assert(transactionId1, "Transaction should be created with an ID");
    console.log(`  ✓ Transaction created: ${transactionId1.substring(0, 16)}...`);
    
    // Verify transaction uses hash-based ID
    const tx1 = await db.collection("transactions").findOne({
      _id: transactionId1
    });
    assert(tx1, "Transaction should exist in database");
    const isTx1Compliant = verifyRecordHash(tx1, hashableTransaction);
    assert(isTx1Compliant, "Transaction should use hash-based ID");
    assert(tx1.type === "TRANSACTION", "Transaction type should be TRANSACTION");
    assert(tx1.buyer === USER2_ADDRESS.toLowerCase(), "Buyer should be User 2");
    assert(tx1.seller === USER1_ADDRESS.toLowerCase(), "Seller should be User 1");
    console.log(`  ✓ Transaction uses hash-based ID and has correct type`);
    
    // Verify part ownership changed
    const partAfterPurchase = await getPartById(partId);
    assert(partAfterPurchase.owner === USER2_ADDRESS.toLowerCase(), "Part should be owned by User 2");
    console.log(`  ✓ Part ownership transferred to User 2`);
    
    // Step 5: User 2 gifts the part back to User 1
    console.log("\n🎁 Step 5: Creating gift (User 2 to User 1)...");
    giftId = await createGift(
      {
        giver: USER2_ADDRESS,
        receiver: USER1_ADDRESS,
        nftId: nftId,
        quantity: 1
      },
      USER2_ADDRESS
    );
    
    assert(giftId, "Gift should be created with an ID");
    console.log(`  ✓ Gift created: ${giftId}`);
    
    // Claim the gift
    console.log("\n🎁 Step 6: Claiming gift...");
    transactionId2 = await claimGift(
      {
        giftId: giftId,
        chainTx: null // Gifts can be off-chain
      },
      USER1_ADDRESS
    );
    
    assert(transactionId2, "Gift transaction should be created with an ID");
    console.log(`  ✓ Gift transaction created: ${transactionId2.substring(0, 16)}...`);
    
    // Verify gift transaction uses hash-based ID
    const tx2 = await db.collection("transactions").findOne({
      _id: transactionId2
    });
    assert(tx2, "Gift transaction should exist in database");
    const isTx2Compliant = verifyRecordHash(tx2, hashableTransaction);
    assert(isTx2Compliant, "Gift transaction should use hash-based ID");
    assert(tx2.type === "GIFT", "Transaction type should be GIFT");
    assert(tx2.giver === USER2_ADDRESS.toLowerCase(), "Giver should be User 2");
    assert(tx2.receiver === USER1_ADDRESS.toLowerCase(), "Receiver should be User 1");
    console.log(`  ✓ Gift transaction uses hash-based ID and has correct type`);
    
    // Verify part ownership changed back
    const partAfterGift = await getPartById(partId);
    assert(partAfterGift.owner === USER1_ADDRESS.toLowerCase(), "Part should be owned by User 1 again");
    console.log(`  ✓ Part ownership transferred back to User 1`);
    
    // Step 6: Verify part has exactly 2 transactions
    console.log("\n🔍 Step 7: Verifying part transaction history...");
    const { items: partialTransactions } = await getPartialTransactionsByPart(partId, { limit: 100 });
    
    assert(partialTransactions.length === 2, `Part should have exactly 2 transactions, found ${partialTransactions.length}`);
    console.log(`  ✓ Part has exactly ${partialTransactions.length} transactions`);
    
    // Verify transaction order and details
    const sortedTxs = partialTransactions.sort((a, b) => 
      new Date(a.timestamp) - new Date(b.timestamp)
    );
    
    // First transaction should be TRANSACTION (buy)
    assert(sortedTxs[0].transaction === transactionId1, "First transaction should be the purchase");
    const tx1Part = sortedTxs[0];
    assert(tx1Part.from === USER1_ADDRESS.toLowerCase(), "First tx: from should be User 1");
    assert(tx1Part.to === USER2_ADDRESS.toLowerCase(), "First tx: to should be User 2");
    console.log(`  ✓ First transaction: ${tx1Part.from.substring(0, 8)}... → ${tx1Part.to.substring(0, 8)}...`);
    
    // Second transaction should be GIFT
    assert(sortedTxs[1].transaction === transactionId2, "Second transaction should be the gift");
    const tx2Part = sortedTxs[1];
    assert(tx2Part.from === USER2_ADDRESS.toLowerCase(), "Second tx: from should be User 2");
    assert(tx2Part.to === USER1_ADDRESS.toLowerCase(), "Second tx: to should be User 1");
    console.log(`  ✓ Second transaction: ${tx2Part.from.substring(0, 8)}... → ${tx2Part.to.substring(0, 8)}...`);
    
    // Verify no redundant txId field
    assert(tx1Part.txId === undefined || tx1Part.txId === null, "Partial transaction should not have redundant txId field");
    assert(tx1Part.transaction, "Partial transaction should have transaction field");
    console.log(`  ✓ No redundant txId field in partial transactions`);
    
    // Final verification: Part still uses hash-based ID
    const finalPart = await getPartById(partId);
    const finalPartId = hashObject(hashablePartId(finalPart));
    assert(String(finalPart._id) === finalPartId, "Part should still use hash-based ID after transactions");
    console.log(`  ✓ Part still uses hash-based ID`);
    
    console.log("\n✅ All assertions passed!");
    logTest('Full Transaction Flow with Hash Verification', true);
    return true;
    
  } catch (error) {
    console.error("\n❌ Test failed:", error.message);
    console.error(error.stack);
    logTest('Full Transaction Flow with Hash Verification', false);
    return false;
  } finally {
    // Cleanup
    console.log("\n🧹 Cleaning up test data...");
    await cleanupTestData();
    console.log("✓ Cleanup complete");
  }
}

// Main test runner
async function runTests() {
  console.log('🧪 Integration Test: Hash-Based Verification with Full Transaction Flow');
  console.log('='.repeat(70));
  
  
  const results = [];
  results.push(await testFullTransactionFlow());
  
  const passed = results.filter(Boolean).length;
  const total = results.length;
  
  console.log('\n' + '='.repeat(70));
  console.log(`📊 Integration Tests: ${passed}/${total} passed`);
  
  if (passed === total) {
    console.log('✅ All integration tests passed!');
    process.exit(0);
  } else {
    console.log('❌ Some integration tests failed!');
    process.exit(1);
  }
}

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
