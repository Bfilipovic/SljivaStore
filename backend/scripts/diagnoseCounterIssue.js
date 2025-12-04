#!/usr/bin/env node
// backend/scripts/diagnoseCounterIssue.js
/**
 * Diagnose why transactions might all have number 1
 */

import connectDB from "../db.js";
import { logInfo } from "../utils/logger.js";

async function diagnoseCounterIssue() {
  const db = await connectDB();
  
  // Check counter
  const counter = await db.collection("counters").findOne({ _id: "transaction_number" });
  logInfo(`\n=== COUNTER STATE ===`);
  logInfo(`Counter value: ${counter?.value || "not set"}`);
  
  // Check transactions
  const allTx = await db.collection("transactions").find({}).sort({ timestamp: 1 }).toArray();
  logInfo(`\n=== TRANSACTION STATE ===`);
  logInfo(`Total transactions: ${allTx.length}`);
  
  // Count by transaction_number
  const byNumber = {};
  allTx.forEach(tx => {
    const num = tx.transaction_number || 'missing';
    if (!byNumber[num]) byNumber[num] = [];
    byNumber[num].push({ type: tx.type, _id: tx._id.slice(0, 16) + '...' });
  });
  
  logInfo(`\nTransactions grouped by transaction_number:`);
  Object.keys(byNumber).sort().forEach(num => {
    logInfo(`  Number ${num}: ${byNumber[num].length} transaction(s)`);
    byNumber[num].forEach(tx => logInfo(`    - ${tx.type}: ${tx._id}`));
  });
  
  // Analyze the problem
  logInfo(`\n=== DIAGNOSIS ===`);
  const counterValue = counter?.value || 0;
  const maxTxNumber = Math.max(...allTx.map(tx => tx.transaction_number || 0));
  
  if (counterValue === maxTxNumber) {
    logInfo(`✓ Counter (${counterValue}) matches max transaction number (${maxTxNumber})`);
  } else {
    logInfo(`✗ MISMATCH: Counter (${counterValue}) != max transaction number (${maxTxNumber})`);
  }
  
  if (allTx.every(tx => tx.transaction_number === 1)) {
    logInfo(`✗ PROBLEM: All transactions have number 1`);
    logInfo(`   This means transaction numbering was broken, not the counter`);
    logInfo(`   Counter was at ${counterValue}, but transactions were saved with 1`);
  } else if (Object.keys(byNumber).length === allTx.length && allTx.length > 0) {
    logInfo(`✓ All transactions have unique numbers`);
  }
  
  process.exit(0);
}

diagnoseCounterIssue().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});

