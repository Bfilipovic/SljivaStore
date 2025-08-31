<script lang="ts">
  import { page } from "$app/stores";
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { walletAddress } from "$lib/stores/wallet";
  import { get } from "svelte/store";
  import { NFT, Part } from "$lib/classes";
  import { apiFetch } from "$lib/api";
  import { linkifyMarkdown } from "$lib/util";
  import { getWalletFromMnemonic, signedFetch } from "$lib/walletActions";
  import MnemonicInput from "$lib/MnemonicInput.svelte";

  type Listing = {
    _id: string;
    price: string;
    nftId: string;
    seller: string;
    parts: string[];
  };

  let nftId = "";
  let nft: NFT | null = null;
  let parts: Part[] = [];
  let ownedParts: Part[] = [];
  let listings: Listing[] = [];

  let loading = true;
  let error = "";
  let address = "";

  let showMnemonicFor: string | null = null;
  let actionError = "";
  let actionSuccess = "";

  // accordion control
  let openSection: "info" | "parts" | null = null;

  $: nftId = $page.params.id;

  onMount(async () => {
    try {
      const addr = get(walletAddress);
      if (!addr) {
        goto("/login");
        return;
      }
      address = addr.toLowerCase();

      const [nftRes, partsRes, listRes] = await Promise.all([
        apiFetch(`/nfts/${nftId}`),
        apiFetch(`/nfts/${nftId}/parts`),
        apiFetch(`/nfts/listings`),
      ]);

      if (!nftRes.ok) throw new Error("Failed to fetch NFT details");
      nft = new NFT(await nftRes.json());

      parts = (await partsRes.json()).map((p: any) => new Part(p));
      ownedParts = parts.filter((p) => p.owner.toLowerCase() === address);

      if (!listRes.ok) throw new Error("Failed to fetch listings");
      const allListings = await listRes.json();
      listings = allListings.filter(
        (l) => l.seller === address && l.nftId === nftId && l.parts.length > 0,
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
      const wallet = getWalletFromMnemonic(mnemonic);

      if (wallet.address.toLowerCase() !== address) {
        actionError = "Mnemonic does not match logged-in wallet";
        return;
      }

      const res = await signedFetch(
        `/nfts/listings/${showMnemonicFor}`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ seller: address }),
        },
        wallet,
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
        class="w-full max-w-3xl mx-auto"
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

      <!-- Your Parts -->
      {#if ownedParts.length > 0}
        <div>
          <button
            class="w-full text-left font-semibold bg-gray-200 px-3 py-2"
            on:click={() =>
              (openSection = openSection === "parts" ? null : "parts")}
          >
            Your Parts ({ownedParts.length})
          </button>
          {#if openSection === "parts"}
            <div
              class="p-3 bg-gray-50 text-sm text-gray-700 max-h-40 overflow-y-auto"
            >
              <ul class="list-disc list-inside">
                {#each ownedParts as part}
                  <li>
                    <a
                      href={`/part/${part._id}`}
                      class="font-mono underline text-blue-700 hover:text-blue-900 break-all"
                    >
                      {shortHash(part._id)}
                    </a>
                  </li>
                {/each}
              </ul>
            </div>
          {/if}
        </div>
      {/if}
    </div>

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
                  <p><strong>Quantity:</strong> {listing.parts.length}</p>
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
                  <p><strong>Quantity:</strong> {listing.parts.length}</p>
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
</div>

