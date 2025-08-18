// src/lib/api.ts

const API_BASE_URL = (import.meta.env.PUBLIC_API_URL || 'http://localhost:3000').replace(/\/$/, '');

function buildUrl(path: string) {
  const url = `${API_BASE_URL}/${path.replace(/^\/+/, '')}`;
  console.log("PATH:", path);   // 👈 add this
  console.log("DEBUG URL:", url);   // 👈 add this
  return url;
}

export async function fetchNFTs() {
  const res = await fetch(buildUrl('/nfts'));
  if (!res.ok) {
    throw new Error(`Failed to fetch NFTs (${res.status})`);
  }
  return res.json();
}

export async function createNFT(nftData: any) {
  const res = await fetch(buildUrl('/nfts'), {
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
  const res = await fetch(buildUrl(path), options);
  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${res.statusText}`);
  }
  console.log("API response:", res); // Debugging line
  return res;
}
