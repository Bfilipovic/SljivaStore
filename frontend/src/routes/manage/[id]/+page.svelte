<script lang="ts">
  import { page } from "$app/stores";
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { wallet } from "$lib/stores/wallet";
  import { get } from "svelte/store";
  import { NFT } from "$lib/classes";
  import { apiFetch } from "$lib/api";
  import { linkifyMarkdown } from "$lib/util";
  import { mnemonicMatchesLoggedInWallet, signedFetch } from "$lib/walletActions";
  import MnemonicInput from "$lib/MnemonicInput.svelte";

  type Listing = {
    _id: string;
    price: string;
    nftId: string;
    seller: string;
    quantity: number;
  };

  let nftId = "";
  let nft: NFT | null = null;
  let owned: number = 0;
  let available: number = 0;
  let listings: Listing[] = [];

  let loading = true;
  let error = "";
  let address = "";

  let showMnemonicFor: string | null = null;
  let actionError = "";
  let actionSuccess = "";

  // accordion control
  let openSection: "info" | null = null;

  $: nftId = $page.params.id;

  onMount(async () => {
    try {
      const addr = get(wallet).ethAddress;
      if (!addr) {
        goto("/login");
        return;
      }
      address = addr.toLowerCase();

      const [nftRes, listRes] = await Promise.all([
        apiFetch(`/nfts/owner/${address}`),
        apiFetch(`/listings`),
      ]);

      if (!nftRes.ok) throw new Error("Failed to fetch ownership info");
      const nftData = await nftRes.json();
      console.log("[MANAGE] /nfts/owner response:", nftData);
      const record = nftData.find((n: any) => n._id === nftId);
      if (!record) throw new Error("NFT not found in owner data");

      nft = new NFT(record);
      owned = record.owned;
      available = record.available;

      if (!listRes.ok) throw new Error("Failed to fetch listings");
      const allListings = await listRes.json();
      listings = allListings.filter(
        (l) => l.seller === address && l.nftId === nftId && l.quantity > 0,
      );
    } catch (e: any) {
      error = e.message;
    } finally {
      loading = false;
    }
  });

  function shortHash(hash: string) {
    return hash.slice(0, 6) + "..." + hash.slice(-4);
  }

  function sellParts(nftId: string) {
    goto(`/createListing/${nftId}`);
  }

  function giftParts(nftId: string) {
    goto(`/createGift/${nftId}`);
  }

  function viewParts(nftId: string) {
    goto(`/partviewer/nft/${nftId}`);
  }

  function openDeleteConfirm(listingId: string) {
    actionError = "";
    actionSuccess = "";
    showMnemonicFor = listingId;
  }

  function cancelDelete() {
    showMnemonicFor = null;
    actionError = "";
    actionSuccess = "";
  }

  async function confirmDeleteMnemonic(e) {
    const words = e.detail.words;
    if (words.some((w) => w.trim() === "")) {
      actionError = "Please enter all 12 words";
      return;
    }
    try {
      const mnemonic = words.join(" ").trim();
      if (!mnemonicMatchesLoggedInWallet(mnemonic)) {
        actionError = "Mnemonic does not match the logged-in wallet";
        return;
      }

      const res = await signedFetch(
        `/listings/${showMnemonicFor}`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ seller: address }),
        },
        mnemonic,
      );

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "Failed to delete listing");
      }

      actionSuccess = "Listing deleted successfully";
      setTimeout(() => window.location.reload(), 1000);
      showMnemonicFor = null;
    } catch (e: any) {
      actionError = e.message || "Error deleting listing";
    }
  }
</script>

