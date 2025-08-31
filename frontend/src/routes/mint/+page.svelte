<script lang="ts">
  import { walletAddress } from '$lib/stores/wallet';
  import { get } from 'svelte/store';
  import { mintNFT } from '$lib/nftActions';
  import { getWalletFromMnemonic } from '$lib/walletActions';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import MnemonicInput from '$lib/MnemonicInput.svelte';

  // State variables
  let name = '';
  let description = '';
  let parts = 1;
  let imageUrl = '';

  let showMnemonic = false;
  let error = '';
  let success = '';

  onMount(() => {
    if (!get(walletAddress)) goto('/login');
  });

  function validateInputs() {
    if (!name.trim()) {
      error = 'Name is required';
      return false;
    }
    if (!description.trim()) {
      error = 'Description is required';
      return false;
    }
    if (parts < 1) {
      error = 'Parts must be at least 1';
      return false;
    }
    if (!imageUrl.trim()) {
      error = 'Image URL is required';
      return false;
    }
    error = '';
    return true;
  }

  function onShowMnemonic() {
    if (!validateInputs()) return;
    showMnemonic = true;
    error = '';
    success = '';
  }

  function onCancelMnemonic() {
    showMnemonic = false;
    error = '';
    success = '';
  }

  async function onConfirmMnemonic(e) {
    const words = e.detail.words;
    const mnemonic = words.join(' ').trim();

    if (mnemonic.split(' ').length !== 12) {
      error = 'Please enter all 12 words of your mnemonic';
      return;
    }

    error = '';
    success = '';

    const loggedInAddress = get(walletAddress);
    if (!loggedInAddress) {
      error = 'Not logged in';
      return;
    }

    let derivedWallet;
    try {
      derivedWallet = getWalletFromMnemonic(mnemonic);
    } catch {
      error = 'Invalid mnemonic phrase';
      return;
    }

    if (derivedWallet.address.toLowerCase() !== loggedInAddress.toLowerCase()) {
      error = 'Mnemonic does not match the logged-in wallet address';
      return;
    }

    try {
      await mintNFT({
        name,
        description,
        parts,
        imageUrl,
        creator: loggedInAddress,
      });

      success = 'NFT minted successfully!';
      showMnemonic = false;

      // Clear inputs
      name = '';
      description = '';
      parts = 1;
      imageUrl = '';
    } catch (e: any) {
      error = e.message || 'Minting failed';
    }
  }
</script>

<div class="max-w-md mx-auto p-4 space-y-4">
  <label>Name</label>
  <input type="text" bind:value={name} class="border p-2 w-full" />

  <label>Description</label>
  <textarea bind:value={description} class="border p-2 w-full"></textarea>

  <label>Parts</label>
  <input type="number" bind:value={parts} min="1" class="border p-2 w-full" />

  <label>Image URL</label>
  <input
    type="text"
    bind:value={imageUrl}
    placeholder="https://example.com/image.png"
    class="border p-2 w-full"
  />

  {#if imageUrl}
    <div>
      <p class="font-semibold">Preview:</p>
      <img src={imageUrl} alt="Image preview" class="max-w-full" />
    </div>
  {/if}

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
        <button class="bg-red-600 text-white px-4 py-2 flex-grow" on:click={onCancelMnemonic}>Cancel</button>
      </div>
    </MnemonicInput>
  {/if}

  {#if !showMnemonic}
    <button
      on:click={onShowMnemonic}
      class="bg-blue-600 text-white px-4 py-2 w-full"
    >
      Mint
    </button>
  {/if}
</div>
