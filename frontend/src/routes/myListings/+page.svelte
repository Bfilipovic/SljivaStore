<script lang="ts">
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import { walletAddress } from '$lib/stores/wallet';
  import { goto } from '$app/navigation';
  import { getWalletFromMnemonic } from '$lib/walletActions';
  import MnemonicInput from '$lib/MnemonicInput.svelte';
  import { Listing } from '$lib/classes';

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
      // Only show listings with quantity > 0
      listings = allListings.filter(l => l.seller === address && l.parts.length > 0).map((l: any) => new Listing(l));

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
    <div class="grid gap-6 md:grid-cols-2">
      {#each listings as listing}
        <div class="bg-white border rounded-lg shadow p-4 flex flex-col md:flex-row items-center gap-4">
          <img
            src={nfts[listing.nftId]?.imageurl || ''}
            alt="NFT"
            class="w-20 h-20 object-cover rounded border"
          />
          <div class="flex-grow space-y-1">
            <div class="font-semibold text-lg text-gray-800">NFT: {shortHash(listing.nftId)}</div>
            <div class="text-gray-600">Price: <span class="font-bold">{listing.price} ETH</span></div>
            <div class="text-gray-600">Quantity: <span class="font-bold">{listing.parts.length}</span></div>
          </div>
          <div class="flex flex-col gap-2 items-end">
            <a
              class="bg-blue-600 text-white px-4 py-1 rounded hover:bg-blue-700 text-center w-full"
              href={`/listing/${listing._id}`}
            >
              Details
            </a>
            <button
              class="bg-red-600 text-white px-4 py-1 rounded hover:bg-red-700 w-full"
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
    <div class="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div class="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
        <MnemonicInput
          label="Enter your 12-word mnemonic to confirm deletion:"
          error={actionError}
          success={actionSuccess}
          confirmText="Confirm Delete"
          on:confirm={confirmDeleteMnemonic}
        >
          <div slot="actions" class="flex space-x-4 mt-2">
            <button class="bg-gray-400 px-4 py-2 rounded flex-grow" on:click={cancelDelete}>Cancel</button>
          </div>
        </MnemonicInput>
      </div>
    </div>
  {/if}
</div>
