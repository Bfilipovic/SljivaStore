<script lang="ts">
  import { page } from "$app/stores";
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { get } from "svelte/store";

  import { wallet } from "$lib/stores/wallet";
  import SessionPasswordInput from "$lib/SessionPasswordInput.svelte";
  import { isSessionActive } from "$lib/walletActions";
  import { apiFetch } from "$lib/api";
  import { updateUserInfo } from "$lib/userInfo";

  import {
    signedFetch,
    mnemonicMatchesLoggedInWallet,
    getCurrentTxCost, // takes currency
    payForReservation, // sends ETH or SOL
  } from "$lib/walletActions";

  // route param
  let listingId = "";
  $: listingId = $page.params.id || "";

  // data
  let listing: any = null;
  let nft: any = null;

  // buyer identity (canonical ETH)
  let buyerEthAddress = "";

  // quantity / availability
  let quantity = 1;
  let maxQuantity = 1;

  // currency selection
  let availableCurrencies: string[] = [];
  let selectedCurrency: string = "ETH";

  // reservation state
  let reservation: any = null;
  let gasCost: string | null = null;
  let buying = false;

  // ui state
  let loading = true;
  let error = "";
  let isOwner = false;

  // delete listing modal
  let showDeleteSessionPassword = false;
  let deleteError = "";
  let deleteSuccess = "";

  // buy modal + timer
  let showSessionPasswordPrompt = false;
  let sessionPasswordError = "";
  let timer: number | null = null;
  let timerInterval: any = null;
  let reservationExpiryTime: number | null = null;

  // refresh fee estimate
  $: (async () => {
    if (reservation && selectedCurrency) {
      try {
        gasCost = await getCurrentTxCost(selectedCurrency);
      } catch {
        gasCost = null;
      }
    }
  })();

  onMount(async () => {
    loading = true;
    try {
      const loggedIn = get(wallet)?.ethAddress;
      if (!loggedIn) {
        goto("/login");
        return;
      }
      buyerEthAddress = loggedIn.toLowerCase();

      // fetch listing
      const listRes = await apiFetch(`/listings`);
      if (!listRes.ok) throw new Error("Failed to fetch listings");
      const all = await listRes.json();
      listing = all.find((l: any) => l._id === listingId);
      if (!listing) throw new Error("Listing not found");

      isOwner =
        buyerEthAddress &&
        listing.seller &&
        buyerEthAddress === listing.seller.toLowerCase();

      maxQuantity = listing.quantity ?? 0;
      if (listing.type === "BUNDLE") {
        quantity = maxQuantity;
      } else {
        quantity = Math.min(quantity, maxQuantity);
      }

      // fetch NFT details
      const nftRes = await apiFetch(`/nfts/${listing.nftId}`);
      if (!nftRes.ok) throw new Error("Failed to fetch NFT");
      nft = await nftRes.json();

      // currencies from sellerWallets
      availableCurrencies = listing?.sellerWallets
        ? Object.keys(listing.sellerWallets)
        : [];
      if (availableCurrencies.length === 0) {
        throw new Error("Listing has no available currencies");
      }
      selectedCurrency = availableCurrencies[0];
    } catch (e: any) {
      error = e.message || "Failed to load listing";
    } finally {
      loading = false;
    }
  });

  function getBuyerWalletFor(currency: string): string {
    const w: any = get(wallet);
    const found = (w.addresses ?? []).find(
      (a: any) =>
        String(a.currency).toUpperCase() === String(currency).toUpperCase(),
    )?.address;
    if (found) return found;
    if (currency.toUpperCase() === "ETH" && w.ethAddress) return w.ethAddress;
    if (currency.toUpperCase() === "SOL" && w.solAddress) return w.solAddress;
    return w.ethAddress || "";
  }

  async function refreshListing() {
    try {
      const listRes = await apiFetch(`/listings`);
      if (!listRes.ok) throw new Error("Failed to fetch listings");
      const all = await listRes.json();
      const updatedListing = all.find((l: any) => l._id === listingId);
      if (updatedListing) {
        listing = updatedListing;
        maxQuantity = listing.quantity ?? 0;
        if (listing.type === "BUNDLE") {
          quantity = maxQuantity;
        } else {
          quantity = Math.min(quantity, maxQuantity);
        }
      }
    } catch (e: any) {
      console.error("Failed to refresh listing:", e);
    }
  }

  function startTimer() {
    // Reservation expires in 60 seconds
    timer = 60;
    if (reservation?.timestamp) {
      const reservationTime = new Date(reservation.timestamp).getTime();
      const expiryTime = reservationTime + 60 * 1000; // 60 seconds from reservation
      reservationExpiryTime = expiryTime;
      const now = Date.now();
      const remaining = Math.max(0, Math.floor((expiryTime - now) / 1000));
      timer = remaining;
    }
    
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(async () => {
      if (reservationExpiryTime) {
        const now = Date.now();
        const remaining = Math.max(0, Math.floor((reservationExpiryTime - now) / 1000));
        timer = remaining;
        if (remaining <= 0) {
          clearInterval(timerInterval);
          reservation = null;
          showSessionPasswordPrompt = false;
          timer = null;
          reservationExpiryTime = null;
          // Wait a moment for backend cleanup to run, then refresh listing
          await new Promise(resolve => setTimeout(resolve, 2000));
          await refreshListing();
        }
      } else {
        timer = (timer ?? 0) - 1;
        if ((timer ?? 0) <= 0) {
          clearInterval(timerInterval);
          reservation = null;
          showSessionPasswordPrompt = false;
          timer = null;
          // Wait a moment for backend cleanup to run, then refresh listing
          await new Promise(resolve => setTimeout(resolve, 2000));
          await refreshListing();
        }
      }
    }, 1000);
  }

  function cancelBuy() {
    showSessionPasswordPrompt = false;
    sessionPasswordError = "";
    timer = null;
    reservationExpiryTime = null;
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = null;
  }

  async function createReservation() {
    if (!listing || !maxQuantity) throw new Error("No parts available");
    if (reservation) {
      throw new Error("You already have an active reservation");
    }

    const buyerWallet = getBuyerWalletFor(selectedCurrency);

    const res = await apiFetch(`/reservations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        listingId,
        reserver: buyerEthAddress,
        quantity,
        currency: selectedCurrency,
        buyerWallet,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || "Reservation failed");
    }
    reservation = data.reservation;
    // Start timer when reservation is created
    startTimer();
  }

  async function onConfirmSessionPassword(e: CustomEvent<{ password: string }>) {
    if (buying) return;
    buying = true;

    try {
      const sessionPassword = e.detail.password;

      if (!isSessionActive()) {
        sessionPasswordError = "No active session. Please log in again.";
        return;
      }

      if (!reservation) {
        throw new Error("No active reservation");
      }

      const chainTx = await payForReservation(reservation, sessionPassword);

      const txRes = await signedFetch(
        "/transactions",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            listingId,
            reservationId: reservation._id,
            buyer: buyerEthAddress,
            timestamp: Date.now(),
            chainTx,
          }),
        },
        sessionPassword,
      );

      const txData = await txRes.json().catch(() => ({}));
      if (!txRes.ok) {
        throw new Error(txData.error || "Transaction failed");
      }

      sessionPasswordError = "";
      showSessionPasswordPrompt = false;
      reservation = null;
      timer = null;
      reservationExpiryTime = null;
      if (timerInterval) clearInterval(timerInterval);
      timerInterval = null;

      // Update user info for buyer (gift count, balances)
      await updateUserInfo(buyerEthAddress, true);
      // Navigate to selling page which will refresh owner data
      goto("/selling");
    } catch (e: any) {
      sessionPasswordError = e.message || "Payment failed";
    } finally {
      buying = false;
    }
  }

  // Delete listing (owner)
  function openDeleteConfirm() {
    showDeleteSessionPassword = true;
    deleteError = "";
    deleteSuccess = "";
  }

  async function confirmDeleteSessionPassword(e: CustomEvent<{ password: string }>) {
    const sessionPassword = e.detail.password;
    try {
      if (!isSessionActive()) {
        deleteError = "No active session. Please log in again.";
        return;
      }

      const res = await signedFetch(
        `/listings/${listingId}`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ seller: buyerEthAddress }),
        },
        sessionPassword,
      );

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "Failed to delete listing");
      }

      deleteSuccess = "Listing deleted successfully";
      showDeleteSessionPassword = false;
      setTimeout(() => goto("/selling"), 1000);
    } catch (e: any) {
      deleteError = e.message || "Error deleting listing";
    }
  }
</script>

<div class="max-w-4xl mx-auto p-4 space-y-6">
  <h1 class="text-2xl font-bold text-center">Listing Details</h1>

  {#if loading}
    <p class="text-center">Loading…</p>
  {:else if error}
    <p class="text-center text-red-600">{error}</p>
  {:else if listing && nft}
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <!-- NFT -->
      <div>
        {#if nft.imageurl}
          <img src={nft.imageurl} alt={nft.name} class="w-full aspect-square" />
        {/if}
        <h2 class="text-xl font-semibold mt-3">{nft.name}</h2>
        <p class="text-sm text-gray-700">{nft.description}</p>
      </div>

      <!-- Purchase panel -->
      <div class="border p-4 space-y-4">
        <div>
          <div>
            <span class="font-semibold">Price per part:</span>
            {listing.price} YRT
          </div>
          <div>
            <span class="font-semibold">Available parts:</span>
            {listing.quantity}
            {#if listing.type === "BUNDLE"}
              <span class="ml-2 text-xs px-2 py-1 border">BUNDLE</span>
            {/if}
          </div>

          <a
            class="mt-2 inline-block bg-yellow-600 text-white px-3 py-1"
            href={`/partviewer/listing/${listingId}`}
          >
            Open in Part Viewer
          </a>

          <!-- Currency selector -->
          <div class="mt-3">
            <label for="currency-select" class="block text-sm mb-1">Pay with</label>
            <select
              id="currency-select"
              class="border p-2 w-full"
              bind:value={selectedCurrency}
              on:change={() => {
                reservation = null;
                gasCost = null;
              }}
            >
              {#each availableCurrencies as c}
                <option value={c}>{c}</option>
              {/each}
            </select>
          </div>
        </div>

        {#if listing.type !== "BUNDLE"}
          <div>
            <label for="quantity-input" class="block text-sm mb-1">Quantity</label>
            <input
              id="quantity-input"
              type="number"
              class="border p-2 w-full"
              min="1"
              max={maxQuantity}
              bind:value={quantity}
            />
          </div>
        {/if}

        <!-- Reservation summary -->
        <div class="space-y-2">
          {#if reservation}
            <div class="text-sm border p-2 bg-yellow-50">
              <div>
                <span class="font-semibold">Reserved:</span>
                {reservation.quantity} part(s)
              </div>
              <div>
                <span class="font-semibold">Total (crypto):</span>
                {reservation.totalPriceCrypto?.amount}
                {reservation.totalPriceCrypto?.currency}
              </div>
              {#if gasCost}
                <div class="text-gray-700">
                  <span class="font-semibold">Estimated network fee:</span>
                  ~{gasCost}
                  {selectedCurrency}
                </div>
              {/if}
              {#if timer !== null}
                <div class="text-red-600 font-semibold mt-2">
                  Reservation expires in: {timer}s
                </div>
              {/if}
            </div>
          {/if}
        </div>

        <!-- Actions -->
        <div class="flex gap-3">
          {#if !isOwner}
            <button
              class="bg-gray-700 text-white px-4 py-2 flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
              class:bg-gray-400={!!reservation}
              on:click={async () => {
                if (reservation) return; // Prevent clicking when reservation exists
                try {
                  await createReservation();
                  showSessionPasswordPrompt = true;
                } catch (e: any) {
                  error = e.message || "Reservation failed";
                }
              }}
              disabled={buying || !!reservation}
            >
              {buying ? "Processing..." : reservation ? "Reserved" : "Buy"}
            </button>
          {/if}

          {#if isOwner}
            <button
              class="bg-red-600 text-white px-4 py-2"
              on:click={openDeleteConfirm}
            >
              Delete listing
            </button>
          {/if}
        </div>
      </div>
    </div>

    <!-- Session password modal for BUY (with timer) -->
    {#if showSessionPasswordPrompt && reservation}
      <div class="max-w-md mx-auto">
        <SessionPasswordInput
          label={`Enter your session password to confirm payment. ${reservation?.totalPriceCrypto?.amount ?? ""} ${reservation?.totalPriceCrypto?.currency ?? ""} + ${gasCost ?? "network fee"}. Time remaining: ${timer ?? 0}s`}
          error={sessionPasswordError}
          confirmText="Confirm Payment"
          on:confirm={onConfirmSessionPassword}
          loading={buying}
        >
          <div slot="actions" class="flex space-x-4 mt-2">
            <button
              class="bg-gray-400 px-4 py-2 flex-grow"
              on:click={cancelBuy}
            >
              Cancel
            </button>
          </div>
        </SessionPasswordInput>
      </div>
    {/if}

    <!-- Session password modal for DELETE -->
    {#if showDeleteSessionPassword}
      <div class="max-w-md mx-auto">
        <SessionPasswordInput
          label="Enter your session password to delete this listing:"
          error={deleteError}
          success={deleteSuccess}
          confirmText="Confirm"
          on:confirm={confirmDeleteSessionPassword}
        >
          <div slot="actions" class="flex space-x-4 mt-2">
            <button
              class="bg-gray-400 px-4 py-2 flex-grow"
              on:click={() => (showDeleteSessionPassword = false)}
            >
              Cancel
            </button>
          </div>
        </SessionPasswordInput>
        {#if deleteSuccess}
          <p class="text-green-600 mt-2">{deleteSuccess}</p>
        {/if}
      </div>
    {/if}
  {/if}
</div>
