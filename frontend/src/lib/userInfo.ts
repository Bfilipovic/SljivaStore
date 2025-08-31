// src/lib/userInfo.ts
import { walletBalance, walletGifts } from '$lib/stores/wallet';
import { getWalletBalance } from './wallet';
import { apiFetch } from './api';

let userInfoInterval: any = null;

export async function updateUserInfo(address: string) {
  try {
    const bal = await getWalletBalance(address);
    walletBalance.set(bal);

    const res = await apiFetch(`/nfts/gifts/${address}`);
    const data = await res.json();
    if (data.success) {
      walletGifts.set(data.gifts || []);
    } else {
      walletGifts.set([]);
    }

    console.log(`[USER INFO] Updated info for ${address}`);
  } catch (err) {
    console.error('[USER INFO] Failed to update user info:', err);
  }
}

export function startUserInfoUpdater(address: string) {
  if (userInfoInterval) clearInterval(userInfoInterval);

  userInfoInterval = setInterval(() => updateUserInfo(address), 10 * 60 * 1000);
}

export function stopUserInfoUpdater() {
  if (userInfoInterval) {
    clearInterval(userInfoInterval);
    userInfoInterval = null;
  }
}
