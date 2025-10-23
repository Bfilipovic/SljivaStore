// backend/services/ethService.js
/**
 * Service: Ethereum blockchain operations
 *
 * Exports:
 * - getETHBalance(address: string): Promise<string>
 * - getGasPriceData(): Promise<object>
 * - getNonce(address: string): Promise<number>
 * - broadcastTransaction(signedTransaction: string): Promise<string>
 *
 * Notes:
 * - All operations use Infura mainnet provider
 * - Handles gas price estimation and transaction broadcasting
 */

import { ethers } from "ethers";

// Create a provider for mainnet
const provider = new ethers.JsonRpcProvider(
    'https://mainnet.infura.io/v3/e81c5a9ece954b7d9c39bbbf0a17afa7'
);

/**
 * Get ETH balance for an address
 */
export async function getETHBalance(address) {
    const balance = await provider.getBalance(address);
    return ethers.formatEther(balance);
}

/**
 * Get current gas price data
 */
export async function getGasPriceData() {
    const feeData = await provider.getFeeData();
    if (!feeData.gasPrice && !feeData.maxFeePerGas) {
        throw new Error('Failed to fetch gas data');
    }

    const gasPrice = feeData.maxFeePerGas ?? feeData.gasPrice;
    const gasLimit = 21000n;
    const costWei = gasLimit * gasPrice;
    const costEth = ethers.formatEther(costWei);
    
    return {
        gasPrice: gasPrice.toString(),
        estimatedTxCost: parseFloat(costEth).toFixed(6),
        feeData: {
            maxFeePerGas: feeData.maxFeePerGas?.toString(),
            maxPriorityFeePerGas: feeData.maxPriorityFeePerGas?.toString(),
            gasPrice: feeData.gasPrice?.toString()
        }
    };
}

/**
 * Get nonce for an address
 */
export async function getNonce(address) {
    return await provider.getTransactionCount(address);
}

/**
 * Broadcast a signed transaction
 */
export async function broadcastTransaction(signedTransaction) {
    const txResponse = await provider.broadcastTransaction(signedTransaction);
    return txResponse.hash;
}
