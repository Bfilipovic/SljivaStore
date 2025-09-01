// src/lib/wallet.ts
import { HDNodeWallet, Mnemonic, ethers } from 'ethers';
import { randomBytes } from 'ethers/crypto';

const provider = new ethers.JsonRpcProvider(
  'https://sepolia.infura.io/v3/e81c5a9ece954b7d9c39bbbf0a17afa7'
);

export function getWalletFromMnemonic(mnemonic: string): HDNodeWallet {
  return HDNodeWallet.fromMnemonic(Mnemonic.fromPhrase(mnemonic));
}

export function createNewWallet(): { mnemonic: string; address: string } {
  const entropy = randomBytes(16); // 128 bits → 12 words
  const mnemonic = Mnemonic.fromEntropy(entropy);
  const wallet = HDNodeWallet.fromMnemonic(mnemonic);

  return {
    mnemonic: mnemonic.phrase,
    address: wallet.address,
  };
}

export async function getWalletBalance(address: string): Promise<string> {
  const balance = await provider.getBalance(address);
  return ethers.formatEther(balance);
}

export async function createETHTransaction(
  to: string,
  amountEther: string,
  wallet: HDNodeWallet
): Promise<string> {
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

export async function getCurrentTxCost(): Promise<string> {
  const feeData = await provider.getFeeData();
  if (!feeData.gasPrice && !feeData.maxFeePerGas) {
    throw new Error("Failed to fetch gas data");
  }

  // Use EIP-1559 maxFeePerGas if available, fallback to legacy gasPrice
  const gasPrice = feeData.maxFeePerGas ?? feeData.gasPrice!;
  const gasLimit = 21000n;

  const costWei = gasLimit * gasPrice;
  const costEth = ethers.formatEther(costWei);
  console.log(`Estimated tx cost: ${costEth} ETH`);

  // Round to 6 decimals
  return parseFloat(costEth).toFixed(6);
}
