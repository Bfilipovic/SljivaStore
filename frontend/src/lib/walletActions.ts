import { HDNodeWallet, Mnemonic, Wallet, ethers } from 'ethers';
import { walletAddress } from '$lib/stores/wallet';
import { goto } from '$app/navigation';
import { randomBytes } from 'ethers/crypto';



export function loginWalletFromMnemonic(mnemonic: string): string {
  const wallet = getWalletFromMnemonic(mnemonic);
  walletAddress.set(wallet.address);
  return wallet.address;
}

export function getWalletFromMnemonic(mnemonic: string): HDNodeWallet {
    return HDNodeWallet.fromMnemonic(Mnemonic.fromPhrase(mnemonic));
}

const provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545');

export async function getWalletBalance(address: string): Promise<string> {
  const balance = await provider.getBalance(address);
  return ethers.formatEther(balance);
}

export function logout() {
		walletAddress.set(null);
		goto('/');
}

export function createNewWallet(): { mnemonic: string; address: string } {
  const entropy = randomBytes(16); // 128 bits → 12-word mnemonic
  const mnemonic = Mnemonic.fromEntropy(entropy);
  const wallet = HDNodeWallet.fromMnemonic(mnemonic);

  // Optionally set the store value (can be removed if you prefer explicit control)
  walletAddress.set(wallet.address);

  return {
    mnemonic: mnemonic.phrase,
    address: wallet.address
  };
}

function getPublicKeyPEM(wallet: HDNodeWallet): string {
  const pubKeyBytes = ethers.getBytes(wallet.publicKey);
  const derHeader = '3056301006072a8648ce3d020106052b8104000a034200';
  const pubKeyHex = ethers.hexlify(pubKeyBytes).replace(/^0x/, '');
  const derHex = derHeader + pubKeyHex;
  // Convert hex to Uint8Array, safely handle null
  const hexBytes = derHex.match(/.{1,2}/g) || [];
  const derArray = new Uint8Array(hexBytes.map(byte => parseInt(byte, 16)));
  // Browser base64 encoding
  let base64 = '';
  if (typeof window !== 'undefined' && window.btoa) {
    base64 = window.btoa(String.fromCharCode(...derArray));
  } else {
    // Fallback for environments without window.btoa
    base64 = ethers.encodeBase64(derArray);
  }
  const lines = base64.match(/.{1,64}/g) || [base64];
  const pem =
    '-----BEGIN PUBLIC KEY-----\n' +
    lines.join('\n') +
    '\n-----END PUBLIC KEY-----';
  return pem;
}

/**
 * Signs request data using the provided wallet object.
 * Returns the data with address, timestamp, and signature fields (no publicKey).
 */
export async function signRequest(data: Record<string, any>, wallet: HDNodeWallet): Promise<Record<string, any>> {
  // Remove any existing signature/publicKey field
  const dataToSign = { ...data };
  delete dataToSign.signature;
  delete dataToSign.publicKey;

  // Add timestamp if not present
  if (!dataToSign.timestamp) {
    dataToSign.timestamp = Date.now();
  }

  // Add address
  dataToSign.address = wallet.address;

  // Prepare message for signing (stringify data)
  // Ensure stable field order: sort keys
  const ordered: Record<string, any> = {};
  Object.keys(dataToSign).sort().forEach(k => { ordered[k] = dataToSign[k]; });
  const message = JSON.stringify(ordered);

  // Sign message (returns hex string)
  const signature = await wallet.signMessage(message);

  return {
    ...ordered,
    signature
  };
}