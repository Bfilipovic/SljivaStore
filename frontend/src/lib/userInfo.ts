import { wallet } from "$lib/stores/wallet";
import { getETHBalance } from "./ethService";
import { apiFetch } from "./api";
import { get } from "svelte/store";
import { getSolBalance } from "./solService";

let lastUpdate: number | null = null;

export async function updateUserInfo(address: string, force = false) {
  const now = Date.now();

  if (!force && lastUpdate && now - lastUpdate < 10 * 60 * 1000) {
    console.log("[USER INFO] Skipping update (fetched recently)");
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
        const balSol = await getSolBalance(solEntry.address);
        wallet.update((w) => {
          w.setBalance("SOL", balSol.toString()); // lamports
          return w;
        });
      }
    } catch (err) {
      console.warn("[USER INFO] Failed to fetch SOL balance:", err);
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
    console.log(`[USER INFO] Updated info for ${address}`);
  } catch (err) {
    console.error("[USER INFO] Failed to update user info:", err);
  }
}



/** Reset cache (e.g. after logout) */
export function resetUserInfoCache() {
  lastUpdate = null;
  wallet.set(new (get(wallet).constructor as any)()); // fresh UserWallet
}
