/**
 * User Info Management
 * 
 * Handles fetching and caching user information including:
 * - ETH and SOL balances
 * - Gift information
 * 
 * Implements a 10-minute cache to avoid excessive API calls.
 */

import { wallet } from "$lib/stores/wallet";
import { getETHBalance } from "./ethService";
import { apiFetch } from "./api";
import { get } from "svelte/store";
import { getSolBalance } from "./solService";

let lastUpdate: number | null = null;

/**
 * Update user information (balances, gifts).
 * Uses a 10-minute cache unless force=true.
 * 
 * @param address - User's ETH address
 * @param force - If true, bypass cache and force refresh
 */
export async function updateUserInfo(address: string, force = false) {
  const now = Date.now();

  if (!force && lastUpdate && now - lastUpdate < 10 * 60 * 1000) {
    return;
  }

  try {
    // --- ETH balance ---
    const balEth = await getETHBalance(address);
    wallet.update((w) => {
      w.setBalance("ETH", balEth);
      return w;
    });

    // --- SOL balance ---
    try {
      const solEntry = get(wallet).addresses.find((a) => a.currency === "SOL");
      if (solEntry) {
        const balanceLamports = await getSolBalance(solEntry.address);
        const balSol = balanceLamports / 1e9;
        wallet.update((w) => {
          w.setBalance("SOL", balSol.toString()); // lamports
          return w;
        });
      }
    } catch (err) {
      // Silently fail - SOL balance is optional and public RPC endpoints often have rate limits
      // Rate limit errors are expected and don't need to be logged
      const errorMsg = err instanceof Error ? err.message : String(err);
      const isRateLimit = errorMsg.toLowerCase().includes("rate") || 
                          errorMsg.toLowerCase().includes("403") ||
                          errorMsg.toLowerCase().includes("forbidden") ||
                          (err instanceof Error && err.name === "RateLimitError");
      
      // Only log non-rate-limit errors (actual problems)
      if (!isRateLimit) {
        console.warn("[USER INFO] Failed to fetch SOL balance:", errorMsg);
      }
      // Rate limit errors are silently ignored - SOL balance just won't update
    }

    // --- Gifts (ETH only) ---
    const res = await apiFetch(`/gifts/${address}`);
    const data = await res.json();
    wallet.update((w) => {
      if (data.success) {
        w.setGifts(data.gifts || []);
      } else {
        w.setGifts([]);
      }
      return w;
    });

    lastUpdate = now;
  } catch (err) {
    console.error("[USER INFO] Failed to update user info:", err);
  }
}



/**
 * Reset the user info cache.
 * Should be called after logout to clear cached data.
 */
export function resetUserInfoCache() {
  lastUpdate = null;
  wallet.set(new (get(wallet).constructor as any)()); // fresh UserWallet
}
