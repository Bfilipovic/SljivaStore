import { apiFetch } from "$lib/api";

/**
 * Mint a new NFT.
 */
export async function mintNFT(nftData: {
  name: string;
  description: string;
  parts: number;
  imageUrl: string;
  creator: string;
}) {
  return await apiFetch("nfts/mint", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(nftData),
  });
}

/**
 * Fetch a single NFT by ID.
 */
export async function fetchNFT(id: string) {
  return await apiFetch(`nfts/${id}`);
}

/**
 * Fetch NFTs by creator address.
 */
export async function fetchNFTsByCreator(address: string) {
  return await apiFetch(`nfts/creator/${address}`);
}

/**
 * Fetch all NFTs.
 */
export async function fetchAllNFTs() {
  return await apiFetch("nfts");
}
