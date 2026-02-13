<script lang="ts">
  import { onMount } from "svelte";
  import { wallet } from "$lib/stores/wallet";
  import { get } from "svelte/store";
  import { goto } from "$app/navigation";
  import {
    signedFetch,
    isSessionActive
  } from "$lib/walletActions";
  import SessionPasswordInput from "$lib/SessionPasswordInput.svelte";
  import SuccessPopup from "$lib/SuccessPopup.svelte";
  import ToggleSwitch from "$lib/ToggleSwitch.svelte";
  import { apiFetch } from "$lib/api";
  import { Listing, NFT } from "$lib/classes";

  let address = "";
  let listings: Listing[] = [];
  let listingsRaw: any[] = [];
  let nfts: Record<string, NFT> = {};
  let loading = true;
  let error = "";
  let currentPage = 0;
  let totalListings = 0;
  const pageSize = 5;
  let showActive = true; // Toggle between active and completed
  $: showCompleted = !showActive; // Inverted for toggle switch
  let showSessionPasswordFor: { id: string; action: "delete" } | null = null;
  let actionError = "";
  let successMessage = "";
  let showSuccessPopup = false;
  let processing = false;
  let copiedTxId: string | null = null;

  async function loadListings(page: number, active: boolean) {
    if (!address) return;
    
    loading = true;
    error = "";
    try {
      const skip = page * pageSize;
      const endpoint = active
        ? `/listings/user/${address}?skip=${skip}&limit=${pageSize}`
        : `/listings/user/${address}/completed?skip=${skip}&limit=${pageSize}`;
      
      const res = await apiFetch(endpoint);
      if (!res.ok) throw new Error("Failed to fetch listings");
      
      const data = await res.json();
      listingsRaw = data.items || [];
      listings = listingsRaw.map((l: any) => new Listing(l));
      totalListings = data.total || 0;
      currentPage = page;

      // Fetch NFT details for all unique nftIds
      const nftIds = [...new Set(listings.map(l => l.nftId).filter(Boolean))];
      const nftPromises = nftIds
        .filter(id => !nfts[id])
        .map(id => 
          apiFetch(`/nfts/${id}`)
            .then(r => r.ok ? r.json() : null)
            .catch(() => null)
        );
      
      const nftResults = await Promise.allSettled(nftPromises);
      nftResults.forEach((result, i) => {
        if (result.status === "fulfilled" && result.value) {
          nfts[nftIds[i]] = new NFT(result.value);
        }
      });
    } catch (e: any) {
      error = e.message || "Error fetching listings";
    } finally {
      loading = false;
    }
  }

  onMount(async () => {
    const addr = get(wallet).ethAddress;
    if (!addr) {
      goto("/login");
      return;
    }
    address = addr.toLowerCase();
    await loadListings(0, true);
  });

  function handleToggleChange() {
    showActive = !showCompleted;
    loadListings(0, showActive);
  }

  function viewListing(listingId: string) {
    goto(`/listing/${listingId}`);
  }

  function shortHash(hash: string) {
    return hash.slice(0, 8) + "...";
  }

  function openSessionPassword(listingId: string) {
    if (processing) return;
    if (!isSessionActive()) {
      actionError = "No active session. Please log in again.";
      return;
    }
    actionError = "";
    successMessage = "";
    showSuccessPopup = false;
    showSessionPasswordFor = { id: listingId, action: "delete" };
  }

  function cancelSessionPassword() {
    if (processing) return;
    showSessionPasswordFor = null;
    actionError = "";
    successMessage = "";
    showSuccessPopup = false;
  }

  async function confirmDeleteSessionPassword(e: CustomEvent<{ password: string }>) {
    if (processing) return;
    processing = true;

    const sessionPassword = e.detail.password;

    try {
      if (!isSessionActive()) {
        actionError = "No active session. Please log in again.";
        processing = false;
        return;
      }

      const listing = listings.find((l) => l._id === showSessionPasswordFor?.id);
      if (!listing) throw new Error("Listing not found");

      const res = await signedFetch(
        `/listings/${listing._id}`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            seller: address,
          }),
        },
        sessionPassword,
      );

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "Failed to delete listing");
      }

      successMessage = "Listing deleted successfully!";
      showSessionPasswordFor = null;
      actionError = "";
      
      showSuccessPopup = true;
    } catch (e: any) {
      actionError = e.message || "Error deleting listing";
      processing = false;
    }
  }
  
  async function handleSuccessPopupClose() {
    showSuccessPopup = false;
    successMessage = "";
    processing = false;
    await loadListings(currentPage, showActive);
  }

  async function copyTxHash(txId: string, arweaveTxId: string | null) {
    // Copy Transaction ID (not Arweave ID)
    const textToCopy = txId;
    try {
      await navigator.clipboard.writeText(textToCopy);
      copiedTxId = txId;
      setTimeout(() => {
        copiedTxId = null;
      }, 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }

  function openInArweave(arweaveTxId: string) {
    if (arweaveTxId) {
      window.open(`https://viewblock.io/arweave/tx/${arweaveTxId}`, '_blank');
    }
  }

  function getArweaveTxId(listing: any): string | null {
    return listing.buyTransaction?.arweaveTxId || listing.cancelTransaction?.arweaveTxId || null;
  }

  function getTxHash(listing: any): string | null {
    if (listing.buyTransaction?.arweaveTxId) {
      return listing.buyTransaction.arweaveTxId;
    }
    if (listing.cancelTransaction?.arweaveTxId) {
      return listing.cancelTransaction.arweaveTxId;
    }
    if (listing.buyTransaction?._id) {
      return listing.buyTransaction._id;
    }
    if (listing.cancelTransaction?._id) {
      return listing.cancelTransaction._id;
    }
    return null;
  }

  function getTxId(listing: any): string | null {
    return listing.buyTransaction?._id || listing.cancelTransaction?._id || null;
  }

  const totalPages = Math.ceil(totalListings / pageSize);
</script>

<div class="max-w-4xl mx-auto p-4">
  <h1 class="text-2xl font-bold mb-6">My Listings</h1>

  <ToggleSwitch bind:value={showCompleted} on:change={handleToggleChange} leftLabel="Active" rightLabel="Completed" />

  {#if loading && listings.length === 0}
    <p>Loading your listings...</p>
  {:else if error}
    <p class="text-red-600">{error}</p>
  {:else if listings.length === 0}
    <p>You have no {showActive ? "active" : "completed"} listings.</p>
  {:else}
    <div class="space-y-4">
      {#each listings as listing, index}
        {@const nft = nfts[listing.nftId]}
        {@const rawListing = listingsRaw[index]}
        <div class="border border-gray-300 p-4 bg-white shadow-sm hover:shadow-md transition">
          <div class="flex flex-col sm:flex-row gap-4">
            <!-- NFT Image -->
            {#if nft?.imageurl}
              <img
                src={nft.imageurl}
                alt={nft.name || "NFT"}
                class="w-20 h-20 sm:w-24 sm:h-24 object-cover flex-shrink-0"
              />
            {:else}
              <div class="w-20 h-20 sm:w-24 sm:h-24 bg-gray-200 flex items-center justify-center flex-shrink-0">
                <span class="text-gray-400 text-xs">Loading...</span>
              </div>
            {/if}

            <!-- Listing Info -->
            <div class="flex-grow min-w-0">
              {#if nft?.name}
                <h3 class="font-semibold text-lg mb-2 truncate">{nft.name}</h3>
              {/if}
              
              <div class="text-sm space-y-1 text-gray-700">
                <div><span class="font-medium">Quantity:</span> {listing.quantity} part{listing.quantity > 1 ? "s" : ""}</div>
                <div><span class="font-medium">Price:</span> {listing.price} YRT per part</div>
                {#if listing.type === "BUNDLE"}
                  <div><span class="font-medium">Type:</span> <span class="font-bold text-blue-600">BUNDLE SALE</span></div>
                {/if}
                {#if rawListing?.time_created}
                  <div><span class="font-medium">Created:</span> {new Date(rawListing.time_created).toLocaleDateString()}</div>
                {/if}
                {#if !showActive}
                  <div><span class="font-medium">Status:</span> {rawListing?.buyTransaction ? "BOUGHT" : rawListing?.cancelTransaction ? "CANCELLED" : ""}</div>
                {/if}
              </div>
            </div>

            <!-- Action Buttons -->
            <div class="flex items-start">
              {#if showActive}
                <div class="flex flex-col space-y-2">
                  <button
                    class="bg-blue-600 text-white px-3 py-2 text-sm hover:bg-blue-700 whitespace-nowrap"
                    on:click={() => viewListing(listing._id)}
                  >
                    View
                  </button>
                  <button
                    class="bg-red-600 text-white px-3 py-2 text-sm hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                    disabled={processing}
                    on:click={() => openSessionPassword(listing._id)}
                  >
                    {processing && showSessionPasswordFor?.id === listing._id ? "Processing..." : "Delete"}
                  </button>
                </div>
              {:else}
                {@const txHash = getTxHash(rawListing)}
                {@const txId = getTxId(rawListing)}
                {@const arweaveTxId = getArweaveTxId(rawListing)}
                {#if txHash}
                  {@const isCopied = copiedTxId === txId}
                  <div class="flex flex-col gap-2">
                    <button
                      class="text-white px-3 py-2 text-sm sm:text-base whitespace-nowrap transition-colors {isCopied ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-600 hover:bg-gray-700'}"
                      on:click={() => copyTxHash(txId || "", txHash)}
                      title={isCopied ? "Copied!" : "Copy transaction hash"}
                    >
                      {#if isCopied}
                        <span class="hidden sm:inline">Copied!</span>
                        <span class="sm:hidden">✓</span>
                      {:else}
                        <span class="hidden sm:inline">Copy Tx Hash</span>
                        <span class="sm:hidden">Copy</span>
                      {/if}
                    </button>
                    {#if arweaveTxId}
                      <button
                        on:click={() => openInArweave(arweaveTxId)}
                        class="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 text-sm sm:text-base whitespace-nowrap transition flex items-center justify-center gap-1"
                        title="Open in Arweave explorer"
                      >
                        <span class="hidden sm:inline">Open in Arweave</span>
                        <span class="sm:hidden">Arweave</span>
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
                        </svg>
                      </button>
                    {/if}
                  </div>
                {/if}
              {/if}
            </div>
          </div>
        </div>
      {/each}
    </div>

    <!-- Pagination -->
    {#if totalPages > 1}
      <div class="mt-6 flex justify-center items-center gap-4">
        <button
          on:click={() => loadListings(currentPage - 1, showActive)}
          disabled={currentPage === 0 || loading}
          class="px-4 py-2 bg-gray-600 text-white disabled:bg-gray-400 disabled:cursor-not-allowed hover:bg-gray-700"
        >
          Previous
        </button>
        
        <span class="text-sm text-gray-600">
          Page {currentPage + 1} of {totalPages} ({totalListings} total)
        </span>
        
        <button
          on:click={() => loadListings(currentPage + 1, showActive)}
          disabled={currentPage >= totalPages - 1 || loading}
          class="px-4 py-2 bg-gray-600 text-white disabled:bg-gray-400 disabled:cursor-not-allowed hover:bg-gray-700"
        >
          Next
        </button>
      </div>
    {/if}
  {/if}

  {#if showSessionPasswordFor}
    <SessionPasswordInput
      label="Enter your session password to delete this listing."
      error={actionError}
      success=""
      loading={processing}
      confirmText="Confirm"
      on:confirm={confirmDeleteSessionPassword}
      on:error={(e) => { actionError = e.detail.message; }}
    >
      <div slot="actions" class="flex space-x-4 mt-2">
        <button
          class="bg-gray-400 px-4 py-2 flex-grow"
          on:click={cancelSessionPassword}
        >
          Cancel
        </button>
      </div>
    </SessionPasswordInput>
  {/if}
</div>

<SuccessPopup 
  message={successMessage} 
  bind:visible={showSuccessPopup}
  on:close={handleSuccessPopupClose}
/>
