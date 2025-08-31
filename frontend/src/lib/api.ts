// src/lib/api.ts

/**
 * Generic API fetch wrapper.
 * Usage:
 *   const res = await apiFetch("listings");
 *   const data = await res.json();
 *
 *   const res = await apiFetch("wallets/login", {
 *     method: "POST",
 *     headers: { "Content-Type": "application/json" },
 *     body: JSON.stringify(payload)
 *   });
 *   const data = await res.json();
 */
export async function apiFetch(path: string, options: RequestInit = {}) {
  // Normalize: remove leading slashes and always prefix with /api/
  const normalized = path.replace(/^\/+/, "");
  const url = `/api/${normalized}`;

  const res = await fetch(url, options);

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

  return res; // return raw Response, caller decides .json() or .text()
}

/**
 * Helper: fetch all NFTs
 */
export async function fetchNFTs() {
  const res = await apiFetch("nfts");
  return res.json();
}

/**
 * Helper: create a new NFT
 */
export async function createNFT(nftData: any) {
  const res = await apiFetch("nfts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(nftData),
  });
  return res.json();
}
