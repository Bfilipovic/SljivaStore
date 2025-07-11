<script lang="ts">
  import { page } from '$app/stores';
  import { onMount } from 'svelte';

  let listingId = '';
  let listing = null;
  let nft = null;
  let parts = [];
  let error = '';
  let loading = true;

  $: listingId = $page.params.id;

  onMount(async () => {
    loading = true;
    try {
      // Fetch the listing
      const res = await fetch(`/nfts/listings`);
      const all = await res.json();
      listing = all.find(l => l._id === listingId);
      if (!listing) throw new Error('Listing not found');

      // Fetch the NFT data
      const nftRes = await fetch(`/nfts/${listing.nftId}`);
      nft = await nftRes.json();

      // Fetch full part info for each part in this listing
      const partRes = await fetch(`/nfts/${listing.nftId}/parts`);
      const allParts = await partRes.json();
      parts = allParts.filter(p => listing.parts.includes(p._id));
    } catch (e: any) {
      error = e.message || 'Failed to load listing';
    } finally {
      loading = false;
    }
  });
</script>

<div class="max-w-3xl mx-auto p-4">
  <h1 class="text-2xl font-bold mb-4">Listing Details</h1>

  {#if loading}
    <p>Loading...</p>
  {:else if error}
    <p class="text-red-600">{error}</p>
  {:else if listing && nft}
    <div class="space-y-4">
      <img src={nft.imageurl} alt={nft.name} class="w-full max-w-md rounded" />
      <div>
        <h2 class="text-xl font-semibold">{nft.name}</h2>
        <p><a href='/nft/{nft._id}' class="text-blue-600 hover:underline break-all"><strong>NFT Hash:</strong> {nft._id}</a></p>
        <p><strong>Description:</strong> {nft.description}</p>
        <p><strong>Creator:</strong> {nft.creator}</p>
        <p><strong>Total parts:</strong> {nft.part_count}</p>
      </div>

      <div class="border-t pt-4 mt-4">
        <p><strong>Listing ID:</strong> {listing._id}</p>
        <p><strong>Price:</strong> {listing.price} ETH</p>
        <p><strong>Seller:</strong> {listing.seller}</p>
        <p><strong>Quantity:</strong> {listing.parts.length}</p>
      </div>

      <div class="mt-6">
        <h3 class="text-lg font-semibold mb-2">
          Listing {listing.parts.length} parts:
        </h3>
        <ul class="mt-2 list-disc list-inside text-sm text-blue-700">
          {#each parts as part}
            <li>
              <a
                href={`/part/${part._id}`}
                class="text-blue-600 hover:underline break-all"
              >
                {part._id}
              </a>
            </li>
          {/each}
        </ul>
      </div>
    </div>
  {/if}
</div>
