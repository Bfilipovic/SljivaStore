<script lang="ts">
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import { walletAddress } from '$lib/stores/wallet';
  import { goto } from '$app/navigation';
  import { getWalletFromMnemonic, signedFetch } from '$lib/walletActions';
  import MnemonicInput from '$lib/MnemonicInput.svelte';
  import { apiFetch } from '$lib/api';
  import { page } from '$app/stores';

  type Listing = {
    _id: string;
    price: string;
    nftId: string;
    seller: string;
    parts: string[];
  };

  type NFT = {
    _id: string;
    name: string;
    imageurl: string;
  };

  let listings: Listing[] = [];
  let nfts: Record<string, NFT> = {};
  let loading = true;
  let error = '';
  let address = '';
  let showMnemonicFor: string | null = null;
  let actionError = '';
  let actionSuccess = '';

  $: nftId = $page.params.id;

  onMount(async () => {
    const addr = get(walletAddress);
    if (!addr) {
      goto('/login');
      return;
    }
    address = addr.toLowerCase();

    try {
      loading = true;

      const listRes = await apiFetch(`/nfts/listings`);
      if (!listRes.ok) throw new Error('Failed to fetch listings');
      const allListings = await listRes.json();
      // Only show listings with quantity > 0
      listings = allListings.filter(l => l.seller === address && l.nftId===nftId && l.parts.length > 0);

      const nftRes = await apiFetch('/nfts');
      if (!nftRes.ok) throw new Error('Failed to fetch NFTs');
      const nftList: NFT[] = await nftRes.json();
      for (const nft of nftList) nfts[nft._id] = nft;

    } catch (e: any) {
      error = e.message || 'Error loading listings';
    } finally {
      loading = false;
    }
  });

  function shortHash(hash: string) {
    return hash.slice(0, 8) + '...';
  }

  function openDeleteConfirm(listingId: string) {
    actionError = '';
    actionSuccess = '';
    showMnemonicFor = listingId;
  }

  function cancelDelete() {
    showMnemonicFor = null;
    actionError = '';
    actionSuccess = '';
  }

  async function confirmDeleteMnemonic(e) {
    const words = e.detail.words;
    if (words.some(w => w.trim() === '')) {
      actionError = 'Please enter all 12 words';
      return;
    }
    try {
      const mnemonic = words.join(' ').trim();
      const wallet = getWalletFromMnemonic(mnemonic);

      if (wallet.address.toLowerCase() !== address) {
        actionError = 'Mnemonic does not match logged-in wallet';
        return;
      }

      const res = await signedFetch(`/nfts/listings/${showMnemonicFor}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seller: address }),
      }, wallet);

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Failed to delete listing');
      }

      actionSuccess = 'Listing deleted successfully';
      setTimeout(() => window.location.reload(), 1000);
      showMnemonicFor = null;
    } catch (e: any) {
      actionError = e.message || 'Error deleting listing';
    }
  }
</script>

<div class="max-w-3xl mx-auto p-4">
  <h1 class="text-2xl font-bold mb-4">My Listings</h1>

  {#if loading}
    <p>Loading your listings...</p>
  {:else if error}
    <p class="text-red-600">{error}</p>
  {:else if listings.length === 0}
    <p>You have no active listings.</p>
  {:else}
    <div class="space-y-4">
      {#each listings as listing}
        <div class="border  p-4 flex items-center space-x-4">
          <!-- NFT Thumbnail -->
          <img
            src={nfts[listing.nftId]?.imageurl || ''}
            alt="NFT"
            class="w-16 h-16 object-cover "
          />
          <div class="flex-grow">
            <p><strong>NFT:</strong> {shortHash(listing.nftId)}</p>
            <p><strong>Price:</strong> {listing.price} YRT</p>
            <p><strong>Quantity:</strong> {listing.parts.length}</p>
          </div>
          <div class="flex flex-col space-y-2">
            <a
              class="bg-blue-600 text-white px-3 py-1  hover:bg-blue-700 text-center"
              href={`/listing/${listing._id}`}
            >
              Details
            </a>
            <button
              class="bg-red-600 text-white px-3 py-1  hover:bg-red-700"
              on:click={() => openDeleteConfirm(listing._id)}
            >
              Delete
            </button>
          </div>
        </div>
      {/each}
    </div>
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
        <button class="bg-gray-400 px-4 py-2  flex-grow" on:click={cancelDelete}>Cancel</button>
      </div>
    </MnemonicInput>
  {/if}
</div>
