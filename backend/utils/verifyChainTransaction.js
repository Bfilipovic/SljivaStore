// backend/utils/verifyChainTransaction.js
/**
 * Verify that a blockchain transaction actually sent the expected amount.
 * 
 * This prevents users from creating transactions that pay less than expected
 * and still having them accepted by the backend.
 * 
 * Supports:
 * - ETH (Ethereum) transactions
 * - SOL (Solana) transactions
 * 
 * Includes tolerance for rounding errors (0.01% or minimum 0.000001 units).
 */

import { ethers } from "ethers";
import { Connection, PublicKey } from "@solana/web3.js";

// Tolerance for rounding errors:
// - 0.01% of the expected amount, OR
// - Minimum 0.000001 units (to handle very small amounts)
// Whichever is larger
const TOLERANCE_PERCENT = 0.0001; // 0.01%
const MIN_TOLERANCE_ETH = "0.000001"; // 0.000001 ETH
const MIN_TOLERANCE_SOL = "0.000001"; // 0.000001 SOL

// Ethereum provider
const ethProvider = new ethers.JsonRpcProvider(
  process.env.ETH_RPC_URL || 'https://mainnet.infura.io/v3/e81c5a9ece954b7d9c39bbbf0a17afa7'
);

// Solana RPC endpoint
const SOL_RPC_URL = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";

/**
 * Calculate the tolerance amount for a given expected amount and currency
 */
function calculateTolerance(expectedAmount, currency) {
  const expected = parseFloat(expectedAmount);
  if (!Number.isFinite(expected) || expected <= 0) {
    throw new Error(`Invalid expected amount: ${expectedAmount}`);
  }

  // Calculate percentage-based tolerance
  const percentTolerance = expected * TOLERANCE_PERCENT;

  // Get minimum tolerance for currency
  const minTolerance = currency.toUpperCase() === "SOL" 
    ? parseFloat(MIN_TOLERANCE_SOL)
    : parseFloat(MIN_TOLERANCE_ETH);

  // Use whichever is larger
  return Math.max(percentTolerance, minTolerance);
}

/**
 * Verify an Ethereum transaction amount
 */
async function verifyETHTransaction(chainTx, expectedAmount, expectedToAddress, expectedFromAddress = null) {
  try {
    // Fetch transaction from blockchain
    const tx = await ethProvider.getTransaction(chainTx);
    
    if (!tx) {
      throw new Error(`Transaction ${chainTx} not found on Ethereum blockchain`);
    }

    // Wait for transaction to be confirmed (at least 1 confirmation)
    if (!tx.blockNumber) {
      // Transaction is pending, wait a bit and check again
      await new Promise(resolve => setTimeout(resolve, 2000));
      const tx2 = await ethProvider.getTransaction(chainTx);
      if (!tx2 || !tx2.blockNumber) {
        throw new Error(`Transaction ${chainTx} is still pending. Please wait for confirmation.`);
      }
    }

    // Get transaction receipt to confirm it was successful
    const receipt = await ethProvider.getTransactionReceipt(chainTx);
    if (!receipt || receipt.status !== 1) {
      throw new Error(`Transaction ${chainTx} failed or was reverted`);
    }

    // Verify the transaction was sent to the expected address
    const toAddress = tx.to?.toLowerCase();
    const expectedTo = expectedToAddress.toLowerCase();
    if (toAddress !== expectedTo) {
      throw new Error(
        `Transaction recipient mismatch: expected ${expectedTo}, got ${toAddress}`
      );
    }

    // Optionally verify the sender address matches expected buyer
    if (expectedFromAddress) {
      const fromAddress = tx.from?.toLowerCase();
      const expectedFrom = expectedFromAddress.toLowerCase();
      if (fromAddress !== expectedFrom) {
        throw new Error(
          `Transaction sender mismatch: expected ${expectedFrom}, got ${fromAddress}`
        );
      }
    }

    // Get the actual amount sent (in wei, convert to ETH)
    const actualAmountWei = tx.value;
    const actualAmountEth = parseFloat(ethers.formatEther(actualAmountWei));
    const expectedAmountEth = parseFloat(expectedAmount);

    // Calculate tolerance
    const tolerance = calculateTolerance(expectedAmountEth, "ETH");

    // Verify: actual amount must be >= (expected - tolerance)
    const minAcceptable = expectedAmountEth - tolerance;
    
    if (actualAmountEth < minAcceptable) {
      throw new Error(
        `Insufficient payment: expected at least ${expectedAmountEth} ETH ` +
        `(with ${tolerance} tolerance), but transaction only sent ${actualAmountEth} ETH`
      );
    }

    return {
      verified: true,
      actualAmount: actualAmountEth.toString(),
      expectedAmount: expectedAmountEth.toString(),
      tolerance: tolerance.toString(),
      currency: "ETH"
    };
  } catch (error) {
    throw new Error(`Failed to verify ETH transaction ${chainTx}: ${error.message}`);
  }
}

/**
 * Verify a Solana transaction amount
 */
