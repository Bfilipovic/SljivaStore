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
    let errorData: any = {};
    
    try {
      const errJson = await res.json();
      errorData = errJson;
      if (errJson?.error) msg = errJson.error;
      if (errJson?.message) msg = errJson.message;
    } catch {
      // ignore JSON parse error
    }
    
    // Create error with maintenance mode info if applicable
    const error: any = new Error(msg);
    if (res.status === 503 && errorData.maintenanceMode) {
      error.maintenanceMode = true;
      error.reason = errorData.reason || msg;
    }
    
    throw error;
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
