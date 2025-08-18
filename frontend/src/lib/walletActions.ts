import { HDNodeWallet, Mnemonic, Wallet, ethers } from 'ethers';
import { walletAddress } from '$lib/stores/wallet';
import { goto } from '$app/navigation';
import { randomBytes } from 'ethers/crypto';
import { keccak256, toUtf8Bytes } from 'ethers';
import { apiFetch } from './api';

const provider = new ethers.JsonRpcProvider('https://sepolia.infura.io/v3/e81c5a9ece954b7d9c39bbbf0a17afa7');

export function loginWalletFromMnemonic(mnemonic: string): string {
	const wallet = getWalletFromMnemonic(mnemonic);
	walletAddress.set(wallet.address);
	return wallet.address;
}

export function getWalletFromMnemonic(mnemonic: string): HDNodeWallet {
	return HDNodeWallet.fromMnemonic(Mnemonic.fromPhrase(mnemonic));
}


export async function getWalletBalance(address: string): Promise<string> {
	const balance = await provider.getBalance(address);
	return ethers.formatEther(balance);
}
export async function createETHTransaction(to: string, amountEther: string, wallet: HDNodeWallet): Promise<string> {
  const connectedWallet = wallet.connect(provider);
  
  // Parse amount to BigInt wei
  const amount = ethers.parseEther(amountEther);

  // Get sender balance
  const balance = await provider.getBalance(wallet.address);

  // Get current fee data (EIP-1559 gas fees)
  const feeData = await provider.getFeeData();
  if (!feeData.maxFeePerGas || !feeData.maxPriorityFeePerGas) {
    throw new Error('Failed to fetch gas fee data');
  }

  // Estimate gas limit for simple ETH transfer (usually 21000)
  // But safer to estimate via provider
  let gasLimit;
  try {
    gasLimit = await provider.estimateGas({
      to,
      value: amount,
      from: wallet.address,
    });
  } catch {
    gasLimit = 21000n;
  }

  // Calculate max gas cost = gasLimit * maxFeePerGas
  const maxGasCost = gasLimit * feeData.maxFeePerGas;

  // Total cost = amount + maxGasCost
  const totalCost = amount + maxGasCost;

  if (balance < totalCost) {
    throw new Error(`Insufficient funds: balance ${ethers.formatEther(balance)} ETH, need ${ethers.formatEther(totalCost)} ETH (amount + gas)`);
  }

  // Prepare transaction with EIP-1559 fees
  const txRequest = {
    to,
    value: amount,
    gasLimit,
    maxFeePerGas: feeData.maxFeePerGas,
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
    type: 2, // EIP-1559 transaction type
  };

  const txResponse = await connectedWallet.sendTransaction(txRequest);
  return txResponse.hash;
}

export function logout() {
	walletAddress.set(null);
	goto('/');
}

export function createNewWallet(): { mnemonic: string; address: string } {
	const entropy = randomBytes(16); // 128 bits → 12-word mnemonic
	const mnemonic = Mnemonic.fromEntropy(entropy);
	const wallet = HDNodeWallet.fromMnemonic(mnemonic);

	walletAddress.set(wallet.address);

	return {
		mnemonic: mnemonic.phrase,
		address: wallet.address
	};
}

// --- ✍️ Sign request payload ---

function deterministicStringify(obj: any): string {
	if (typeof obj !== 'object' || obj === null) return JSON.stringify(obj);
	return JSON.stringify(obj, Object.keys(obj).sort());
}

export async function signAndWrapPayload(wallet : HDNodeWallet, payload: any): Promise<{
	address: string;
	timestamp: number;
	signature: string;
	data: any;
}> {
	const timestamp = Date.now();

	const serialized = deterministicStringify({
		timestamp,
		data: payload
	});

	const hash = keccak256(toUtf8Bytes(serialized));
	const signature = await wallet.signMessage(hash);

	return {
		address: wallet.address,
		timestamp,
		signature,
		data: payload
	};
}


const excludedPaths = ['/nfts/reserve']; // paths you don’t want to sign

export async function signedFetch(input, init = {}, wallet) {
  console.log('signedFetch called with:', input);

  const url = typeof input === 'string' ? input : input.url;
  const method = (init.method || 'GET').toUpperCase();

  console.log('Method: ', init.method);

  console.log('Method is POST, checking if signing is needed');
  // Skip signing if not POST or path excluded
  if ( method == 'GET' || excludedPaths.some(path => url === path)) {
    return apiFetch(input, init);
  }

  console.log('method is POST, signing payload');
  // Assume JSON payload
  let payload = {};
  if (init.body) {
    try {
      payload = JSON.parse(init.body);
    } catch {
      console.warn('signedFetch: failed to parse JSON body');
    }
  }

  // Sign payload
  const signedPayload = await signAndWrapPayload(wallet, payload);

  // Send signed payload instead
  const signedInit = {
    ...init,
    body: JSON.stringify(signedPayload),
    headers: {
      ...(init.headers || {}),
      'Content-Type': 'application/json'
    }
  };

  // Optional: log request
  console.log('signedFetch sending:', url, signedPayload);

  return apiFetch(url, signedInit);
}