<div class="max-w-4xl mx-auto p-4 space-y-6">
  {#if loading}
    <p class="text-center">Loading NFT details...</p>
  {:else if error}
    <p class="text-center text-red-600">{error}</p>
  {:else if nft}
    <!-- NFT main info -->
    <div class="text-center space-y-3">
      <img
        src={nft.imageurl}
        alt={nft.name}
        class="w-full max-w-3xl mx-auto aspect-square"
      />
      <h2 class="text-2xl font-bold">{nft.name}</h2>
      <p class="text-gray-800">
        {@html linkifyMarkdown(nft.description)}
      </p>
    </div>

    <!-- Accordion sections -->
    <div class="space-y-2">
      <!-- Additional Info -->
      <div>
        <button
          class="w-full text-left font-semibold bg-gray-200 px-3 py-2"
          on:click={() =>
            (openSection = openSection === "info" ? null : "info")}
        >
          Additional Info
        </button>
        {#if openSection === "info"}
          <div class="p-3 bg-gray-50 text-sm text-gray-700">
            <p>ID: {nft._id}</p>
            <p>Creator: {nft.creator}</p>
            <p>Parts: {nft.part_count}</p>
          </div>
        {/if}
      </div>

    </div>

    {#if owned > 0}
    <!-- Action buttons -->
    <div
      class="flex flex-col sm:flex-row sm:justify-center sm:space-x-6 space-y-4 sm:space-y-0"
    >
      <button
        on:click={() => giftParts(nftId)}
        class="bg-red-600 hover:bg-red-700 text-white w-full sm:w-64 h-16 text-xl font-bold"
      >
        🎁 Gift
      </button>
      <button
        on:click={() => sellParts(nftId)}
        class="bg-gray-600 hover:bg-gray-700 text-white w-full sm:w-64 h-16 text-xl font-bold"
      >
        💰 Sell
      </button>
      <button
        on:click={() => viewParts(nftId)}
        class="bg-yellow-600 hover:bg-yellow-700 text-white w-full sm:w-64 h-16 text-xl font-bold"
      >
        🔎 View Parts
      </button>
     

    </div>

    <!-- Listings -->
    <h3 class="text-xl font-bold mb-4">My Listings for this NFT</h3>
    {#if listings.length === 0}
      <p>You have no active listings for this NFT.</p>
    {:else}
      <div class="space-y-4">
        {#each listings as listing}
          <div class="border p-4">
            <!-- Desktop layout (sm and up) -->
            <div class="hidden sm:flex sm:items-start sm:justify-between">
              <!-- Left: thumbnail + info -->
              <div class="flex items-start space-x-4">
                <img
                  src={nft.imageurl}
                  alt="NFT"
                  class="w-16 h-16 object-cover"
                />
                <div>
                  <p><strong>Price:</strong> {listing.price} YRT</p>
                  <p><strong>Quantity:</strong> {listing.quantity}</p>
                </div>
              </div>
              <!-- Right: buttons stacked vertically -->
              <div class="flex flex-col space-y-2">
                <a
                  class="bg-blue-600 text-white px-3 py-1 hover:bg-blue-700 text-center"
                  href={`/listing/${listing._id}`}
                >
                  View listing
                </a>
                <button
                  class="bg-red-600 text-white px-3 py-1 hover:bg-red-700"
                  on:click={() => openDeleteConfirm(listing._id)}
                >
                  Delete
                </button>
              </div>
            </div>

            <!-- Mobile layout (below sm) -->
            <div class="flex flex-col space-y-3 sm:hidden">
              <!-- Row: thumbnail + info -->
              <div class="flex items-center space-x-3">
                <img
                  src={nft.imageurl}
                  alt="NFT"
                  class="w-16 h-16 object-cover"
                />
                <div>
                  <p><strong>Price:</strong> {listing.price} YRT</p>
                  <p><strong>Quantity:</strong> {listing.quantity}</p>
                </div>
              </div>
              <!-- Row: buttons stacked -->
              <div class="flex flex-col space-y-2">
                <a
                  class="bg-blue-600 text-white px-3 py-2 hover:bg-blue-700 text-center"
                  href={`/listing/${listing._id}`}
                >
                  View listing
                </a>
                <button
                  class="bg-red-600 text-white px-3 py-2 hover:bg-red-700"
                  on:click={() => openDeleteConfirm(listing._id)}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  {/if}

  {#if showMnemonicFor}
    <MnemonicInput
      label="Enter your 12-word mnemonic to confirm deletion:"
      error={actionError}
      success={actionSuccess}
      confirmText="Confirm Delete"
      on:confirm={confirmDeleteMnemonic}
    >
      <div slot="actions" class="flex space-x-4 mt-2">
        <button
          class="bg-gray-400 px-4 py-2 flex-grow"
          on:click={cancelDelete}>Cancel</button>
      </div>
    </MnemonicInput>
  {/if}
    {/if}
</div>

