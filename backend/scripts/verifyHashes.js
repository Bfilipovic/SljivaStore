// backend/scripts/verifyHashes.js
/**
 * Script to verify hash integrity of records.
 * 
 * Checks if existing records already comply with hash-based verification:
 * - NFTs: _id matches hash of all fields
 * - Parts: _id matches hash of all fields (immutable fields at creation)
 * - Transactions: _id matches hash of all fields (all types: TRANSACTION, GIFT, MINT)
 * 
 * Usage:
 *   node backend/scripts/verifyHashes.js
 */

import connectDB from "../db.js";
import { 
  hashObject, 
  hashableNFT, 
  hashablePart,
  hashablePartId,
  hashableTransaction,
  verifyRecordHash 
} from "../utils/hash.js";

async function verifyNFTs() {
  const db = await connectDB();
  const nfts = await db.collection("nfts").find({}).toArray();
  
  let compliant = 0;
  let nonCompliant = 0;
  const issues = [];
  
  for (const nft of nfts) {
    const isCompliant = verifyRecordHash(nft, hashableNFT);
    if (isCompliant) {
      compliant++;
    } else {
      nonCompliant++;
      const expectedHash = hashObject(hashableNFT(nft));
      issues.push({
        type: "NFT",
        _id: nft._id,
        currentId: String(nft._id),
        expectedHash,
        mismatch: String(nft._id) !== expectedHash
      });
    }
  }
  
  return { compliant, nonCompliant, issues, total: nfts.length };
}

async function verifyParts() {
  const db = await connectDB();
  const parts = await db.collection("parts").find({}).toArray();
  
  let compliant = 0;
  let nonCompliant = 0;
  const issues = [];
  
  for (const part of parts) {
    // Parts use hashablePartId for stable _id based on immutable fields
    const expectedId = hashObject(hashablePartId(part));
    const isCompliant = String(part._id) === expectedId;
    
    if (isCompliant) {
      compliant++;
    } else {
      nonCompliant++;
      issues.push({
        type: "Part",
        _id: part._id,
        currentId: String(part._id),
        expectedId,
        mismatch: String(part._id) !== expectedId,
        part_no: part.part_no,
        parent_hash: part.parent_hash
      });
    }
  }
  
  return { compliant, nonCompliant, issues, total: parts.length };
}

async function verifyTransactions() {
  const db = await connectDB();
  const transactions = await db.collection("transactions").find({}).toArray();
  
  let compliant = 0;
  let nonCompliant = 0;
  const issues = [];
  
  for (const tx of transactions) {
    const isCompliant = verifyRecordHash(tx, hashableTransaction);
    if (isCompliant) {
      compliant++;
    } else {
      nonCompliant++;
      const expectedHash = hashObject(hashableTransaction(tx));
      const isObjectId = /^[0-9a-f]{24}$/i.test(String(tx._id));
      issues.push({
        type: "Transaction",
        _id: tx._id,
        txType: tx.type || "TRANSACTION",
        currentId: String(tx._id),
        expectedHash,
        isObjectId,
        mismatch: String(tx._id) !== expectedHash
      });
    }
  }
  
  return { compliant, nonCompliant, issues, total: transactions.length };
}

async function main() {
  console.log("🔍 Verifying hash integrity of all records...\n");
  
  try {
    await connectDB();
    console.log("✅ Connected to database\n");
    
    // Verify NFTs
    console.log("📦 Verifying NFTs...");
    const nftResults = await verifyNFTs();
    console.log(`   ✅ Compliant: ${nftResults.compliant}/${nftResults.total}`);
    console.log(`   ❌ Non-compliant: ${nftResults.nonCompliant}/${nftResults.total}`);
    
    // Verify Parts
    console.log("\n🧩 Verifying Parts...");
    const partResults = await verifyParts();
    console.log(`   ✅ Compliant: ${partResults.compliant}/${partResults.total}`);
    console.log(`   ❌ Non-compliant: ${partResults.nonCompliant}/${partResults.total}`);
    
    // Verify Transactions
    console.log("\n💸 Verifying Transactions...");
    const txResults = await verifyTransactions();
    console.log(`   ✅ Compliant: ${txResults.compliant}/${txResults.total}`);
    console.log(`   ❌ Non-compliant: ${txResults.nonCompliant}/${txResults.total}`);
    
    // Summary
    const totalCompliant = nftResults.compliant + partResults.compliant + txResults.compliant;
    const totalRecords = nftResults.total + partResults.total + txResults.total;
    const totalNonCompliant = nftResults.nonCompliant + partResults.nonCompliant + txResults.nonCompliant;
    
    console.log("\n" + "=".repeat(60));
    console.log("📊 Summary:");
    console.log(`   Total Records: ${totalRecords}`);
    console.log(`   ✅ Compliant: ${totalCompliant}`);
    console.log(`   ❌ Non-compliant: ${totalNonCompliant}`);
    console.log("=".repeat(60));
    
    // Show sample issues
    const allIssues = [...nftResults.issues, ...partResults.issues, ...txResults.issues];
    if (allIssues.length > 0) {
      console.log("\n⚠️  Sample issues (first 5):");
      allIssues.slice(0, 5).forEach((issue, idx) => {
        console.log(`\n   ${idx + 1}. ${issue.type} (${issue.txType || "N/A"})`);
        const expected = issue.expectedHash || issue.expectedId;
        console.log(`      Current ID: ${String(issue.currentId || issue._id).substring(0, 16)}...`);
        if (expected) {
          console.log(`      Expected:   ${String(expected).substring(0, 16)}...`);
        }
        if (issue.isObjectId) {
          console.log(`      Note: This record uses ObjectId instead of hash`);
        }
        if (issue.part_no !== undefined) {
          console.log(`      Part #${issue.part_no} of NFT ${String(issue.parent_hash).substring(0, 16)}...`);
        }
      });
      
      if (allIssues.length > 5) {
        console.log(`\n   ... and ${allIssues.length - 5} more issues`);
      }
    }
    
    if (totalNonCompliant === 0) {
      console.log("\n✅ All records are compliant with hash-based verification!");
    } else {
      console.log(`\n⚠️  ${totalNonCompliant} record(s) need to be updated to use hash-based IDs.`);
      console.log("   Run migration script to update non-compliant records (if needed).");
    }
    
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
