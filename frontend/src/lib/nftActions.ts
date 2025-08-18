import { apiFetch } from "./api";

export async function mintNFT({
  name,
  description,
  parts,
  imageUrl,
  imageFile,
  creator,
}: {
  name: string;
  description: string;
  parts: number;
  imageUrl: string;
  imageFile: File | null;
  creator: string;
}) {
  const formData = new FormData();
  formData.append('name', name);
  formData.append('description', description);
  formData.append('parts', parts.toString());
  formData.append('creator', creator);

  // Prefer sending file if exists, else ignore imageUrl in formData
  if (imageFile) {
    formData.append('imageFile', imageFile);
  } else if (imageUrl) {
    // If your backend accepts imageUrl, include it
    formData.append('imageUrl', imageUrl);
  }

  const res = await apiFetch('/nfts/mint', {
    method: 'POST',
    body: formData // Don't set Content-Type, browser sets it automatically
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Minting failed');
  }
}