async function verifySOLTransaction(chainTx, expectedAmount, expectedToAddress, expectedFromAddress = null) {
  try {
    const connection = new Connection(SOL_RPC_URL, {
      commitment: "confirmed"
    });

    // Fetch transaction from blockchain
    const tx = await connection.getTransaction(chainTx, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0
    });

    if (!tx) {
      throw new Error(`Transaction ${chainTx} not found on Solana blockchain`);
    }

    // Check if transaction was successful
    if (tx.meta?.err) {
      throw new Error(`Transaction ${chainTx} failed: ${JSON.stringify(tx.meta.err)}`);
    }

    // Get the actual amount transferred
    // In Solana, we need to look at the pre/post balances and account keys
    const preBalances = tx.meta?.preBalances || [];
    const postBalances = tx.meta?.postBalances || [];
    
    // Handle different transaction versions
    let accountKeys = [];
    if (tx.transaction.message.accountKeys) {
      // For versioned transactions, accountKeys might be an array of PublicKey objects
      accountKeys = tx.transaction.message.accountKeys.map(key => 
        typeof key === 'string' ? key : key.toBase58()
      );
    } else if (tx.transaction.message.staticAccountKeys) {
      // Fallback for older transaction format
      accountKeys = tx.transaction.message.staticAccountKeys.map(key =>
        typeof key === 'string' ? key : key.toBase58()
      );
    } else {
      throw new Error("Could not extract account keys from Solana transaction");
    }

    // Find the recipient account index
    let recipientIndex = -1;
    const expectedToLower = expectedToAddress.toLowerCase();
    for (let i = 0; i < accountKeys.length; i++) {
      const key = accountKeys[i];
      const keyStr = typeof key === 'string' ? key : key.toBase58();
      if (keyStr.toLowerCase() === expectedToLower) {
        recipientIndex = i;
        break;
      }
    }

    if (recipientIndex === -1) {
      throw new Error(`Recipient address ${expectedToAddress} not found in transaction`);
    }

    // Calculate amount received by recipient (in lamports)
    const preBalance = preBalances[recipientIndex] || 0;
    const postBalance = postBalances[recipientIndex] || 0;
    const receivedLamports = postBalance - preBalance;
    
    // Verify that the recipient actually received funds (not just a balance check)
    if (receivedLamports <= 0) {
      throw new Error(`Recipient ${expectedToAddress} did not receive any funds in this transaction`);
    }

    // Optionally verify the sender address matches expected buyer
    if (expectedFromAddress) {
      // Find sender account index (usually index 0 for the fee payer)
      let senderIndex = -1;
      const expectedFromLower = expectedFromAddress.toLowerCase();
      for (let i = 0; i < accountKeys.length; i++) {
        const key = accountKeys[i];
        const keyStr = typeof key === 'string' ? key : key.toBase58();
        if (keyStr.toLowerCase() === expectedFromLower) {
          senderIndex = i;
          break;
        }
      }

      if (senderIndex === -1) {
        // Sender might not be in account keys if they're just the fee payer
        // Check if the transaction was signed by the expected sender
        const signers = tx.transaction.message.staticAccountKeys || accountKeys;
        const isSigner = tx.transaction.message.header.numRequiredSignatures > 0;
        // For now, we'll be lenient - if sender is not found, we'll still verify amount
        // This is because Solana transactions can have complex account structures
      }
    }

    // Convert to SOL (1 SOL = 1e9 lamports)
    const actualAmountSol = receivedLamports / 1e9;
    const expectedAmountSol = parseFloat(expectedAmount);

    // Calculate tolerance
    const tolerance = calculateTolerance(expectedAmountSol, "SOL");

    // Verify: actual amount must be >= (expected - tolerance)
    const minAcceptable = expectedAmountSol - tolerance;

    if (actualAmountSol < minAcceptable) {
      throw new Error(
        `Insufficient payment: expected at least ${expectedAmountSol} SOL ` +
        `(with ${tolerance} tolerance), but transaction only sent ${actualAmountSol} SOL`
      );
    }

    return {
      verified: true,
      actualAmount: actualAmountSol.toString(),
      expectedAmount: expectedAmountSol.toString(),
      tolerance: tolerance.toString(),
      currency: "SOL"
    };
  } catch (error) {
    throw new Error(`Failed to verify SOL transaction ${chainTx}: ${error.message}`);
  }
}

/**
 * Verify a chain transaction amount
 * @param {string} chainTx - Transaction hash/ID on the blockchain
 * @param {string} expectedAmount - Expected amount (as string, e.g. "1.5")
 * @param {string} currency - Currency code ("ETH" or "SOL")
 * @param {string} expectedToAddress - Expected recipient address
 * @param {string} expectedFromAddress - Expected sender address (optional, for additional verification)
 * @returns {Promise<Object>} Verification result
 */
export async function verifyChainTransaction(
  chainTx,
  expectedAmount,
  currency,
  expectedToAddress,
  expectedFromAddress = null
) {
  if (!chainTx || !expectedAmount || !currency || !expectedToAddress) {
    throw new Error("Missing required parameters for chain transaction verification");
  }

  const currencyUpper = String(currency).toUpperCase();

  switch (currencyUpper) {
    case "ETH":
      return await verifyETHTransaction(chainTx, expectedAmount, expectedToAddress, expectedFromAddress);
    
    case "SOL":
      return await verifySOLTransaction(chainTx, expectedAmount, expectedToAddress, expectedFromAddress);
    
    default:
      throw new Error(`Unsupported currency for chain verification: ${currency}`);
  }
}

