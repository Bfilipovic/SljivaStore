<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import type {Listing, NFT} from '$lib/types/nft'


  let listings: Listing[] = [];
  let nfts: Record<string, NFT> = {};
  let loading = true;
  let error = '';

  // Fetch all listings and their corresponding NFTs
  onMount(async () => {
    loading = true;
    error = '';
    try {
      const res = await fetch('/nfts/listings');
      if (!res.ok) throw new Error('Failed to fetch listings');
      listings = await res.json();

      // Fetch NFT details for each listing nftId in parallel
      const nftPromises = listings.map(l => 
        fetch(`/nfts/${l.nftId}`).then(r => {
          if (!r.ok) throw new Error(`Failed to fetch NFT ${l.nftId}`);
          return r.json();
        })
      );
      const nftResults = await Promise.allSettled(nftPromises);

      nftResults.forEach((result, i) => {
        if (result.status === 'fulfilled') {
          nfts[listings[i].nftId] = result.value;
        } else {
          nfts[listings[i].nftId] = {
            _id: listings[i].nftId,
            name: 'Unknown NFT',
            imageurl: ''
          };
        }
      });

    } catch (e: any) {
      error = e.message || 'Error loading listings';
    } finally {
      loading = false;
    }
  });

  function buyListing(listingId: string) {
    // Navigate to buy page - you will implement it later
    goto(`/buy/${listingId}`);
  }
</script>

{#if loading}
  <p>Loading listings...</p>
{:else if error}
  <p style="color: red;">{error}</p>
{:else if listings.length === 0}
  <p>No listings found.</p>
{:else}
  <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
    {#each listings as listing}
      <div class="border rounded shadow p-4 flex flex-col">
        {#if nfts[listing.nftId]?.imageurl}
          <img
            src={nfts[listing.nftId].imageurl}
            alt={nfts[listing.nftId].name}
            class="w-full h-48 object-cover rounded mb-4"
          />
        {:else}
          <div class="w-full h-48 bg-gray-300 flex items-center justify-center rounded mb-4">
            <span>No Image</span>
          </div>
        {/if}

        <h3 class="text-lg font-semibold mb-2">Name: {nfts[listing.nftId]?.name || 'Unknown NFT'}</h3>
        <p>Hash: {listing.nftId}</p>
        <p>Seller: {listing.seller}</p>
        <p>Price: {listing.price} ETH</p>
        <p>Quantity: {listing.parts.length}</p>

        <div class="flex justify-between mt-auto gap-4">
          <button
            class="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 flex-1"
            on:click={() => buyListing(listing._id)}
          >
            Buy
          </button>
          <button
            class="bg-gray-400 text-white px-4 py-2 rounded hover:bg-gray-500 flex-1"
            on:click={() => goto(`/nft/${listing.nftId}`)}
          >
            Info
          </button>
        </div>
      </div>
    {/each}
  </div>
{/if}

<style>
  /* Simple grid and card styles for demo */
</style>
