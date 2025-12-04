#!/usr/bin/env node
// backend/scripts/fixTransactionNumbers.js
/**
 * Migration script to fix transaction numbers for existing transactions
 * 
 * This script:
 * 1. Finds all transactions sorted by timestamp
 * 2. Assigns sequential transaction numbers starting from 1
 * 3. Updates the counter to match the highest transaction number
 * 4. Logs any duplicate or missing transaction numbers
 */

import connectDB from "../db.js";
import { logInfo, logError } from "../utils/logger.js";

async function fixTransactionNumbers() {
  const db = await connectDB();
  const txCollection = db.collection("transactions");
  const counterCollection = db.collection("counters");

  logInfo("[fixTransactionNumbers] Starting transaction number fix...");

  // Get all transactions sorted by timestamp (oldest first)
  const allTransactions = await txCollection
    .find({})
    .sort({ timestamp: 1 })
    .toArray();

  logInfo(`[fixTransactionNumbers] Found ${allTransactions.length} transactions`);

  if (allTransactions.length === 0) {
    logInfo("[fixTransactionNumbers] No transactions found. Nothing to fix.");
    return;
  }

  let fixed = 0;
  let skipped = 0;
  let errors = 0;

  // Assign sequential numbers starting from 1
  for (let i = 0; i < allTransactions.length; i++) {
    const tx = allTransactions[i];
    const expectedNumber = i + 1;
    const currentNumber = tx.transaction_number;

    try {
      // Check if transaction number needs fixing
      if (currentNumber !== expectedNumber) {
        await txCollection.updateOne(
          { _id: tx._id },
          { $set: { transaction_number: expectedNumber } }
        );
        
        logInfo(`[fixTransactionNumbers] Fixed transaction ${tx._id.slice(0, 16)}...: ${currentNumber || 'missing'} → ${expectedNumber}`);
        fixed++;
      } else {
        skipped++;
      }
    } catch (error) {
      logError(`[fixTransactionNumbers] Error fixing transaction ${tx._id}:`, error);
      errors++;
    }
  }

  // Update counter to match the highest transaction number
  const highestNumber = allTransactions.length;
  await counterCollection.updateOne(
    { _id: "transaction_number" },
    { $set: { value: highestNumber } },
    { upsert: true }
  );

  logInfo(`[fixTransactionNumbers] Summary:`);
  logInfo(`  - Fixed: ${fixed}`);
  logInfo(`  - Already correct: ${skipped}`);
  logInfo(`  - Errors: ${errors}`);
  logInfo(`  - Counter set to: ${highestNumber}`);

  // Verify: Check for duplicates
  const duplicates = await txCollection.aggregate([
    { $group: { _id: "$transaction_number", count: { $sum: 1 }, transactions: { $push: "$_id" } } },
    { $match: { count: { $gt: 1 } } }
  ]).toArray();

  if (duplicates.length > 0) {
    logError(`[fixTransactionNumbers] WARNING: Found ${duplicates.length} duplicate transaction numbers:`, duplicates);
  } else {
    logInfo("[fixTransactionNumbers] ✓ No duplicate transaction numbers found");
  }

  logInfo("[fixTransactionNumbers] Fix complete!");
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  fixTransactionNumbers()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      logError("[fixTransactionNumbers] Fatal error:", error);
      process.exit(1);
    });
}

export { fixTransactionNumbers };

