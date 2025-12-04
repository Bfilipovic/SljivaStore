// Test script to manually upload a transaction to Arweave
import { uploadTransactionToArweave, getNextTransactionInfo } from "../services/arweaveService.js";
import connectDB from "../db.js";

async function testArweaveUpload() {
  try {
    console.log("🔗 Connecting to database...");
    await connectDB();
    console.log("✅ Connected\n");

    // Get transaction info
    console.log("📊 Getting transaction info...");
    const { transactionNumber, previousArweaveTxId } = await getNextTransactionInfo();
    console.log(`   Transaction Number: ${transactionNumber}`);
    console.log(`   Previous Arweave TX: ${previousArweaveTxId || "none"}\n`);

    // Create a simple test transaction
    const testTransaction = {
      type: "GIFT",
      transaction_number: transactionNumber,
      nftId: "test-nft-id",
      giver: "0x1111111111111111111111111111111111111111",
      receiver: "0x2222222222222222222222222222222222222222",
      quantity: 1,
      chainTx: null,
      currency: "ETH",
      amount: "0",
      timestamp: new Date(),
    };

    console.log("📦 Test transaction data:");
    console.log(JSON.stringify(testTransaction, null, 2));
    console.log("\n");

    // Try to upload
    console.log("🚀 Attempting to upload to Arweave...");
    const arweaveTxId = await uploadTransactionToArweave(
      testTransaction,
      transactionNumber,
      previousArweaveTxId
    );

    console.log(`\n✅ Success! Arweave Transaction ID: ${arweaveTxId}`);
    console.log(`   View at: https://viewblock.io/arweave/tx/${arweaveTxId}`);
  } catch (error) {
    console.error("\n❌ Error:", error.message);
    console.error("Stack:", error.stack);
    process.exit(1);
  }
}

testArweaveUpload();

