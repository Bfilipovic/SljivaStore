<script lang="ts">
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import { walletAddress } from '$lib/stores/wallet';
  import { get } from 'svelte/store';
  import { goto } from '$app/navigation';
  import MnemonicInput from '$lib/MnemonicInput.svelte';
  import { getWalletFromMnemonic, signRequest } from '$lib/walletActions';
  import { Listing, NFT, Part } from '$lib/classes';

  let listingId = '';
  let listing: Listing | null = null;
  let nft: NFT | null = null;
  let parts: Part[] = [];
  let error = '';
  let loading = true;
  let address = '';
  let isOwner = false;
  let quantity = 1;
  let maxQuantity = 1;
  let showMnemonicPrompt = false;
  let mnemonicError = '';
  let reservation = null;
  let reservationError = '';
  let timer = 180;
  let timerInterval: any = null;

  let showDeleteMnemonic = false;
  let deleteError = '';
  let deleteSuccess = '';

  $: listingId = $page.params.id;

  onMount(async () => {
    loading = true;
    try {
      const addr = get(walletAddress);
      address = addr ? addr.toLowerCase() : '';
      // Fetch the listing
      const res = await fetch(`/nfts/listings`);
      const all = await res.json();
      listing = new Listing(all.find(l => l._id === listingId));
      if (!listing) throw new Error('Listing not found');
      isOwner = address && listing.seller && address === listing.seller.toLowerCase();
      maxQuantity = listing.parts.length;
      // Fetch the NFT data
      const nftRes = await fetch(`/nfts/${listing.nftId}`);
      nft = new NFT(await nftRes.json());
      // Fetch full part info for each part in this listing
      const partRes = await fetch(`/nfts/${listing.nftId}/parts`);
      const allParts = (await partRes.json()).map((p: any) => new Part(p));
      parts = allParts.filter(p => listing.parts.includes(p._id));
    } catch (e: any) {
      error = e.message || 'Failed to load listing';
    } finally {
      loading = false;
    }
  });

  async function handleBuyClick() {
    if (quantity < 1 || quantity > maxQuantity) {
      reservationError = `Select a quantity between 1 and ${maxQuantity}`;
      return;
    }
    try {
      const partsToReserve = Array.isArray(listing?.parts) ? listing.parts.slice(0, quantity) : [];
      // Get wallet from store
      const addr = get(walletAddress);
      if (!addr) {
        reservationError = 'Wallet not found';
        return;
      }
      // Use wallet to sign the reservation request
      const wallet = getWalletFromMnemonic(window.localStorage.getItem('mnemonic') || '');
      const signedPayload = await signRequest({
        listingId,
        reserver: address,
        parts: partsToReserve
      }, wallet);
      const res = await fetch('/nfts/reserve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(signedPayload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Reservation failed');
      reservation = data.reservation;
      showMnemonicPrompt = true;
      reservationError = '';
      startTimer();
    } catch (e: any) {
      reservationError = e.message || 'Reservation failed';
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

  async function confirmBuyMnemonic(e) {
    const words = e.detail.words;
    if (words.some(w => w.trim() === '')) {
      mnemonicError = 'Please enter all 12 words';
      return;
    }
    if (!reservation || !reservation._id) {
      mnemonicError = 'No active reservation. Please try again.';
      return;
    }
    try {
      const mnemonic = words.join(' ').trim();
      const wallet = getWalletFromMnemonic(mnemonic);
      if (wallet.address.toLowerCase() !== address) {
        mnemonicError = 'Mnemonic does not match logged-in wallet';
        return;
      }
      // Sign transaction request
      const signedPayload = await signRequest({
        listingId,
        reservationId: reservation._id,
        buyer: address
      }, wallet);
      const res = await fetch('/nfts/createTransaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(signedPayload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Transaction failed');
      mnemonicError = '';
      goto('/personal');
    } catch (e: any) {
      mnemonicError = e.message || 'Transaction failed';
    }
  }

  async function confirmDeleteMnemonic(e) {
    const words = e.detail.words;
    if (words.some(w => w.trim() === '')) {
      deleteError = 'Please enter all 12 words';
      return;
    }
    try {
      const mnemonic = words.join(' ').trim();
      const wallet = getWalletFromMnemonic(mnemonic);
      if (wallet.address.toLowerCase() !== address) {
        deleteError = 'Mnemonic does not match logged-in wallet';
        return;
      }
      // Sign delete request
      const signedPayload = await signRequest({
        seller: address
      }, wallet);
      const res = await fetch(`/nfts/listings/${listingId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(signedPayload),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Failed to delete listing');
      }
      deleteSuccess = 'Listing deleted successfully';
      setTimeout(() => goto('/myListings'), 1000);
    } catch (e: any) {
      deleteError = e.message || 'Error deleting listing';
    }
  }

  function openDeleteConfirm() {
    showDeleteMnemonic = true;
    deleteError = '';
    deleteSuccess = '';
  }

  function cancelDelete() {
    showDeleteMnemonic = false;
    deleteError = '';
    deleteSuccess = '';
  }
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

      {#if isOwner}
        {#if !showDeleteMnemonic}
          <button class="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 mt-6" on:click={openDeleteConfirm}>
            Delete Listing
          </button>
        {:else}
          <MnemonicInput
            label="Enter your 12-word mnemonic to confirm deletion:"
            error={deleteError}
            success={deleteSuccess}
            confirmText="Confirm Delete"
            on:confirm={confirmDeleteMnemonic}
          >
            <div slot="actions" class="flex space-x-4 mt-2">
              <button class="bg-gray-400 px-4 py-2 rounded flex-grow" on:click={cancelDelete}>Cancel</button>
            </div>
          </MnemonicInput>
        {/if}
      {:else}
        {#if !showMnemonicPrompt}
          <div class="mt-6 flex flex-col gap-2 max-w-xs">
            <label for="quantity">Select quantity to buy:</label>
            <input id="quantity" type="number" min="1" max={maxQuantity} bind:value={quantity} class="border rounded px-2 py-1" />
            <button class="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 mt-2" on:click={handleBuyClick}>
              Buy
            </button>
            {#if reservationError}
              <p class="text-red-600">{reservationError}</p>
            {/if}
          </div>
        {:else}
          <MnemonicInput
            label="Enter your 12-word mnemonic to confirm buying:"
            error={mnemonicError}
            confirmText="Confirm Buy"
            timer={timer}
            on:confirm={confirmBuyMnemonic}
          />
        {/if}
      {/if}
    </div>
  {/if}
</div>
