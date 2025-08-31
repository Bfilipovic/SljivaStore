<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { NFT, Listing } from '$lib/classes';
  import { apiFetch } from '$lib/api';


  let listings: Listing[] = [];
  let nfts: Record<string, NFT> = {};
  let loading = true;
  let error = '';

  // Fetch all listings and their corresponding NFTs
  onMount(async () => {
    loading = true;
    error = '';
    try {
      const res = await apiFetch('/nfts/listings');
      if (!res.ok) throw new Error('Failed to fetch listings');
      let allListings = await res.json();
      // Only show listings with quantity > 0
      listings = allListings.filter(l => l.parts.length > 0).map((l: any) => new Listing(l));

      // Fetch NFT details for each listing nftId in parallel
      const nftPromises = listings.map(l => 
        apiFetch(`/nfts/${l.nftId}`).then(r => {
          if (!r.ok) throw new Error(`Failed to fetch NFT ${l.nftId}`);
          return r.json();
        })
      );
      const nftResults = await Promise.allSettled(nftPromises);

      nftResults.forEach((result, i) => {
        if (result.status === 'fulfilled') {
          nfts[listings[i].nftId] = new NFT(result.value);
        } else {
          nfts[listings[i].nftId] = new NFT({
            _id: listings[i].nftId,
            name: 'Unknown NFT',
            description: '',
            creator: '',
            imageurl: '',
            part_count: 0
          });
        }
      });

    } catch (e: any) {
      error = e.message || 'Error loading listings';
    } finally {
      loading = false;
    }
  });

  function buyListing(listingId: string) {
    goto(`/listing/${listingId}`);
  }
</script>

{#if loading}
  <p class="text-center mt-8">Loading listings...</p>
{:else if error}
  <p class="text-center text-red-600 mt-8">{error}</p>
{:else if listings.length === 0}
  <p class="text-center text-gray-600 mt-8">No listings found.</p>
{:else}
  <div class="px-4 sm:px-6 lg:px-8 pt-8">
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {#each listings as listing}
        <div class="border border-black -lg shadow p-4 flex flex-col text-black bg-transparent">
          {#if nfts[listing.nftId]?.imageurl}
            <img
              src={nfts[listing.nftId].imageurl}
              alt={nfts[listing.nftId].name}
              class="w-full h-48 object-cover  mb-4"
            />
          {:else}
            <div class="w-full h-48 bg-gray-200 flex items-center justify-center  mb-4">
              <span class="text-gray-500">No Image</span>
            </div>
          {/if}

          <h3 class="text-lg font-semibold mb-2">
            {nfts[listing.nftId]?.name || 'Unknown NFT'}
          </h3>
          <p>{nfts[listing.nftId].description}</p>
          <p>Price: {listing.price} YRT</p>
          <p>Quantity: {listing.parts.length}</p>

          <button
            class="mt-auto bg-gray-600 hover:bg-gray-700 text-white px-3 py-1 text-white px-4 py-2"
            on:click={() => buyListing(listing._id)}
          >
            Buy
          </button>
        </div>
      {/each}
    </div>
  </div>
{/if}
