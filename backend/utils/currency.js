// backend/utils/currency.js
// Multi-currency conversion helpers for YRT <-> Crypto with EUR as the bridge.
// ETH and SOL are supported out of the box. Easy to extend to others.

import dotenv from "dotenv";
dotenv.config();

// --- Constants ---
const YRT_TO_EUR = 1.2; // fixed peg: 1 YRT = 1.2 EUR
const COINGECKO_API = "https://api.coingecko.com/api/v3/simple/price";

// Basic in-memory caches to avoid hammering CoinGecko
let cachedEthEurRate = null;
let cachedSolEurRate = null;
let cachedAtEth = 0;
let cachedAtSol = 0;

// cache TTL in ms
const TTL_MS = 30_000;

// --- Helpers ---
function now() {
  return Date.now();
}

function fmt(n) {
  // Return a clean string (no scientific notation),
  // but keep precision. Consumers can round as needed.
  return typeof n === "string" ? n : String(n);
}

// Ensure result has safe decimals for blockchain usage
function roundCrypto(value, currency) {
  const num = Number(value);
  if (!isFinite(num)) throw new Error(`Invalid number: ${value}`);

  switch (currency.toUpperCase()) {
    case "ETH":
      // ETH supports up to 18 decimals, we keep 8 for practicality
      return num.toFixed(8).replace(/\.?0+$/, "");
    case "SOL":
      // SOL supports up to 9 decimals (lamports), we keep 9
      return num.toFixed(9).replace(/\.?0+$/, "");
    default:
      return fmt(num);
  }
}

// --- Core: fiat bridge ---
export function yrtToEur(amountYrt) {
  const yrt = Number(amountYrt || 0);
  if (!isFinite(yrt) || yrt < 0) throw new Error("Invalid YRT amount");
  return yrt * YRT_TO_EUR;
}

export function eurToYrt(amountEur) {
  const eur = Number(amountEur || 0);
  if (!isFinite(eur) || eur < 0) throw new Error("Invalid EUR amount");
  return eur / YRT_TO_EUR;
}

// --- Rates (EUR per 1 unit of coin) ---
export async function getEthEurRate() {
  const t = now();
  if (cachedEthEurRate && t - cachedAtEth < TTL_MS) return cachedEthEurRate;

  const url = `${COINGECKO_API}?ids=ethereum&vs_currencies=eur`;
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error("Failed fetching ETH/EUR rate");
  const data = await res.json();
  const rate = data?.ethereum?.eur;
  if (!isFinite(rate)) throw new Error("Invalid ETH/EUR rate from API");

  cachedEthEurRate = rate;
  cachedAtEth = t;
  return rate; // EUR per 1 ETH
}

export async function getSolEurRate() {
  const t = now();
  if (cachedSolEurRate && t - cachedAtSol < TTL_MS) return cachedSolEurRate;

  const url = `${COINGECKO_API}?ids=solana&vs_currencies=eur`;
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error("Failed fetching SOL/EUR rate");
  const data = await res.json();
  const rate = data?.solana?.eur;
  if (!isFinite(rate)) throw new Error("Invalid SOL/EUR rate from API");

  cachedSolEurRate = rate;
  cachedAtSol = t;
  return rate; // EUR per 1 SOL
}

// --- Generic YRT -> Crypto ---
export async function yrtToCrypto(amountYrt, currency) {
  const cur = String(currency || "").toUpperCase();
  const eurValue = yrtToEur(amountYrt);

  switch (cur) {
    case "ETH": {
      const eurPerEth = await getEthEurRate();
      const eth = eurValue / eurPerEth;
      return roundCrypto(eth, "ETH");
    }
    case "SOL": {
      const eurPerSol = await getSolEurRate();
      const sol = eurValue / eurPerSol;
      return roundCrypto(sol, "SOL");
    }
    default:
      throw new Error(`Unsupported currency: ${cur}`);
  }
}

// --- Generic Crypto -> YRT ---
export async function cryptoToYrt(amountCrypto, currency) {
  const cur = String(currency || "").toUpperCase();
  const amt = Number(amountCrypto || 0);
  if (!isFinite(amt) || amt < 0) throw new Error("Invalid crypto amount");

  switch (cur) {
    case "ETH": {
      const eurPerEth = await getEthEurRate();
      const eur = amt * eurPerEth;
      return eurToYrt(eur);
    }
    case "SOL": {
      const eurPerSol = await getSolEurRate();
      const eur = amt * eurPerSol;
      return eurToYrt(eur);
    }
    default:
      throw new Error(`Unsupported currency: ${cur}`);
  }
}

// --- Backward compatibility helpers (ETH-only) ---
export async function yrtToEth(amountYrt) {
  return yrtToCrypto(amountYrt, "ETH");
}

export async function ethToYrt(amountEth) {
  return cryptoToYrt(amountEth, "ETH");
}
