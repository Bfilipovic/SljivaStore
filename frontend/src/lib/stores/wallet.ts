import { writable } from 'svelte/store';
import { browser } from '$app/environment';

export const walletAddress = writable<string | null>(null);
export const walletBalance = writable<string>('0');
export const walletGifts = writable<any[]>([]);
export const isAdmin = writable<boolean>(false);

if (browser) {
  // --- Load from localStorage ---
  const savedAddress = localStorage.getItem('walletAddress');
  const savedBalance = localStorage.getItem('walletBalance');
  const savedGifts = localStorage.getItem('walletGifts');
  const savedAdmin = localStorage.getItem('isAdmin');

  if (savedAddress) walletAddress.set(savedAddress);
  if (savedBalance) walletBalance.set(savedBalance);
  if (savedGifts) {
    try {
      walletGifts.set(JSON.parse(savedGifts));
    } catch {
      walletGifts.set([]);
    }
  }
  if (savedAdmin) {
    isAdmin.set(savedAdmin === 'true');
  }

  // --- Subscriptions to persist changes ---
  walletAddress.subscribe((addr) => {
    if (addr) localStorage.setItem('walletAddress', addr);
    else localStorage.removeItem('walletAddress');
  });

  walletBalance.subscribe((bal) => {
    if (bal) localStorage.setItem('walletBalance', bal);
    else localStorage.removeItem('walletBalance');
  });

  walletGifts.subscribe((gifts) => {
    if (gifts && gifts.length > 0) {
      localStorage.setItem('walletGifts', JSON.stringify(gifts));
    } else {
      localStorage.removeItem('walletGifts');
    }
  });

  isAdmin.subscribe((val) => {
    localStorage.setItem('isAdmin', val ? 'true' : 'false');
  });
}
