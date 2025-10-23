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
    mnemonic: string
): Promise<{ txHash: string; txCost: string }> {
    try {
        // Create wallet locally
        const wallet = getEthWalletFromMnemonic(mnemonic);
        if (!wallet) throw new Error('Invalid wallet mnemonic');
        
        const amount = ethers.parseEther(amountEther);
        
        // Get balance and fee data from backend
        const [balanceRes, feeRes] = await Promise.all([
            apiFetch(`eth/balance/${wallet.address}`),
            apiFetch('eth/gas-price')
        ]);
        
        const balanceData = await balanceRes.json();
        const feeData = await feeRes.json();
        
        const balance = ethers.parseEther(balanceData.balance);
        const maxFeePerGas = BigInt(feeData.feeData.maxFeePerGas);
        const maxPriorityFeePerGas = BigInt(feeData.feeData.maxPriorityFeePerGas);
        
        // Estimate gas limit
        let gasLimit = 21000n; // Default for simple transfer
        try {
            // We need to estimate gas, but we can't call provider directly
            // For now, use default 21000 for simple transfers
            // In production, you might want to add a gas estimation endpoint
        } catch {
            gasLimit = 21000n;
        }
        
        // Calculate transaction cost
        const maxGasCost = gasLimit * maxFeePerGas;
        const txCostEth = ethers.formatEther(maxGasCost);
        const txCost = parseFloat(txCostEth).toFixed(6);
        
        if (balance < amount + maxGasCost) {
            throw new Error('Insufficient funds for transfer + gas');
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
