// src/lib/walletActions.ts
import { walletAddress, walletBalance, walletGifts } from '$lib/stores/wallet';
import { goto } from '$app/navigation';
import { HDNodeWallet } from 'ethers';
import { getWalletFromMnemonic, createNewWallet } from './wallet';
import { updateUserInfo, } from './userInfo';

// Login with mnemonic
export async function loginWalletFromMnemonic(mnemonic: string): Promise<string> {
  const wallet = getWalletFromMnemonic(mnemonic);
  const address = wallet.address;

  walletAddress.set(address);

  await updateUserInfo(address, true);

  return address;
}

// Logout
export function logout() {
  walletAddress.set(null);
  walletBalance.set('0');
  walletGifts.set([]);
  goto('/');
}

// Export creation/recovery helpers
export { getWalletFromMnemonic, createNewWallet } from './wallet';

// Export other utilities
export { createETHTransaction } from './wallet';
export { signedFetch, signAndWrapPayload } from './signing';
