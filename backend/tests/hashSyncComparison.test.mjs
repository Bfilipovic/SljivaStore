// backend/tests/hashSyncComparison.test.mjs
/**
 * Hash Synchronization Comparison Test
 * 
 * This test compares hash functions from backend and explorer to ensure they produce identical results.
 * This is CRITICAL for transaction verification to work correctly.
 * 
 * If this test fails, DO NOT COMMIT. Fix the hash function implementations first.
 */

import { hashObject, hashableTransaction } from "../utils/hash.js";
import { writeFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { execSync } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, "../..");
const EXPLORER_DIR = join(PROJECT_ROOT, "explorer");

/**
 * Create test transaction objects for all transaction types
 */
function createTestTransactions() {
  const baseTimestamp = new Date("2024-01-01T00:00:00.000Z");
  
  return {
    MINT: {
      type: "MINT",
      transaction_number: 1,
      timestamp: baseTimestamp,
      nftId: "nft_mint_123",
      quantity: 100,
      signer: "0xCREATOR",
      signature: "0xsig_mint",
      _id: "should_be_excluded",
      arweaveTxId: "should_be_excluded"
    },
    LISTING_CREATE: {
      type: "LISTING_CREATE",
      transaction_number: 2,
      timestamp: baseTimestamp,
      listingId: "listing_123",
      nftId: "nft_123",
      quantity: 10,
      price: "100.5",
      seller: "0xSELLER",
      sellerWallets: { ETH: "0xSELLER_ETH", SOL: "0xSELLER_SOL" },
      bundleSale: false,
      signer: "0xSELLER",
      signature: "0xsig_listing_create",
      _id: "should_be_excluded"
    },
    NFT_BUY: {
      type: "NFT_BUY",
      transaction_number: 4,
      timestamp: baseTimestamp,
      listingId: "listing_123",
      reservationId: "reservation_123",
      nftId: "nft_123",
      quantity: 5,
      price: "100.5",
      buyer: "0xBUYER",
      seller: "0xSELLER",
      chainTx: "0xchain_tx_hash",
      currency: "ETH",
      amount: "0.1",
      bundleSale: false,
      signer: "0xBUYER",
      signature: "0xsig_buy",
      _id: "should_be_excluded"
    },
    GIFT_CLAIM: {
      type: "GIFT_CLAIM",
      transaction_number: 6,
      timestamp: baseTimestamp,
      giftId: "gift_123",
      nftId: "nft_123",
      quantity: 3,
      giver: "0xGIVER",
      receiver: "0xRECEIVER",
      chainTx: "0xchain_tx_hash",
      currency: "ETH",
      amount: "0",
      signer: "0xRECEIVER",
      signature: "0xsig_gift_claim",
      _id: "should_be_excluded"
    },
    UPLOAD: {
      type: "UPLOAD",
      transaction_number: 9,
      timestamp: baseTimestamp,
      uploadId: "upload_123",
      uploadedimageurl: "https://arweave.net/image123",
      uploadedimagedescription: "Test image description",
      uploadedimagename: "test_image.jpg",
      isVerificationConfirmation: true,
      verifiedUserUsername: "testuser",
      verifiedUserBio: "Test bio",
      verifiedUserEmail: "test@example.com",
      signer: "0xUPLOADER",
      signature: "0xsig_upload",
      _id: "should_be_excluded"
    },
    // Edge cases
    emptyStrings: {
      type: "NFT_BUY",
      transaction_number: 10,
      timestamp: baseTimestamp,
      buyer: "0xBUYER",
      seller: "0xSELLER",
      chainTx: "", // Should normalize to null
      currency: "", // Should normalize to null
      amount: "", // Should normalize to null
      signer: "0xBUYER",
      signature: "0xsig",
      _id: "should_be_excluded"
    },
    uppercaseAddresses: {
      type: "NFT_BUY",
      transaction_number: 12,
      timestamp: baseTimestamp,
      buyer: "0xABCDEF", // Should normalize to lowercase
      seller: "0xFEDCBA", // Should normalize to lowercase
      signer: "0xABCDEF", // Should normalize to lowercase
      signature: "0xsig",
      _id: "should_be_excluded"
    }
  };
}

/**
 * Get backend hash for a transaction
 */
function getBackendHash(transaction) {
  const hashable = hashableTransaction(transaction);
  return hashObject(hashable);
}

/**
 * Get explorer hash for a transaction using Node.js execution
 * Note: Explorer uses Web Crypto API which requires special handling
 */
