<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { NFT, Listing } from "$lib/classes";
  import { apiFetch } from "$lib/api";

  let listings: Listing[] = [];
  let nfts: Record<string, NFT> = {};
  let loading = true;
  let error = "";

  // Fetch all listings and their corresponding NFTs
  onMount(async () => {
    loading = true;
    error = "";
    try {
      const res = await apiFetch("/listings");
      if (!res.ok) throw new Error("Failed to fetch listings");
      const data = await res.json();
      // Handle both old array format and new paginated format
      let allListings: any[] = [];
      if (Array.isArray(data)) {
        allListings = data;
      } else if (data && typeof data === 'object' && Array.isArray(data.items)) {
        allListings = data.items;
      } else {
        console.warn("[store page] Unexpected listings response format:", data);
        allListings = [];
      }

      // Quantity > 0 is now filtered server-side, but keep defensive check
      listings = allListings
        .filter((l: any) => l) // Defensive: filter out null/undefined
        .map((l: any) => new Listing(l));

      // Fetch NFT details for all unique nftIds (deduplicate to avoid fetching same NFT multiple times)
      const nftIds = [...new Set(listings.map(l => l.nftId).filter(Boolean))];
      const nftPromises = nftIds
        .filter(id => !nfts[id]) // Only fetch if not already cached
        .map(id => 
          apiFetch(`/nfts/${id}`)
            .then(r => r.ok ? r.json() : null)
            .catch(() => null)
        );
      
      const nftResults = await Promise.allSettled(nftPromises);
      nftResults.forEach((result, i) => {
        if (result.status === "fulfilled" && result.value) {
          nfts[nftIds[i]] = new NFT(result.value);
        } else {
          // Only create placeholder if NFT wasn't found (not if it was already cached)
          if (!nfts[nftIds[i]]) {
            nfts[nftIds[i]] = new NFT({
              _id: nftIds[i],
              name: "Unknown NFT",
              description: "",
              creator: "",
              imageurl: "",
              part_count: 0,
            });
          }
        }
      });
    } catch (e: any) {
      error = e.message || "Error loading listings";
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
    <!-- grid: up to 4 items per row on large screens -->
    <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
      {#each listings as listing}
        <div
          class="border border-black shadow p-4 flex flex-col text-black bg-transparent"
        >
          {#if nfts[listing.nftId]?.imageurl}
            <img
              src={nfts[listing.nftId].imageurl}
              alt={nfts[listing.nftId].name}
              class="w-full aspect-square mb-4"
            />
          {:else}
            <div
              class="w-full aspect-square bg-gray-200 flex items-center justify-center mb-4"
            >
              <span class="text-gray-500">No Image</span>
            </div>
          {/if}

          <h3 class="text-lg font-semibold mb-2">
            {nfts[listing.nftId]?.name || "Unknown NFT"}
          </h3>
          <p>{nfts[listing.nftId].description}</p>

          <p>
            Quantity: {listing.quantity}
            {#if listing.type === "BUNDLE"}
              <span class="ml-1 font-bold text-black-600">[BUNDLE]</span>
            {/if}
          </p>

          <p>Price per part: {listing.price} YRT</p>

          <button
            class="mt-auto bg-gray-600 hover:bg-gray-700 text-white px-4 py-2"
            on:click={() => buyListing(listing._id)}
          >
            Buy
          </button>
        </div>
      {/each}
    </div>
  </div>
{/if}
