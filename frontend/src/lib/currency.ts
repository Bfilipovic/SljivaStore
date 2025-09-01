// backend/utils/currency.js

const YRT_TO_EUR = 1.2; // fixed peg: 1 YRT = 1.2 EUR

let cachedEthEurRate = null;
let lastFetch = 0;

/**
 * Get current ETH/EUR rate (EUR per 1 ETH).
 * Uses CoinGecko, cached for 30s to avoid spam.
 */
export async function getEthEurRate() {
  const now = Date.now();
  if (!cachedEthEurRate || now - lastFetch > 30_000) {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=eur"
    );
    const data = await res.json();
    cachedEthEurRate = data.ethereum.eur; // EUR per ETH
    lastFetch = now;
  }
  return cachedEthEurRate;
}

/**
 * Convert YRT → EUR.
 */
export function yrtToEur(amountYrt) {
  return amountYrt * YRT_TO_EUR;
}

/**
 * Convert EUR → YRT.
 */
export function eurToYrt(amountEur) {
  return amountEur / YRT_TO_EUR;
}

/**
 * Convert YRT → ETH.
 * Fetches ETH/EUR rate and applies YRT→EUR first.
 */
export async function yrtToEth(amountYrt) {
  const rate = await getEthEurRate(); // EUR per 1 ETH
  const eurValue = yrtToEur(amountYrt);
  return eurValue / rate;
}

/**
 * Convert ETH → YRT.
 */
export async function ethToYrt(amountEth) {
  const rate = await getEthEurRate(); // EUR per 1 ETH
  const eurValue = amountEth * rate;
  return eurToYrt(eurValue);
}
