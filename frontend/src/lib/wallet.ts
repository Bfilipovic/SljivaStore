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