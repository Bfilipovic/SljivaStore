// src/lib/walletActions.ts
import { walletAddress, walletBalance, walletGifts, isAdmin } from './stores/wallet';
import { goto } from '$app/navigation';
import { getETHBalance, createETHTransaction, getCurrentTxCost } from './ethService';
import { updateUserInfo } from './userInfo';
import { HDNodeWallet, Mnemonic } from 'ethers';
import { randomBytes } from 'ethers/crypto';

// --- Login flow ---
export async function loginWalletFromMnemonic(mnemonic: string): Promise<string> {
  const derived = getWalletFromMnemonic(mnemonic);
  const address = derived.address;

  walletAddress.set(address);

  // Fetch balance on login
  try {
    const balance = await getETHBalance(address);
    walletBalance.set(balance);
  } catch {
    walletBalance.set('0');
  }

  await updateUserInfo(address, true);
  await checkAdminStatus(address);

  return address;
}

// --- Logout flow ---
export function logout() {
  walletAddress.set(null);
  walletBalance.set('0');
  walletGifts.set([]);
  isAdmin.set(false);
  goto('/');
}

// --- Admin check ---
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


/**
 * Derive an ETH wallet from a mnemonic phrase.
 */
export function getWalletFromMnemonic(mnemonic: string): HDNodeWallet {
  return HDNodeWallet.fromMnemonic(Mnemonic.fromPhrase(mnemonic));
}

/**
 * Create a brand new ETH wallet with a fresh mnemonic.
 * Returns both the mnemonic phrase and the ETH address.
 */
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
  return getETHBalance(address);
}

/**
 * Verify if a given mnemonic corresponds to the currently logged-in wallet.
 */
export function mnemonicMatchesLoggedInWallet(mnemonic: string): boolean {
  const derived = getWalletFromMnemonic(mnemonic);
  const derivedAddress = derived.address.toLowerCase();

  let current: string | null = null;
  walletAddress.subscribe((addr) => {
    current = addr ? addr.toLowerCase() : null;
  })();

  console.log('mnemonicMatchesLoggedInWallet:', { derivedAddress, current });
  return !!current && current === derivedAddress;
}

// --- Utility re-exports ---
export { getETHBalance, createETHTransaction, getCurrentTxCost } from './ethService';
export { signAndWrapPayload, signedFetch } from './signing';
