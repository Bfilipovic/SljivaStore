<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { walletAddress} from '$lib/stores/wallet';
  import { get } from 'svelte/store';
  import { getWalletFromMnemonic, signedFetch } from '$lib/walletActions';
  import MnemonicInput from '$lib/MnemonicInput.svelte';

  import { page } from '$app/stores';
  $: nftId=$page.params.id;

  let nft: any = null;
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

    nft = await nftRes.json();
    const parts = await partsRes.json();

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
    showMnemonic = true;
    error = '';
    success = '';
  }

  function onCancelMnemonic() {
    showMnemonic = false;
    error = '';
  }
  
async function onConfirmMnemonic(e) {
	const words = e.detail.words;
	const mnemonic = words.join(' ').trim();

	if (mnemonic.split(' ').length !== 12) {
		error = 'Enter all 12 words';
		return;
	}

	try {
		const wallet = getWalletFromMnemonic(mnemonic);
		if (wallet.address.toLowerCase() !== address.toLowerCase()) {
			error = 'Mnemonic does not match the logged-in wallet';
			return;
		}

		// Step 1: Fetch parts
		const partListRes = await fetch(`/nfts/${nftId}/parts`);
		const allParts = await partListRes.json();

		const ownedUnlisted = allParts.filter(
			p => p.owner === address && !p.listing
		);
		const selectedParts = ownedUnlisted.slice(0, quantity);
		const partHashes = selectedParts.map(p => p._id);

		// Step 2: Prepare payload
		const listing = {
			price,
			nftId,
			seller: address,
			parts: partHashes
		};

		// Step 3: Sign and send
		const res = await signedFetch('/nfts/createListing', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(listing)
		}, wallet);

		if (!res.ok) throw new Error('Listing failed');

		success = 'Listing created successfully!';
		showMnemonic = false;
	} catch (e: any) {
		error = e.message || 'Error creating listing';
	}
}

</script>

<div class="max-w-md mx-auto p-4 space-y-4">
  {#if nft}
    <img src={nft.imageurl} alt="NFT Image" class="w-full " />
    <div>
      <strong>{nft.name}</strong><br />
      Total parts: {nft.part_count}<br />
      You own: {userParts}<br />
      Available for sale: {availableParts}
    </div>

    <label>Quantity to sell</label>
    <input type="number" bind:value={quantity} min="1" max={availableParts} class="border p-2 w-full " />

    <label>Price in ETH</label>
    <input type="text" bind:value={price} class="border p-2 w-full " />

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
          <button class="bg-red-600 text-white px-4 py-2  flex-grow" on:click={onCancelMnemonic}>Cancel</button>
        </div>
      </MnemonicInput>
    {/if}
    {#if !showMnemonic}
      <button
        on:click={onShowMnemonic}
        class="bg-green-600 text-white px-4 py-2  w-full"
      >
        Sell
      </button>
    {/if}
  {:else}
    <p>Loading NFT...</p>
  {/if}
</div>
