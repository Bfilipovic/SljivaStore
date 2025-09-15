// src/lib/ethService.ts
import { ethers, HDNodeWallet, Mnemonic } from 'ethers';
import { get } from 'svelte/store';

const provider = new ethers.JsonRpcProvider(
    'https://sepolia.infura.io/v3/e81c5a9ece954b7d9c39bbbf0a17afa7'
);

/**
 * Get the ETH balance for an address.
 */
export async function getETHBalance(address: string): Promise<string> {
    const balance = await provider.getBalance(address);
    return ethers.formatEther(balance);
}

/**
 * Create and broadcast an ETH transaction.
 */
export async function createETHTransaction(
    to: string,
    amountEther: string,
    mnemonic: string
): Promise<string> {
    const wallet = getEthWalletFromMnemonic(mnemonic);
    if (!wallet) throw new Error('Invalid wallet mnemonic');
    const connectedWallet = wallet.connect(provider);
    const amount = ethers.parseEther(amountEther);
    const balance = await provider.getBalance(wallet.address);

    const feeData = await provider.getFeeData();
    if (!feeData.maxFeePerGas || !feeData.maxPriorityFeePerGas) {
        throw new Error('Failed to fetch gas fee data');
    }

    let gasLimit;
    try {
        gasLimit = await provider.estimateGas({ to, value: amount, from: wallet.address });
    } catch {
        gasLimit = 21000n;
    }

    const maxGasCost = gasLimit * feeData.maxFeePerGas;
    if (balance < amount + maxGasCost) {
        throw new Error('Insufficient funds for transfer + gas');
    }

    const txResponse = await connectedWallet.sendTransaction({
        to,
        value: amount,
        gasLimit,
        maxFeePerGas: feeData.maxFeePerGas,
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
        type: 2,
    });

    return txResponse.hash;
}

/**
 * Estimate the current cost of a simple ETH transfer (21000 gas).
 */
export async function getCurrentTxCost(): Promise<string> {
    const feeData = await provider.getFeeData();
    if (!feeData.gasPrice && !feeData.maxFeePerGas) {
        throw new Error('Failed to fetch gas data');
    }

    const gasPrice = feeData.maxFeePerGas ?? feeData.gasPrice!;
    const gasLimit = 21000n;

    const costWei = gasLimit * gasPrice;
    const costEth = ethers.formatEther(costWei);

    // Round to 6 decimals
    return parseFloat(costEth).toFixed(6);
}

/**
 * Derive an ETH wallet from a mnemonic phrase.
 */
export function getEthWalletFromMnemonic(mnemonic: string): HDNodeWallet {
  return HDNodeWallet.fromMnemonic(Mnemonic.fromPhrase(mnemonic));
}
