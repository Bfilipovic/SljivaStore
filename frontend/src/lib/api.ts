// src/lib/api.ts

// In dev (Vite), VITE_PUBLIC_API_URL can point to http://localhost:3000
// In prod, we don't need it, since nginx proxies /api/* to backend.
const API_BASE_URL = import.meta.env.VITE_PUBLIC_API_URL || ''; // empty = same-origin

function buildUrl(path: string) {
  // strip leading slashes to avoid "/api//..."
  const normalized = path.replace(/^\/+/, '');
  const url = `${API_BASE_URL}/api/${normalized}`;
  console.log("PATH:", path);
  console.log("DEBUG URL:", url);
  return url;
}

export async function fetchNFTs() {
  const res = await fetch(buildUrl('nfts'));
  if (!res.ok) {
    throw new Error(`Failed to fetch NFTs (${res.status})`);
  }
  return res.json();
}

export async function createNFT(nftData: any) {
  const res = await fetch(buildUrl('nfts'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(nftData)
  });
  if (!res.ok) {
    throw new Error(`Failed to create NFT (${res.status})`);
  }
  return res.json();
}

export async function apiFetch(path: string, options: RequestInit = {}) {
  // allow both "nfts" and "/nfts"
  const res = await fetch(buildUrl(path), options);
  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${res.statusText}`);
  }
  console.log("API response:", res);
  return res;
}

