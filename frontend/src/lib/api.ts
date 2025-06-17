// src/lib/api.ts

const API_BASE_URL = 'http://localhost:3000/'; // Change to your backend base URL

export async function fetchNFTs() {
  const res = await fetch(`${API_BASE_URL}/nfts`);
  if (!res.ok) {
    throw new Error('Failed to fetch NFTs');
  }
  return await res.json();
}

export async function createNFT(nftData: any) {
  const res = await fetch(`${API_BASE_URL}/nfts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(nftData)
  });
  if (!res.ok) {
    throw new Error('Failed to create NFT');
  }
  return await res.json();
}

// Add other API calls similarly...
