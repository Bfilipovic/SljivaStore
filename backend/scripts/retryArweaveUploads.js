// backend/scripts/retryArweaveUploads.js
/**
 * Script: Retry failed Arweave uploads
 * 
 * Scans the database for transactions that don't have an arweaveTxId
 * and attempts to upload them to Arweave.
 * 
 * Usage:
 *   node backend/scripts/retryArweaveUploads.js
 */

import connectDB from "../db.js";
import { uploadTransactionToArweave } from "../services/arweaveService.js";
import { logInfo } from "../utils/logger.js";

async function retryFailedUploads() {
  const db = await connectDB();
  const txCollection = db.collection("transactions");

  // Find all transactions without arweaveTxId
  const failedTransactions = await txCollection
    .find({
      $or: [
        { arweaveTxId: { $exists: false } },
        { arweaveTxId: null }
      ]
    })
    .sort({ transaction_number: 1 }) // Process in order
    .toArray();

  if (failedTransactions.length === 0) {
    console.log("[retryArweaveUploads] No failed transactions found. All transactions are uploaded.");
    return;
  }

  console.log(`[retryArweaveUploads] Found ${failedTransactions.length} transaction(s) without Arweave ID`);

  let successCount = 0;
  let failCount = 0;

  for (const tx of failedTransactions) {
    try {
      console.log(`[retryArweaveUploads] Processing transaction ${tx._id} (number: ${tx.transaction_number})`);

      // Get the previous Arweave transaction ID
      // Find the most recent transaction with arweaveTxId that has a lower transaction_number
      const previousTx = await txCollection
        .findOne(
          { 
            transaction_number: { $exists: true, $lt: tx.transaction_number },
            arweaveTxId: { $exists: true, $ne: null }
          },
          { sort: { transaction_number: -1 } }
        );
      
      const previousArweaveTxId = previousTx?.arweaveTxId || null;

      // Attempt upload
      const arweaveTxId = await uploadTransactionToArweave(
        tx,
        tx.transaction_number,
        previousArweaveTxId
      );

      // Update transaction with Arweave ID
      await txCollection.updateOne(
        { _id: tx._id },
        { $set: { arweaveTxId: arweaveTxId } }
      );

      console.log(`[retryArweaveUploads] ✓ Successfully uploaded transaction ${tx._id} to Arweave: ${arweaveTxId}`);
      successCount++;

    } catch (error) {
      console.error(`[retryArweaveUploads] ✗ Failed to upload transaction ${tx._id}: ${error.message}`);
      failCount++;
    }
  }

  console.log(`[retryArweaveUploads] Summary: ${successCount} succeeded, ${failCount} failed`);
}

// Run the script
retryFailedUploads()
  .then(() => {
    console.log("[retryArweaveUploads] Script completed");
    process.exit(0);
  })
  .catch((error) => {
    console.error("[retryArweaveUploads] Script failed:", error);
    process.exit(1);
  });

