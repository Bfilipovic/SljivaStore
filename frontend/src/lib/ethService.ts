// src/lib/ethService.ts
import { ethers, HDNodeWallet, Mnemonic } from 'ethers';
import { get } from 'svelte/store';
import { apiFetch } from './api';

/**
 * Get the ETH balance for an address via backend proxy.
 */
export async function getETHBalance(address: string): Promise<string> {
    try {
        const res = await apiFetch(`eth/balance/${address}`);
        const data = await res.json();
        return data.balance;
    } catch (err) {
        console.error('Failed to get ETH balance:', err);
        throw err;
    }
}

/**
 * Create and broadcast an ETH transaction via backend proxy.
 * Transaction is signed locally, only signed transaction is sent to backend.
 * Returns both transaction hash and transaction cost.
 */
export async function createETHTransaction(
    to: string,
    amountEther: string,
    mnemonic: string,
    expectedFromAddress?: string // Optional: verify this matches the wallet address
): Promise<{ txHash: string; txCost: string }> {
    try {
        // Create wallet locally
        const wallet = getEthWalletFromMnemonic(mnemonic);
        if (!wallet) throw new Error('Invalid wallet mnemonic');
        
        // Verify wallet address matches expected address if provided
        if (expectedFromAddress && wallet.address.toLowerCase() !== expectedFromAddress.toLowerCase()) {
            throw new Error(`Wallet address mismatch: expected ${expectedFromAddress}, got ${wallet.address}`);
        }
        
        const amount = ethers.parseEther(amountEther);
        
        // Use the wallet's address (derived from mnemonic) for balance check
        // This ensures we're checking the balance of the wallet that will actually send the transaction
        const fromAddress = wallet.address;
        
        // Get balance and fee data from backend
        const [balanceRes, feeRes] = await Promise.all([
            apiFetch(`eth/balance/${fromAddress}`),
            apiFetch('eth/gas-price')
        ]);
        
        const balanceData = await balanceRes.json();
        const feeData = await feeRes.json();
        
        const balance = ethers.parseEther(balanceData.balance);
        
        // Use the same gas price calculation as backend (maxFeePerGas ?? gasPrice)
        // Backend uses: gasPrice = feeData.maxFeePerGas ?? feeData.gasPrice
        const gasPriceWei = feeData.feeData.maxFeePerGas 
            ? BigInt(feeData.feeData.maxFeePerGas)
            : (feeData.feeData.gasPrice ? BigInt(feeData.feeData.gasPrice) : null);
        
        if (!gasPriceWei) {
            throw new Error('Failed to get gas price data');
        }
        
        const maxFeePerGas = gasPriceWei; // Use the same value backend uses for estimate
        const maxPriorityFeePerGas = feeData.feeData.maxPriorityFeePerGas 
            ? BigInt(feeData.feeData.maxPriorityFeePerGas)
            : gasPriceWei;
        
        // Estimate gas limit
        let gasLimit = 21000n; // Default for simple transfer
        try {
            // We need to estimate gas, but we can't call provider directly
            // For now, use default 21000 for simple transfers
            // In production, you might want to add a gas estimation endpoint
        } catch {
            gasLimit = 21000n;
        }
        
        // Calculate transaction cost using the same method as backend
        // Backend: costWei = gasLimit * gasPrice (where gasPrice = maxFeePerGas ?? gasPrice)
        const maxGasCost = gasLimit * maxFeePerGas;
        const txCostEth = ethers.formatEther(maxGasCost);
        const txCost = parseFloat(txCostEth).toFixed(6);
        
        // Calculate total required
        const totalRequired = amount + maxGasCost;
        const totalRequiredEth = ethers.formatEther(totalRequired);
        
        if (balance < totalRequired) {
            const balanceEth = ethers.formatEther(balance);
            const amountEth = ethers.formatEther(amount);
            throw new Error(
                `Insufficient funds for transfer + gas.\n` +
                `Balance: ${parseFloat(balanceEth).toFixed(6)} ETH\n` +
                `Required: ${parseFloat(amountEth).toFixed(6)} ETH (transfer) + ${txCost} ETH (gas) = ${parseFloat(totalRequiredEth).toFixed(6)} ETH`
            );
        }
        
        // Create transaction object
        const transaction = {
            to,
            value: amount,
            gasLimit,
            maxFeePerGas,
            maxPriorityFeePerGas,
            type: 2,
            nonce: await getNonce(wallet.address), // We need to get nonce
            chainId: 1 // Sepolia testnet
        };
        
        // Sign transaction locally
        const signedTx = await wallet.signTransaction(transaction);
        
        // Send signed transaction to backend for broadcasting
        const res = await apiFetch('eth/transaction', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                signedTransaction: signedTx
            })
        });
        
        const data = await res.json();
        if (!data.success) {
            throw new Error(data.error || 'Transaction failed');
        }
        
        return {
            txHash: data.txHash,
            txCost: txCost
        };
    } catch (err) {
        console.error('Failed to create ETH transaction:', err);
        throw err;
    }
}

/**
 * Get nonce for an address via backend proxy
 */
async function getNonce(address: string): Promise<number> {
    try {
        const res = await apiFetch(`eth/nonce/${address}`);
        const data = await res.json();
        return data.nonce;
    } catch (err) {
        console.error('Failed to get nonce:', err);
        throw err;
    }
}

/**
 * Estimate the current cost of a simple ETH transfer (21000 gas) via backend proxy.
 */
export async function getCurrentEthTxCost(): Promise<string> {
    try {
        const res = await apiFetch('eth/gas-price');
        const data = await res.json();
        return data.estimatedTxCost;
    } catch (err) {
        console.error('Failed to get ETH transaction cost:', err);
        throw err;
    }
}

/**
 * Derive an ETH wallet from a mnemonic phrase.
 */
export function getEthWalletFromMnemonic(mnemonic: string): HDNodeWallet {
  return HDNodeWallet.fromMnemonic(Mnemonic.fromPhrase(mnemonic));
}
