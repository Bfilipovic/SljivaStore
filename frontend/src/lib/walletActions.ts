import { wallet, UserWallet } from "./stores/wallet";
import { goto } from "$app/navigation";
import { getETHBalance, createETHTransaction, getCurrentEthTxCost, getEthWalletFromMnemonic } from "./ethService";
import { updateUserInfo } from "./userInfo";
import { HDNodeWallet, Mnemonic } from "ethers";
import { randomBytes } from "ethers/crypto";
import { get } from "svelte/store";
import { getSolWalletFromMnemonic, createSolTransaction } from "./solService";

// --- Login flow ---
export async function loginWalletFromMnemonic(mnemonic: string): Promise<string> {
  const ethWallet = getEthWalletFromMnemonic(mnemonic);
  const ethAddress = ethWallet.address;

  const solWallet = getSolWalletFromMnemonic(mnemonic);
  const solAddress = solWallet.publicKey.toBase58();

  // Store both
  wallet.update((w) => {
    w.setAddress("ETH", ethAddress);
    w.setAddress("SOL", solAddress);
    w.setSelectedCurrency("ETH"); // default ETH
    return w;
  });

  // Single unified update
  await updateUserInfo(ethAddress, true);
  await checkAdminStatus(ethAddress);

  return ethAddress;
}


// --- Logout flow ---
export function logout() {
  wallet.set(new UserWallet());
  goto("/");
}

// --- Admin check ---
async function checkAdminStatus(address: string) {
  try {
    const res = await fetch(`/api/admins/check/${address.toLowerCase()}`);
    if (res.ok) {
      const { isAdmin } = await res.json();
      wallet.update((w) => {
        w.setAdmin(!!isAdmin);
        return w;
      });
    } else {
      wallet.update((w) => {
        w.setAdmin(false);
        return w;
      });
    }
  } catch {
    wallet.update((w) => {
      w.setAdmin(false);
      return w;
    });
  }
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
  const derived = getEthWalletFromMnemonic(mnemonic);
  const derivedAddress = derived.address.toLowerCase();

  const current = get(wallet).ethAddress?.toLocaleLowerCase() ?? null;

  console.log("mnemonicMatchesLoggedInWallet:", { derivedAddress, current });
  return !!current && current === derivedAddress;
}

// --- Existing login/logout logic stays the same ---

/**
 * Pay for a reservation.
 * @param reservation The reservation object returned by backend
 * @param mnemonic User's 12-word mnemonic (string)
 * @returns chainTx hash/string
 */
export async function payForReservation(reservation: any, mnemonic: string): Promise<string> {
  const currency = reservation.totalPriceCrypto?.currency;
  const amount = reservation.totalPriceCrypto?.amount;
  if (!currency || !amount) throw new Error("Reservation missing currency/amount");

  const sellerWallet = reservation.sellerWallet;
  if (!sellerWallet) throw new Error("Reservation missing sellerWallet");

  switch (currency.toUpperCase()) {
    case "ETH": {
      // amount in ETH string
      const chainTx = await createETHTransaction(sellerWallet, amount, mnemonic);
      return chainTx;
    }
    case "SOL": {
      // amount in SOL -> convert to lamports (1 SOL = 1e9 lamports)
      const lamports = Math.floor(Number(amount) * 1e9);
      const chainTx = await createSolTransaction(mnemonic, sellerWallet, lamports);
      return chainTx;
    }
    default:
      throw new Error(`Unsupported currency: ${currency}`);
  }
}

/**
 * Estimate current tx cost (network fee).
 * @param currency "ETH" or "SOL"
 */
export async function getCurrentTxCost(currency: string): Promise<string> {
  switch (currency.toUpperCase()) {
    case "ETH":
      return getCurrentEthTxCost(); // returns ETH string
    case "SOL":
      // rough fixed fee for simple transfer: ~5000 lamports = 0.000005 SOL
      return "0.000005";
    default:
      throw new Error(`Unsupported currency: ${currency}`);
  }
}

// --- Utility re-exports ---
export { createETHTransaction, getCurrentEthTxCost } from "./ethService";
export { signAndWrapPayload, signedFetch } from "./signing";