async function getExplorerHash(transaction) {
  // Create a temporary test file that uses the explorer hash function
  // We need to polyfill Web Crypto API for Node.js
  const testScript = `
    // Polyfill Web Crypto API for Node.js
    import { webcrypto } from "crypto";
    if (typeof globalThis.crypto === "undefined") {
      globalThis.crypto = webcrypto;
    }
    
    import { calculateTransactionHash } from "./src/lib/utils/hash.ts";
    
    const transaction = ${JSON.stringify(transaction, null, 2)};
    
    try {
      const hash = await calculateTransactionHash(transaction);
      console.log(JSON.stringify({ success: true, hash }));
    } catch (error) {
      console.log(JSON.stringify({ success: false, error: error.message, stack: error.stack }));
    }
  `;
  
  const testFile = join(EXPLORER_DIR, ".hash-test-temp.ts");
  writeFileSync(testFile, testScript);
  
  try {
    // Try to run with tsx or ts-node
    let result;
    try {
      // Try tsx first (faster, modern)
      result = execSync(`cd ${EXPLORER_DIR} && npx tsx .hash-test-temp.ts 2>&1`, {
        encoding: "utf-8",
        timeout: 10000
      });
    } catch (error) {
      // Fallback to ts-node
      try {
        result = execSync(`cd ${EXPLORER_DIR} && npx ts-node .hash-test-temp.ts 2>&1`, {
          encoding: "utf-8",
          timeout: 10000
        });
      } catch (error2) {
        throw new Error(`Failed to run TypeScript: ${error.message}. Make sure tsx or ts-node is installed in explorer (cd explorer && npm install tsx --save-dev)`);
      }
    }
    
    // Parse result (may have stderr output)
    const lines = result.trim().split("\n");
    const jsonLine = lines.find(line => line.startsWith("{"));
    if (!jsonLine) {
      throw new Error(`No JSON output found. Output: ${result.substring(0, 200)}`);
    }
    
    const parsed = JSON.parse(jsonLine);
    if (!parsed.success) {
      throw new Error(parsed.error || "Unknown error");
    }
    
    return parsed.hash;
  } finally {
    // Clean up temp file
    if (existsSync(testFile)) {
      execSync(`rm ${testFile}`);
    }
  }
}

/**
 * Compare backend and explorer hashes
 */
async function compareHashes() {
  console.log("\n[hashSync] Comparing backend and explorer hash functions...");
  
  if (!existsSync(EXPLORER_DIR)) {
    console.log("[hashSync] ⚠️  Explorer directory not found, skipping comparison");
    return { passed: 0, failed: 0, skipped: true };
  }
  
  const testTxs = createTestTransactions();
  let passed = 0;
  let failed = 0;
  const failures = [];
  
  for (const [txName, tx] of Object.entries(testTxs)) {
    try {
      const backendHash = getBackendHash(tx);
      const explorerHash = await getExplorerHash(tx);
      
      if (backendHash !== explorerHash) {
        const error = `${txName}: Hash mismatch\n  Backend:  ${backendHash}\n  Explorer: ${explorerHash}`;
        failures.push(error);
        failed++;
        console.error(`[hashSync] ❌ ${error}`);
      } else {
        passed++;
        console.log(`[hashSync] ✓ ${txName}: Hashes match (${backendHash.substring(0, 16)}...)`);
      }
    } catch (error) {
      failures.push(`${txName}: ${error.message}`);
      failed++;
      console.error(`[hashSync] ❌ ${txName}: ${error.message}`);
    }
  }
  
  if (failures.length > 0) {
    console.log("\n[hashSync] FAILURE DETAILS:");
    failures.forEach(f => console.log(`  - ${f}`));
  }
  
  return { passed, failed, skipped: false };
}

/**
 * Main test runner
 */
async function runHashSyncComparison() {
  console.log("\n" + "=".repeat(70));
  console.log("HASH SYNCHRONIZATION COMPARISON TEST");
  console.log("=".repeat(70));
  console.log("\n⚠️  CRITICAL: This test ensures backend and explorer hash functions match.");
  console.log("   If this test fails, DO NOT COMMIT. Fix hash functions first.\n");
  
  try {
    const result = await compareHashes();
    
    console.log("\n" + "=".repeat(70));
    if (result.skipped) {
      console.log("⚠️  COMPARISON SKIPPED (explorer not available)");
      console.log("=".repeat(70));
      console.log("\n💡 To enable comparison tests:");
      console.log("   cd explorer && npm install tsx --save-dev");
      return true; // Don't fail if explorer isn't available
    } else if (result.failed === 0) {
      console.log(`✅ ALL HASHES MATCH (${result.passed} transactions tested)`);
      console.log("=".repeat(70));
      return true;
    } else {
      console.log(`❌ HASH MISMATCH DETECTED (${result.failed} failed, ${result.passed} passed)`);
      console.log("=".repeat(70));
      console.log("\n🔧 ACTION REQUIRED:");
      console.log("   1. Check backend/utils/hash.js hashableTransaction()");
      console.log("   2. Check explorer/src/lib/utils/hash.ts hashableTransaction()");
      console.log("   3. Ensure both functions normalize fields identically");
      console.log("   4. Re-run tests before committing\n");
      return false;
    }
  } catch (error) {
    console.error("\n❌ TEST SUITE ERROR:", error.message);
    console.error(error.stack);
    return false;
  }
}

// Run tests if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runHashSyncComparison().then(success => {
    process.exit(success ? 0 : 1);
  });
}

export { runHashSyncComparison, getBackendHash, getExplorerHash };

