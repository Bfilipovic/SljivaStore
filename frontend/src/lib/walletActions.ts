/**
 * Wallet Actions
 * 
 * Core wallet management functions including:
 * - Login/logout with mnemonic
 * - Wallet creation
 * - Payment processing for reservations
 * - Transaction cost estimation
 */

import { wallet, UserWallet } from "./stores/wallet";
import { goto } from "$app/navigation";
import { getETHBalance, createETHTransaction, getCurrentEthTxCost, getEthWalletFromMnemonic } from "./ethService";
import { updateUserInfo } from "./userInfo";
import { HDNodeWallet, Mnemonic } from "ethers";
import { randomBytes } from "ethers/crypto";
import { get } from "svelte/store";
import { getSolWalletFromMnemonic, createSolTransaction } from "./solService";
import { 
  encryptMnemonic, 
  decryptMnemonic, 
  hasActiveSession, 
  clearSession as clearSessionStorage,
  updateActivity 
} from "./sessionManager";

/**
 * Login with a mnemonic phrase.
 * Derives both ETH and SOL wallets from the same mnemonic.
 * Updates user info and admin status after login.
 * Does NOT set up session - use setupSession() after this.
 * 
 * @param mnemonic - 12-word mnemonic phrase
 * @returns ETH address of the logged-in wallet
 */
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
  await checkSuperAdminStatus(ethAddress);

  return ethAddress;
}

/**
 * Set up encrypted session with mnemonic and session password.
 * Call this after loginWalletFromMnemonic().
 * 
 * @param mnemonic - 12-word mnemonic phrase
 * @param sessionPassword - User's session password
 */
export async function setupSession(mnemonic: string, sessionPassword: string): Promise<void> {
  await encryptMnemonic(mnemonic, sessionPassword);
  updateActivity();
}

/**
 * Get mnemonic from session using session password.
 * Updates activity timestamp.
 * 
 * @param sessionPassword - User's session password
 * @returns Decrypted mnemonic
 */
export async function getMnemonicFromSession(sessionPassword: string): Promise<string> {
  updateActivity();
  return await decryptMnemonic(sessionPassword);
}

/**
 * Check if there's an active session
 */
export function isSessionActive(): boolean {
  return hasActiveSession();
}

/**
 * Clear the session storage (without logging out)
 */
export function clearSession(): void {
  clearSessionStorage();
}

/**
 * Clear the session (logout)
 */
export function clearUserSession(): void {
  clearSessionStorage();
  logout();
}


/**
 * Logout the current user.
 * Clears wallet state, session, and redirects to home page.
 */
export function logout() {
  clearSessionStorage();
  wallet.set(new UserWallet());
  goto("/");
}

/**
 * Check if an address has admin privileges.
 * Updates wallet store with admin status.
 * 
 * @param address - Address to check
 */
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
 * Check if an address is the superadmin.
 * Updates wallet store with superadmin status.
 * 
 * @param address - Address to check
 */
async function checkSuperAdminStatus(address: string) {
  try {
    const res = await fetch(`/api/admins/superadmin/${address.toLowerCase()}`);
    if (res.ok) {
      const { isSuperAdmin } = await res.json();
      wallet.update((w) => {
        w.setSuperAdmin(!!isSuperAdmin);
        return w;
      });
    } else {
      wallet.update((w) => {
        w.setSuperAdmin(false);
        return w;
      });
    }
  } catch {
    wallet.update((w) => {
      w.setSuperAdmin(false);
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

/**
 * Get wallet balance for an address.
 * 
 * @param address - ETH address
 * @returns Balance as string
 */
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

  return !!current && current === derivedAddress;
}

/**
 * Pay for a reservation.
 * @param reservation The reservation object returned by backend
 * @param mnemonicOrPassword User's 12-word mnemonic (string) or session password
 * @returns chainTx hash/string
 */
export async function payForReservation(reservation: any, mnemonicOrPassword: string): Promise<string> {
  // If mnemonicOrPassword is a mnemonic (12 words), use it directly
  // Otherwise, treat it as a session password and get mnemonic from session
  let mnemonic: string;
  if (mnemonicOrPassword.split(' ').length === 12) {
    mnemonic = mnemonicOrPassword;
  } else {
    mnemonic = await getMnemonicFromSession(mnemonicOrPassword);
  }

  const currency = reservation.totalPriceCrypto?.currency;
  const amount = reservation.totalPriceCrypto?.amount;
  if (!currency || !amount) throw new Error("Reservation missing currency/amount");

  const sellerWallet = reservation.sellerWallet;
  if (!sellerWallet) throw new Error("Reservation missing sellerWallet");

  switch (currency.toUpperCase()) {
    case "ETH": {
      // amount in ETH string
      const result = await createETHTransaction(sellerWallet, amount, mnemonic);
      return result.txHash; // Return only the transaction hash
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
