#!/usr/bin/env node
// backend/scripts/checkTransactionNumbers.js

import connectDB from "../db.js";
import { logInfo } from "../utils/logger.js";

async function checkTransactionNumbers() {
  const db = await connectDB();

  // Check counter
  const counter = await db.collection("counters").findOne({ _id: "transaction_number" });
  logInfo(`Counter value: ${counter?.value || "not set"}`);

  // Check all transactions
  const allTx = await db.collection("transactions").find({}).sort({ timestamp: 1 }).toArray();
  
  logInfo(`\nTotal transactions: ${allTx.length}`);
  logInfo("\nTransactions by order created:");
  
  for (let i = 0; i < allTx.length; i++) {
    const tx = allTx[i];
    logInfo(`  ${i + 1}. #${tx.transaction_number || 'MISSING'}: ${tx.type} - ${tx._id.slice(0, 16)}...`);
    logInfo(`     arweaveTxId: ${tx.arweaveTxId || 'NOT UPLOADED'}`);
    logInfo(`     timestamp: ${tx.timestamp}`);
  }

  // Check specific transaction
  const specificTx = await db.collection("transactions").findOne({ 
    _id: "a1cabadccd367fb990ef8c271a63c6df2ed27f76931b5a8958ed79f9f93a2bce" 
  });
  
  if (specificTx) {
    logInfo(`\nSpecific transaction found:`);
    logInfo(`  _id: ${specificTx._id}`);
    logInfo(`  transaction_number: ${specificTx.transaction_number}`);
    logInfo(`  type: ${specificTx.type}`);
    logInfo(`  arweaveTxId: ${specificTx.arweaveTxId || 'NOT UPLOADED'}`);
  } else {
    logInfo(`\nSpecific transaction NOT FOUND`);
  }

  // Check for duplicates
  const duplicates = await db.collection("transactions").aggregate([
    { $group: { _id: "$transaction_number", count: { $sum: 1 }, transactions: { $push: { type: "$type", _id: "$_id" } } } },
    { $match: { count: { $gt: 1 } } }
  ]).toArray();

  if (duplicates.length > 0) {
    logInfo(`\n⚠️  DUPLICATE TRANSACTION NUMBERS FOUND:`);
    duplicates.forEach(dup => {
      logInfo(`  Transaction number ${dup._id} appears ${dup.count} times:`);
      dup.transactions.forEach(tx => logInfo(`    - ${tx.type}: ${tx._id.slice(0, 16)}...`));
    });
  } else {
    logInfo(`\n✓ No duplicate transaction numbers`);
  }

  process.exit(0);
}

checkTransactionNumbers().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});

