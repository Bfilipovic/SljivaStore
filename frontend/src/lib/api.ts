// src/lib/api.ts

/**
 * Build full API URL consistently under /api/*
 */
function buildUrl(path: string): string {
  // strip leading slashes to avoid double //
  const normalized = path.replace(/^\/+/, '');
  return `/api/${normalized}`;
}

/**
 * Fetch all NFTs
 */
export async function fetchNFTs() {
  const res = await fetch(buildUrl('nfts'));
  if (!res.ok) {
    throw new Error(`Failed to fetch NFTs (${res.status})`);
  }
  return res.json();
}

/**
 * Create a new NFT
 */
export async function createNFT(nftData: any) {
  const res = await fetch(buildUrl('nfts'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(nftData),
  });
  if (!res.ok) {
    throw new Error(`Failed to create NFT (${res.status})`);
  }
  return res.json();
}

/**
 * Generic API fetch wrapper
 * Usage: apiFetch("nfts/123"), apiFetch("wallets/login", { method: "POST", body: ... })
 */
export async function apiFetch(path: string, options: RequestInit = {}) {
  const res = await fetch(buildUrl(path), options);
  if (!res.ok) {
    let msg = `API error ${res.status}: ${res.statusText}`;
    try {
      const errJson = await res.json();
      if (errJson?.error) msg = errJson.error;
    } catch {
      // ignore JSON parse error
    }
    throw new Error(msg);
  }
  return res;
}
