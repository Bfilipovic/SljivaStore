<script lang="ts">
  import { page } from "$app/stores";
  import { onMount } from "svelte";
  import { walletAddress } from "$lib/stores/wallet";
  import { get } from "svelte/store";
  import { goto } from "$app/navigation";
  import MnemonicInput from "$lib/MnemonicInput.svelte";
  import {
    getWalletFromMnemonic,
    signedFetch,
    createETHTransaction,
    mnemonicMatchesLoggedInWallet,
  } from "$lib/walletActions";
  import { apiFetch } from "$lib/api";
  import { updateUserInfo } from "$lib/userInfo";
  import { getCurrentTxCost } from "$lib/walletActions";

  let listingId = "";
  let listing: any = null;
  let nft: any = null;
  let parts: any[] = [];
  let error = "";
  let loading = true;
  let address = "";
  let isOwner = false;
  let quantity = 1;
  let maxQuantity = 1;
  let showMnemonicPrompt = false;
  let mnemonicError = "";
  let reservation: any = null;
  let reservationError = "";
  let timer = 180;
  let timerInterval: any = null;

  let showDeleteMnemonic = false;
  let deleteError = "";
  let deleteSuccess = "";

  let buying = false;

  // accordion control
  let openSection: "info" | "parts" | null = null;
  let gasCost: string | null = null;

  let tooltipOpen = false; // for bundle info icon

  $: listingId = $page.params.id;

  $: (async () => {
    if (reservation && reservation.parts?.length > 0) {
      gasCost = await getCurrentTxCost();
    }
  })();

  onMount(async () => {
    if (!$walletAddress) goto("/login");
    loading = true;
    try {
      const addr = get(walletAddress);
      address = addr ? addr.toLowerCase() : "";
      const res = await apiFetch(`/listings`);
      const all = await res.json();
      listing = all.find((l: any) => l._id === listingId);
      if (!listing) throw new Error("Listing not found");
      isOwner =
        address && listing.seller && address === listing.seller.toLowerCase();
      maxQuantity = listing.parts.length;
      if (listing.type === "BUNDLE") {
        quantity = maxQuantity; // lock to full bundle
      }

      const nftRes = await apiFetch(`/nfts/${listing.nftId}`);
      nft = await nftRes.json();

      const partRes = await apiFetch(`/nfts/${listing.nftId}/parts`);
      const allParts = await partRes.json();
      parts = allParts.filter((p: any) => listing.parts.includes(p._id));
    } catch (e: any) {
      error = e.message || "Failed to load listing";
    } finally {
      loading = false;
    }
  });

  async function handleBuyClick() {
    if (listing.type !== "BUNDLE") {
      if (quantity < 1 || quantity > maxQuantity) {
        reservationError = `Select a quantity between 1 and ${maxQuantity}`;
        return;
      }
    }
    try {
      const res = await apiFetch("/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listingId,
          reserver: address,
          parts:
            listing.type === "BUNDLE"
              ? listing.parts // all parts reserved
              : listing.parts.slice(0, quantity),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Reservation failed");
      reservation = data.reservation;
      showMnemonicPrompt = true;
      reservationError = "";
      startTimer();
    } catch (e: any) {
      reservationError = e.message || "Reservation failed";
    }
  }

  function startTimer() {
    timer = 180;
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      timer--;
      if (timer <= 0) {
        clearInterval(timerInterval);
        window.location.reload();
      }
    }, 1000);
  }

  async function confirmBuyMnemonic(e: any) {
    if (buying) return;
    buying = true;
    const words = e.detail.words;

    try {
      if (words.some((w: string) => w.trim() === "")) {
        mnemonicError = "Please enter all 12 words";
        return;
      }
      if (!reservation || !reservation._id) {
        mnemonicError = "No active reservation. Please try again.";
        return;
      }
      const mnemonic = words.join(" ").trim();

      if (!mnemonicMatchesLoggedInWallet(mnemonic)) {
        error = "Mnemonic does not match the logged-in wallet";
        return;
      }

      const seller = listing.seller;
      const totalPriceEth = reservation.totalPriceEth;
      if (!seller || !totalPriceEth) {
        mnemonicError = "Missing listing info";
        return;
      }

      const amountToPay = Number(totalPriceEth).toFixed(18);

      const chainTx = await createETHTransaction(seller, amountToPay, mnemonic);
      if (!chainTx) {
        mnemonicError = "Failed to send ETH transaction";
        return;
      }

      const res = await signedFetch(
        "/transactions",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            listingId,
            reservationId: reservation._id,
            buyer: address,
            timestamp: Date.now(),
            chainTx,
          }),
        },
        mnemonic,
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Transaction failed");

      mnemonicError = "";
      goto("/selling");
    } catch (e: any) {
      mnemonicError = e.message || "Transaction failed";
    } finally {
      updateUserInfo(address, true);
      buying = false;
    }
  }

  async function confirmDeleteMnemonic(e: any) {
    const words = e.detail.words;
    if (words.some((w: string) => w.trim() === "")) {
      deleteError = "Please enter all 12 words";
      return;
    }
    try {
      const mnemonic = words.join(" ").trim();

      if (!mnemonicMatchesLoggedInWallet(mnemonic)) {
        deleteError = "Mnemonic does not match the logged-in wallet";
        return;
      }

      const res = await signedFetch(
        `/listings/${listingId}`,
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

      deleteSuccess = "Listing deleted successfully";
      setTimeout(() => goto("/selling"), 1000);
    } catch (e: any) {
      deleteError = e.message || "Error deleting listing";
    }
  }

  function openDeleteConfirm() {
    showDeleteMnemonic = true;
    deleteError = "";
    deleteSuccess = "";
  }
</script>

<div class="max-w-4xl mx-auto p-4 space-y-6">
  <h1 class="text-2xl font-bold text-center">Listing Details</h1>

  {#if loading}
    <p class="text-center">Loading...</p>
  {:else if error}
    <p class="text-center text-red-600">{error}</p>
  {:else if listing && nft}
    <!-- NFT main info -->
    <div class="text-center space-y-3">
      <img src={nft.imageurl} alt={nft.name} class="w-full max-w-3xl mx-auto aspect-square" />
      <h2 class="text-2xl font-bold">{nft.name}</h2>
      <p>{nft.description}</p>
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
            <p><strong>ID:</strong> {nft._id}</p>
            <p><strong>Creator:</strong> {nft.creator}</p>
            <p><strong>Total parts:</strong> {nft.part_count}</p>
          </div>
        {/if}
      </div>

      <!-- Parts List -->
      <div>
        <button
          class="w-full text-left font-semibold bg-gray-200 px-3 py-2"
          on:click={() =>
            (openSection = openSection === "parts" ? null : "parts")}
        >
          Listed Parts ({listing.parts.length})
        </button>
        {#if openSection === "parts"}
          <div
            class="p-3 bg-gray-50 text-sm text-gray-700 max-h-48 overflow-y-auto"
          >
            <ul class="list-disc list-inside">
              {#each parts as part}
                <li>
                  <a
                    href={`/part/${part._id}`}
                    class="font-mono underline text-blue-700 hover:text-blue-900 break-all"
                  >
                    {part._id}
                  </a>
                </li>
              {/each}
            </ul>
          </div>
        {/if}
      </div>
    </div>

    <!-- Price info -->
    <div class="text-center mt-6 space-y-2">
      <p class="text-lg">
        <strong>Price per part:</strong> {listing.price} YRT
      </p>

      {#if listing.type === "BUNDLE"}
        <p class="flex justify-center items-center text-lg">
          <strong>Quantity:</strong>&nbsp;{listing.parts.length}
          <span
            class="ml-2 text-gray-600 cursor-pointer relative"
            on:mouseenter={() => (tooltipOpen = true)}
            on:mouseleave={() => (tooltipOpen = false)}
            on:click={() => (tooltipOpen = !tooltipOpen)}
          >
            ⓘ
            {#if tooltipOpen}
              <span
                class="absolute left-5 top-0 bg-black text-white text-xs p-2 w-56 z-10"
              >
                This is a bundle sale. Buyer must purchase all listed parts
                together.
              </span>
            {/if}
          </span>
        </p>
      {/if}
    </div>

    <!-- Actions -->
    {#if isOwner}
      {#if !showDeleteMnemonic}
        <div class="flex justify-center mt-6">
          <button
            class="bg-red-600 text-white px-6 py-3 hover:bg-red-700 w-full sm:w-64 text-lg font-bold"
            on:click={openDeleteConfirm}
          >
            Delete Listing
          </button>
        </div>
      {:else}
        <div class="flex justify-center mt-6">
          <MnemonicInput
            label="Enter your 12-word mnemonic to confirm deletion:"
            error={deleteError}
            success={deleteSuccess}
            confirmText="Confirm Delete"
            on:confirm={confirmDeleteMnemonic}
          >
            <div slot="actions" class="flex space-x-4 mt-2">
              <button
                class="bg-gray-400 px-4 py-2 flex-grow"
                on:click={() => (showDeleteMnemonic = false)}
              >
                Cancel
              </button>
            </div>
          </MnemonicInput>
        </div>
      {/if}
    {:else if !showMnemonicPrompt}
      {#if listing.type === "BUNDLE"}
        <div class="mt-6 flex flex-col gap-2 max-w-xs w-full mx-auto text-center">
          <button
            class="bg-gray-600 text-white px-6 py-3 hover:bg-gray-700 w-full text-lg font-bold"
            on:click={handleBuyClick}
          >
            Buy Bundle
          </button>
          {#if reservationError}
            <p class="text-red-600">{reservationError}</p>
          {/if}
        </div>
      {:else}
        <div class="mt-6 flex flex-col gap-2 max-w-xs w-full mx-auto text-center">
          <label for="quantity">Select quantity to buy:</label>
          <input
            id="quantity"
            type="number"
            min="1"
            max={maxQuantity}
            bind:value={quantity}
            class="border px-2 py-1 text-center"
          />
          <button
            class="bg-gray-600 text-white px-6 py-3 hover:bg-gray-700 mt-2 w-full text-lg font-bold"
            on:click={handleBuyClick}
          >
            Buy
          </button>
          {#if reservationError}
            <p class="text-red-600">{reservationError}</p>
          {/if}
        </div>
      {/if}
    {:else}
      <div class="flex flex-col items-center mt-6 space-y-4">
        <div class="text-2xl font-bold">
          Buying {reservation.parts.length} part{reservation.parts.length > 1
            ? "s"
            : ""}
        </div>
        <div class="text-xl">
          Total price: ~{Number(reservation.totalPriceEth).toFixed(6)} ETH
          {#if gasCost}
            <span class="text-gray-600 text-lg"> (+{gasCost} for gas)</span>
          {/if}
        </div>
        <MnemonicInput
          label="Enter your 12-word mnemonic to confirm buying:"
          error={mnemonicError}
          confirmText="Confirm Buy"
          {timer}
          loading={buying}
          on:confirm={confirmBuyMnemonic}
        />
      </div>
    {/if}
  {/if}
</div>

