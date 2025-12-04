#!/usr/bin/env node
// backend/scripts/fixExistingTransactionNumbers.js
/**
 * Fix transaction numbers for existing transactions by assigning sequential numbers
 * based on timestamp order, then update counter
 */

import connectDB from "../db.js";
import { logInfo, logError } from "../utils/logger.js";

async function fixExistingTransactionNumbers() {
  const db = await connectDB();
  const txCollection = db.collection("transactions");
  const counterCollection = db.collection("counters");

  logInfo("[fixExistingTransactionNumbers] Starting fix...");

  // Get all transactions sorted by timestamp (oldest first)
  const allTransactions = await txCollection
    .find({})
    .sort({ timestamp: 1 })
    .toArray();

  logInfo(`[fixExistingTransactionNumbers] Found ${allTransactions.length} transactions`);

  if (allTransactions.length === 0) {
    logInfo("[fixExistingTransactionNumbers] No transactions found. Nothing to fix.");
    return;
  }

  let fixed = 0;

  // Assign sequential numbers starting from 1
  for (let i = 0; i < allTransactions.length; i++) {
    const tx = allTransactions[i];
    const correctNumber = i + 1;
    const currentNumber = tx.transaction_number;

    try {
      if (currentNumber !== correctNumber) {
        await txCollection.updateOne(
          { _id: tx._id },
          { $set: { transaction_number: correctNumber } }
        );
        
        logInfo(`[fixExistingTransactionNumbers] Fixed: ${tx.type} - ${tx._id.slice(0, 16)}...: ${currentNumber || 'missing'} → ${correctNumber}`);
        fixed++;
      }
    } catch (error) {
      logError(`[fixExistingTransactionNumbers] Error fixing transaction ${tx._id}:`, error);
    }
  }

  // Update counter to match the highest transaction number
  const highestNumber = allTransactions.length;
  await counterCollection.updateOne(
    { _id: "transaction_number" },
    { $set: { value: highestNumber } },
    { upsert: true }
  );

  logInfo(`[fixExistingTransactionNumbers] Summary:`);
  logInfo(`  - Fixed: ${fixed} transactions`);
  logInfo(`  - Counter set to: ${highestNumber}`);
  logInfo(`[fixExistingTransactionNumbers] Fix complete!`);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  fixExistingTransactionNumbers()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      logError("[fixExistingTransactionNumbers] Fatal error:", error);
      process.exit(1);
    });
}

export { fixExistingTransactionNumbers };

