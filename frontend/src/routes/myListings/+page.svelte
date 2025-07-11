<script lang="ts">
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import { walletAddress } from '$lib/stores/wallet';
  import { goto } from '$app/navigation';
  import { getWalletFromMnemonic } from '$lib/walletActions';

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
  let mnemonicWords = Array(12).fill('');
  let actionError = '';
  let actionSuccess = '';

  onMount(async () => {
    const addr = get(walletAddress);
    if (!addr) {
      goto('/login');
      return;
    }
    address = addr.toLowerCase();

    try {
      loading = true;

      const listRes = await fetch(`/nfts/listings`);
      if (!listRes.ok) throw new Error('Failed to fetch listings');
      const allListings = await listRes.json();
      listings = allListings.filter(l => l.seller === address);

      const nftRes = await fetch('/nfts');
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
    mnemonicWords = Array(12).fill('');
  }

  function cancelDelete() {
    showMnemonicFor = null;
    mnemonicWords = Array(12).fill('');
    actionError = '';
    actionSuccess = '';
  }

  async function confirmDelete() {
    if (mnemonicWords.some(w => w.trim() === '')) {
      actionError = 'Please enter all 12 words';
      return;
    }

    try {
      const mnemonic = mnemonicWords.join(' ').trim();
      const wallet = getWalletFromMnemonic(mnemonic);

      if (wallet.address.toLowerCase() !== address) {
        actionError = 'Mnemonic does not match logged-in wallet';
        return;
      }

      const res = await fetch(`/nfts/listings/${showMnemonicFor}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seller: address }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Failed to delete listing');
      }

      actionSuccess = 'Listing deleted successfully';
      listings = listings.filter(l => l._id !== showMnemonicFor);
      cancelDelete();
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
        <div class="border rounded p-4 flex items-center space-x-4">
          <!-- NFT Thumbnail -->
          <img
            src={nfts[listing.nftId]?.imageurl || ''}
            alt="NFT"
            class="w-16 h-16 object-cover rounded"
          />
          <div class="flex-grow">
            <p><strong>NFT:</strong> {shortHash(listing.nftId)}</p>
            <p><strong>Price:</strong> {listing.price} ETH</p>
            <p><strong>Quantity:</strong> {listing.parts.length}</p>
          </div>
          <div class="flex flex-col space-y-2">
            <a
              class="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 text-center"
              href={`/listing/${listing._id}`}
            >
              Details
            </a>
            <button
              class="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700"
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
    <div class="mt-6 p-4 border rounded bg-gray-100">
      <p class="mb-2 font-semibold text-red-700">Enter your 12-word mnemonic to confirm deletion:</p>
      <div class="grid grid-cols-3 gap-2 mb-4">
        {#each mnemonicWords as word, i}
          <input
            type="text"
            bind:value={mnemonicWords[i]}
            placeholder={`Word ${i + 1}`}
            class="border p-2 rounded w-full"
          />
        {/each}
      </div>

      {#if actionError}
        <p class="text-red-600 mb-2">{actionError}</p>
      {/if}
      {#if actionSuccess}
        <p class="text-green-600 mb-2">{actionSuccess}</p>
      {/if}

      <div class="flex space-x-4">
        <button
          class="bg-red-600 text-white px-4 py-2 rounded flex-grow"
          on:click={confirmDelete}
        >
          Confirm Delete
        </button>
        <button
          class="bg-gray-400 px-4 py-2 rounded flex-grow"
          on:click={cancelDelete}
        >
          Cancel
        </button>
      </div>
    </div>
  {/if}
</div>
