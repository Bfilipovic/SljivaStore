<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { walletAddress } from '$lib/stores/wallet';
  import { get } from 'svelte/store';
  import { getWalletFromMnemonic } from '$lib/walletActions';
  import MnemonicInput from '$lib/MnemonicInput.svelte';
  import { NFT, Part, Listing } from '$lib/classes';

  import { page } from '$app/stores';
  $: nftId=$page.params.id;

  let nft: NFT | null = null;
  let userParts = 0;
  let availableParts = 0;
  let quantity = 1;
  let price = '';
  let address = '';
  let error = '';
  let success = '';
  let showMnemonic = false;

  onMount(async () => {
  console.log('onMount started');
  const addr = get(walletAddress);
  if (!addr) {
    console.log('No wallet address, redirecting');
    goto('/login');
    return;
  }
  address = addr.toLowerCase();
  console.log('Wallet address:', address);
  console.log('NFT ID from params:', nftId);

  try {
    const [nftRes, partsRes] = await Promise.all([
      fetch(`/nfts/${nftId}`),
      fetch(`/nfts/${nftId}/parts`),
    ]);

    console.log('NFT fetch status:', nftRes.status);
    console.log('Parts fetch status:', partsRes.status);

    if (!nftRes.ok || !partsRes.ok) throw new Error("Failed to fetch NFT or parts");

    nft = new NFT(await nftRes.json());
    const parts = (await partsRes.json()).map((p: any) => new Part(p));

    const owned = parts.filter(p => p.owner === address);
    const unlisted = owned.filter(p => !p.listing);

    userParts = owned.length;
    availableParts = unlisted.length;

    console.log('NFT loaded:', nft);
    console.log('User owns', userParts, 'parts,', availableParts, 'available');
  } catch (e: any) {
    error = e.message || 'Failed to load NFT';
    console.error('Error loading NFT:', e);
  }
});


  function validateInputs() {
    if (!price.trim() || isNaN(parseFloat(price)) || parseFloat(price) <= 0) {
      error = 'Invalid price';
      return false;
    }
    if (quantity < 1 || quantity > availableParts) {
      error = `You can list between 1 and ${availableParts} parts`;
      return false;
    }
    error = '';
    return true;
  }

  function onShowMnemonic() {
    if (!validateInputs()) return;
    console.log('Showing mnemonic input');
    showMnemonic = true;
    error = '';
    success = '';
  }

  function onCancelMnemonic() {
    showMnemonic = false;
    error = '';
  }

  async function onConfirmMnemonic(e) {
    if (!validateInputs()) return;
    const words = e.detail.words;
    const mnemonic = words.join(' ').trim();
    console.log('Mnemonic entered:', mnemonic);
    if (mnemonic.split(' ').length !== 12) {
      error = 'Enter all 12 words';
      return;
    }
    try {
      const wallet = getWalletFromMnemonic(mnemonic);
      console.log('Wallet from mnemonic:', wallet.address);
      if (wallet.address.toLowerCase() !== address.toLowerCase()) {
        error = 'Mnemonic does not match the logged-in wallet';
        console.log('Mnemonic mismatch:', wallet.address, address);
        return;
      }
      const partListRes = await fetch(`/nfts/${nftId}/parts`);
      const allParts = (await partListRes.json()).map((p: any) => new Part(p));
      const ownedUnlisted = allParts.filter(
        p => p.owner === address && !p.listing
      );
      console.log('Owned and unlisted parts:', ownedUnlisted);
      if (quantity > ownedUnlisted.length) {
        error = `You can only list up to ${ownedUnlisted.length} parts`;
        console.log('Attempted to list too many parts:', quantity, ownedUnlisted.length);
        return;
      }
      const selectedParts = ownedUnlisted.slice(0, quantity);
      const partHashes = selectedParts.map(p => p._id);
      console.log('Selected parts for listing:', partHashes);
      const listing = new Listing({
        price,
        nftId,
        seller: address,
        parts: partHashes,
      });
      console.log('Listing object:', listing);
      const res = await fetch('/nfts/createListing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(listing),
      });
      if (!res.ok) throw new Error('Listing failed');
      success = 'Listing created successfully!';
      showMnemonic = false;
      console.log('Listing created successfully!');
    } catch (e: any) {
      error = e.message || 'Error creating listing';
      console.error('Error creating listing:', e);
    }
  }
</script>

<div class="max-w-md mx-auto p-4 space-y-4">
  {#if nft}
    <img src={nft.imageurl} alt="NFT Image" class="w-full rounded" />
    <div>
      <strong>{nft.name}</strong><br />
      Total parts: {nft.part_count}<br />
      You own: {userParts}<br />
      Available for sale: {availableParts}
    </div>

    <label>Quantity to sell</label>
    <input type="number" bind:value={quantity} min="1" max={availableParts} class="border p-2 w-full rounded" />

    <label>Price in ETH</label>
    <input type="text" bind:value={price} class="border p-2 w-full rounded" />

    {#if error}
      <p class="text-red-600">{error}</p>
    {/if}

    {#if success}
      <p class="text-green-600">{success}</p>
    {/if}

    {#if showMnemonic}
      <MnemonicInput
        label="Enter your 12-word mnemonic to confirm:"
        error={error}
        success={success}
        confirmText="Confirm"
        on:confirm={onConfirmMnemonic}
      >
        <div slot="actions" class="flex space-x-4 mt-2">
          <button class="bg-red-600 text-white px-4 py-2 rounded flex-grow" on:click={onCancelMnemonic}>Cancel</button>
        </div>
      </MnemonicInput>
    {/if}
    {#if !showMnemonic}
      <button
        on:click={onShowMnemonic}
        class="bg-green-600 text-white px-4 py-2 rounded w-full"
      >
        Sell
      </button>
    {/if}
  {:else}
    <p>Loading NFT...</p>
  {/if}
</div>
