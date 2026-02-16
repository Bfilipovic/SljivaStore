import { writable } from "svelte/store";
import { browser } from "$app/environment";

export interface AddressEntry {
  currency: string;
  address: string;
}

export interface BalanceEntry {
  currency: string;
  balance: string;
}

export class UserWallet {
  selectedCurrency: string = "ETH";
  selectedAddress: string | null = null;
  selectedBalance: string = "0";

  addresses: AddressEntry[] = [];
  balances: BalanceEntry[] = [];
  gifts: any[] = [];
  isAdmin: boolean = false;

// Convenience fields
  ethAddress: string | null = null;
  ethBalance: string = "0";

  constructor(init?: Partial<UserWallet>) {
    Object.assign(this, init);
    this.updateSelected();
  }

  updateSelected() {
    const addr = this.addresses.find((a) => a.currency === this.selectedCurrency);
    const bal = this.balances.find((b) => b.currency === this.selectedCurrency);

    this.selectedAddress = addr ? addr.address : null;
    this.selectedBalance = bal ? bal.balance : "0";

    // keep convenience ETH fields in sync
    this.ethAddress = this.addresses.find((a) => a.currency === "ETH")?.address ?? null;
    this.ethBalance = this.balances.find((b) => b.currency === "ETH")?.balance ?? "0";
  }

  setBalance(currency: string, balance: string) {
    const idx = this.balances.findIndex((b) => b.currency === currency);
    if (idx >= 0) {
      this.balances[idx].balance = balance;
    } else {
      this.balances.push({ currency, balance });
    }
    this.updateSelected();
  }

  setAddress(currency: string, address: string) {
    const idx = this.addresses.findIndex((a) => a.currency === currency);
    if (idx >= 0) {
      this.addresses[idx].address = address;
    } else {
      this.addresses.push({ currency, address });
    }
    this.updateSelected();
  }

  setSelectedCurrency(currency: string) {
    this.selectedCurrency = currency;
    this.updateSelected();
  }

  setAdmin(status: boolean) {
    this.isAdmin = status;
  }

  setGifts(g: any[]) {
    this.gifts = g;
  }
}

// --- Store ---
let initialWallet = new UserWallet();

if (browser) {
  // Load from localStorage
  try {
    const raw = localStorage.getItem("wallet");
    if (raw) {
      initialWallet = new UserWallet(JSON.parse(raw));
    }
  } catch {
    /* ignore */
  }
}

export const wallet = writable<UserWallet>(initialWallet);

if (browser) {
  // Persist on every change
  let isUpdatingFromStorage = false;
  
  wallet.subscribe((val) => {
    // Prevent infinite loop when updating from storage event
    if (isUpdatingFromStorage) return;
    
    try {
      localStorage.setItem("wallet", JSON.stringify(val));
      // Trigger storage event for cross-tab sync
      localStorage.setItem("wallet_sync", Date.now().toString());
    } catch {
      /* ignore */
    }
  });
  
  // Listen for storage events from other tabs
  window.addEventListener("storage", (e) => {
    if (e.key === "wallet" && e.newValue) {
      try {
        isUpdatingFromStorage = true;
        const newWallet = new UserWallet(JSON.parse(e.newValue));
        wallet.set(newWallet);
      } catch {
        /* ignore */
      } finally {
        isUpdatingFromStorage = false;
      }
    } else if (e.key === "wallet" && e.newValue === null) {
      // Wallet was cleared in another tab (logout)
      isUpdatingFromStorage = true;
      wallet.set(new UserWallet());
      isUpdatingFromStorage = false;
    }
  });
}
