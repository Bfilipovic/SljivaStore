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
 * @throws {Error} If the external service (Infura) is unavailable or returns an error
 */
export async function getETHBalance(address) {
    try {
        const balance = await provider.getBalance(address);
        return ethers.formatEther(balance);
    } catch (error) {
        // Check if it's an external service error (503, network issues, etc.)
        if (error.code === 'SERVER_ERROR' || error.code === 'NETWORK_ERROR' || error.code === 'TIMEOUT') {
            const serviceError = new Error('Ethereum service temporarily unavailable. Please try again later.');
            serviceError.code = 'SERVICE_UNAVAILABLE';
            serviceError.statusCode = 503;
            throw serviceError;
        }
        // Re-throw other errors as-is
        throw error;
    }
}

/**
 * Get current gas price data
 * @throws {Error} If the external service (Infura) is unavailable or returns an error
 */
export async function getGasPriceData() {
    try {
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
    } catch (error) {
        // Check if it's an external service error (503, network issues, etc.)
        if (error.code === 'SERVER_ERROR' || error.code === 'NETWORK_ERROR' || error.code === 'TIMEOUT') {
            const serviceError = new Error('Ethereum service temporarily unavailable. Please try again later.');
            serviceError.code = 'SERVICE_UNAVAILABLE';
            serviceError.statusCode = 503;
            throw serviceError;
        }
        // Re-throw other errors as-is
        throw error;
    }
}

/**
 * Get nonce for an address
 * @throws {Error} If the external service (Infura) is unavailable or returns an error
 */
export async function getNonce(address) {
    try {
        return await provider.getTransactionCount(address);
    } catch (error) {
        // Check if it's an external service error (503, network issues, etc.)
        if (error.code === 'SERVER_ERROR' || error.code === 'NETWORK_ERROR' || error.code === 'TIMEOUT') {
            const serviceError = new Error('Ethereum service temporarily unavailable. Please try again later.');
            serviceError.code = 'SERVICE_UNAVAILABLE';
            serviceError.statusCode = 503;
            throw serviceError;
        }
        // Re-throw other errors as-is
        throw error;
    }
}

/**
 * Broadcast a signed transaction
 * @throws {Error} If the external service (Infura) is unavailable or returns an error
 */
export async function broadcastTransaction(signedTransaction) {
    try {
        const txResponse = await provider.broadcastTransaction(signedTransaction);
        return txResponse.hash;
    } catch (error) {
        // Check if it's an external service error (503, network issues, etc.)
        if (error.code === 'SERVER_ERROR' || error.code === 'NETWORK_ERROR' || error.code === 'TIMEOUT') {
            const serviceError = new Error('Ethereum service temporarily unavailable. Please try again later.');
            serviceError.code = 'SERVICE_UNAVAILABLE';
            serviceError.statusCode = 503;
            throw serviceError;
        }
        // Re-throw other errors as-is
        throw error;
    }
}
