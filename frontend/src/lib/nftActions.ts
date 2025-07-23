import { NFT } from './classes';

export async function mintNFT(nft: NFT & { imageUrl: string; imageFile: File | null }) {
  const formData = new FormData();
  formData.append('name', nft.name);
  formData.append('description', nft.description);
  formData.append('parts', nft.part_count.toString());
  formData.append('creator', nft.creator);

  // Prefer sending file if exists, else ignore imageUrl in formData
  if (nft.imageFile) {
    formData.append('imageFile', nft.imageFile);
  } else if (nft.imageUrl) {
    // If your backend accepts imageUrl, include it
    formData.append('imageUrl', nft.imageUrl);
  }

  const res = await fetch('/nfts/mint', {
    method: 'POST',
    body: formData // Don't set Content-Type, browser sets it automatically
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Minting failed');
  }

  // Return the minted NFT instance
  const result = await res.json();
  return new NFT({
    ...nft,
    _id: result.id,
    imageurl: nft.imageFile ? `/uploads/${result.id}` : nft.imageUrl,
    part_count: nft.part_count
  });
}
