// src/lib/walletActions.ts
import { isAdmin, walletAddress, walletBalance, walletGifts } from '$lib/stores/wallet';
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
  await checkAdminStatus(address);

  return address;
}

// Logout
export function logout() {
  walletAddress.set(null);
  walletBalance.set('0');
  walletGifts.set([]);
  goto('/');
}

async function checkAdminStatus(address: string) {
    try {
    const res = await fetch(`/api/admins/check/${address.toLowerCase()}`);
    if (res.ok) {
      const { isAdmin: adminFlag } = await res.json();
      isAdmin.set(!!adminFlag);
    } else {
      isAdmin.set(false);
    }
  } catch {
    isAdmin.set(false);
  }
}

// Export creation/recovery helpers
export { getWalletFromMnemonic, createNewWallet } from './wallet';

// Export other utilities
export { createETHTransaction } from './wallet';
export { signedFetch, signAndWrapPayload } from './signing';
