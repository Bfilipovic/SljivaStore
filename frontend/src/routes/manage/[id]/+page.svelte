<script lang="ts">
  import { page } from "$app/stores";
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { wallet } from "$lib/stores/wallet";
  import { get } from "svelte/store";
  import { NFT } from "$lib/classes";
  import { apiFetch } from "$lib/api";
  import { linkifyMarkdown } from "$lib/util";
  import { isSessionActive, signedFetch } from "$lib/walletActions";
  import SessionPasswordInput from "$lib/SessionPasswordInput.svelte";
  import SuccessPopup from "$lib/SuccessPopup.svelte";
  import { GIFT_STATUS } from "$lib/statusConstants";
  import { normalizeAddress } from "$lib/utils/addressUtils";

  type Listing = {
    _id: string;
    price: string;
    nftId: string;
    seller: string;
    quantity: number;
  };

  type Gift = {
    _id: string;
    nftId: string;
    giver: string;
    receiver: string;
    quantity: number;
    status: string;
    createdAt: string;
  };

  let nftId = "";
  let nft: NFT | null = null;
  let owned: number = 0;
  let available: number = 0;
  let listings: Listing[] = [];
  let gifts: Gift[] = [];

  let loading = true;
  let error = "";
  let address = "";

  let showSessionPasswordFor: string | null = null;
  let sessionPasswordAction: "delete" | "cancelGift" = "delete";
  let actionError = "";
  let successMessage = "";
  let showSuccessPopup = false;
  let processing = false;

  // accordion control
  let openSection: "info" | null = null;

  $: nftId = $page.params.id || "";

  onMount(async () => {
    try {
      const addr = get(wallet).ethAddress;
      if (!addr) {
        goto("/login");
        return;
      }
      address = normalizeAddress(addr) || "";

      const [nftRes, listRes, giftsRes] = await Promise.all([
        apiFetch(`/nfts/owner/${address}`),
        apiFetch(`/listings`),
        apiFetch(`/gifts/created/${address}`),
      ]);

      if (!nftRes.ok) throw new Error("Failed to fetch ownership info");
      const nftData = await nftRes.json();
      const record = nftData.find((n: any) => n._id === nftId);
      if (!record) throw new Error("NFT not found in owner data");

      nft = new NFT(record);
      owned = record.owned;
      available = record.available;

      if (!listRes.ok) throw new Error("Failed to fetch listings");
      const listData = await listRes.json();
      // Handle both old array format and new paginated format
      const allListings = Array.isArray(listData) ? listData : (listData.items || []);
      listings = allListings.filter(
        (l: any) => l.seller === address && l.nftId === nftId && l.quantity > 0,
      );

      if (!giftsRes.ok) throw new Error("Failed to fetch gifts");
      const giftsData = await giftsRes.json();
      gifts = (giftsData.gifts || []).filter(
        (g: any) => g.nftId === nftId && g.status === GIFT_STATUS.ACTIVE,
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
    goto(`/partviewer/nft/${nftId}?owner=${encodeURIComponent(address)}`);
  }

  function openDeleteConfirm(listingId: string) {
    if (processing) return; // Prevent opening if already processing
    if (!isSessionActive()) {
      actionError = "No active session. Please log in again.";
      return;
    }
    actionError = "";
    successMessage = "";
    showSuccessPopup = false;
    sessionPasswordAction = "delete";
    showSessionPasswordFor = listingId;
  }

  function openCancelGiftConfirm(giftId: string) {
    if (processing) return; // Prevent opening if already processing
    if (!isSessionActive()) {
      actionError = "No active session. Please log in again.";
      return;
    }
    actionError = "";
    successMessage = "";
    showSuccessPopup = false;
    sessionPasswordAction = "cancelGift";
    showSessionPasswordFor = giftId;
  }

  function cancelDelete() {
    if (processing) return; // Prevent canceling if processing
    showSessionPasswordFor = null;
    sessionPasswordAction = "delete";
    actionError = "";
    successMessage = "";
    showSuccessPopup = false;
  }

  async function confirmDeleteSessionPassword(e: CustomEvent<{ password: string }>) {
    if (processing) return; // Prevent multiple submissions
    processing = true;
    
    const sessionPassword = e.detail.password;

    try {
      if (!isSessionActive()) {
        actionError = "No active session. Please log in again.";
        processing = false;
        return;
      }

      if (sessionPasswordAction === "delete") {
        // Delete listing
        const res = await signedFetch(
          `/listings/${showSessionPasswordFor}`,
          {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ seller: address }),
          },
          sessionPassword,
        );

        if (!res.ok) {
          const errJson = await res.json().catch(() => ({}));
          throw new Error(errJson.error || "Failed to delete listing");
        }

        successMessage = "Listing deleted successfully";
      } else if (sessionPasswordAction === "cancelGift") {
        // Cancel gift
        const res = await signedFetch(
          `/gifts/cancel`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ giftId: showSessionPasswordFor }),
          },
          sessionPassword,
        );

        if (!res.ok) {
          const errJson = await res.json().catch(() => ({}));
          throw new Error(errJson.error || "Failed to cancel gift");
        }

        successMessage = "Gift cancelled successfully";
      }

      showSessionPasswordFor = null;
      actionError = "";
      
      // Show success popup, then reload after it closes
      showSuccessPopup = true;
    } catch (e: any) {
      actionError = e.message || "Error processing action";
      processing = false;
    }
  }
  
  async function handleSuccessPopupClose() {
    showSuccessPopup = false;
    successMessage = "";
    // Refresh owner data to get updated available count before reload
    try {
      const nftRes = await apiFetch(`/nfts/owner/${address}`);
      if (nftRes.ok) {
        const nftData = await nftRes.json();
        const record = nftData.find((n: any) => n._id === nftId);
        if (record) {
          owned = record.owned;
          available = record.available;
        }
      }
    } catch (e) {
      // Ignore errors, just reload
    }
    // Reload page after popup closes
    window.location.reload();
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
                  class="bg-red-600 text-white px-3 py-1 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={processing}
                  on:click={() => openDeleteConfirm(listing._id)}
                >
                  {processing && showSessionPasswordFor === listing._id ? "Processing..." : "Delete"}
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
                  class="bg-red-600 text-white px-3 py-2 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={processing}
                  on:click={() => openDeleteConfirm(listing._id)}
                >
                  {processing && showSessionPasswordFor === listing._id ? "Processing..." : "Delete"}
                </button>
              </div>
            </div>
          </div>
        {/each}
      </div>
    {/if}

    <!-- Gifts -->
    <h3 class="text-xl font-bold mb-4 mt-8">My Pending Gifts for this NFT</h3>
    {#if gifts.length === 0}
      <p>You have no pending gifts for this NFT.</p>
    {:else}
      <div class="space-y-4">
        {#each gifts as gift}
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
                  <p><strong>To:</strong> {gift.receiver.substring(0, 10)}...{gift.receiver.substring(gift.receiver.length - 8)}</p>
                  <p><strong>Quantity:</strong> {gift.quantity}</p>
                  <p class="text-sm text-gray-600">Created: {new Date(gift.createdAt).toLocaleString()}</p>
                </div>
              </div>
              <!-- Right: button -->
              <div class="flex flex-col space-y-2">
                <button
                  class="bg-red-600 text-white px-3 py-1 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={processing}
                  on:click={() => openCancelGiftConfirm(gift._id)}
                >
                  {processing && showSessionPasswordFor === gift._id ? "Processing..." : "Cancel Gift"}
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
                  <p><strong>To:</strong> {gift.receiver.substring(0, 10)}...{gift.receiver.substring(gift.receiver.length - 8)}</p>
                  <p><strong>Quantity:</strong> {gift.quantity}</p>
                  <p class="text-sm text-gray-600">Created: {new Date(gift.createdAt).toLocaleString()}</p>
                </div>
              </div>
              <!-- Row: button -->
              <div class="flex flex-col space-y-2">
                <button
                  class="bg-red-600 text-white px-3 py-2 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={processing}
                  on:click={() => openCancelGiftConfirm(gift._id)}
                >
                  {processing && showSessionPasswordFor === gift._id ? "Processing..." : "Cancel Gift"}
                </button>
              </div>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  {/if}

  {#if showSessionPasswordFor}
    <SessionPasswordInput
      label={sessionPasswordAction === "delete" 
        ? "Enter your session password to confirm deletion:"
        : "Enter your session password to cancel the gift:"}
      error={actionError}
      isSetup={false}
      confirmText={sessionPasswordAction === "delete" ? "Confirm Delete" : "Confirm Cancel"}
      on:confirm={confirmDeleteSessionPassword}
      on:error={(e) => { actionError = e.detail.message; }}
    >
      <div slot="actions" class="flex space-x-4 mt-2">
        <button
          class="bg-gray-400 px-4 py-2 flex-grow"
          on:click={cancelDelete}>Cancel</button>
      </div>
    </SessionPasswordInput>
  {/if}
    {/if}
</div>

<SuccessPopup 
  message={successMessage} 
  bind:visible={showSuccessPopup}
  on:close={handleSuccessPopupClose}
/>

