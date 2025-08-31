// src/lib/userInfo.ts
import { walletBalance, walletGifts } from '$lib/stores/wallet';
import { getWalletBalance } from './wallet';
import { apiFetch } from './api';

let lastUpdate: number | null = null;

/**
 * Update user info (balance + gifts).
 * @param address Wallet address of the logged-in user
 * @param force If true, always update regardless of last update time
 */
export async function updateUserInfo(address: string, force = false) {
  const now = Date.now();

  // If not forced, and last update was within 10 min → skip
  if (!force && lastUpdate && now - lastUpdate < 10 * 60 * 1000) {
    console.log('[USER INFO] Skipping update (fetched recently)');
    return;
  }

  try {
    // balance
    const bal = await getWalletBalance(address);
    walletBalance.set(bal);

    // gifts
    const res = await apiFetch(`/gifts/${address}`);
    const data = await res.json();
    if (data.success) {
      walletGifts.set(data.gifts || []);
    } else {
      walletGifts.set([]);
    }

    lastUpdate = now;
    console.log(`[USER INFO] Updated info for ${address}`);
  } catch (err) {
    console.error('[USER INFO] Failed to update user info:', err);
  }
}

/** Reset cache (e.g. after logout) */
export function resetUserInfoCache() {
  lastUpdate = null;
  walletBalance.set('0');
  walletGifts.set([]);
}
