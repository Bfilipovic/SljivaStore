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
  let imageFile: File | null = null;

  let showMnemonic = false;

  let error = '';
  let success = '';

  onMount(() => {
    if(!$walletAddress) goto('/login');
  });

  // Called on file input change
  function handleFileChange(event: Event) {
    const files = (event.target as HTMLInputElement).files;
    if (files && files.length > 0) {
      imageFile = files[0];
      imageUrl = '';
    }
  }

  // Basic input validation
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
    if (!imageUrl.trim() && !imageFile) {
      error = 'Please provide an image URL or upload a file';
      return false;
    }
    error = '';
    return true;
  }

  // On initial mint button click: validate and show mnemonic inputs
  function onShowMnemonic() {
    showMnemonic = true;
    error = '';
    success = '';
  }

  // Cancel mnemonic entry and go back
  function onCancelMnemonic() {
    showMnemonic = false;
    error = '';
    success = '';
  }

  // Confirm minting: validate mnemonic, check wallet, then mint
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

    // Derive wallet address from mnemonic
    let derivedWallet;
    try {
      derivedWallet = getWalletFromMnemonic(mnemonic);
    } catch (e) {
      error = 'Invalid mnemonic phrase';
      return;
    }

    if (derivedWallet.address.toLowerCase() !== loggedInAddress.toLowerCase()) {
      error = 'Mnemonic does not match the logged-in wallet address';
      return;
    }

    // Mint function: Replace this with your actual minting call
    try {
      await mintNFT({
        name,
        description,
        parts,
        imageUrl,
        imageFile,
        creator: loggedInAddress,
      });

      success = 'NFT minted successfully!';
      showMnemonic = false;

      // Clear inputs
      name = '';
      description = '';
      parts = 1;
      imageUrl = '';
      imageFile = null;
    } catch (e: any) {
      error = e.message || 'Minting failed';
    }
  }


</script>

<div class="max-w-md mx-auto p-4 space-y-4">
  <label>Name</label>
  <input type="text" bind:value={name} class="border p-2 w-full rounded" />

  <label>Description</label>
  <textarea bind:value={description} class="border p-2 w-full rounded"></textarea>

  <label>Parts</label>
  <input type="number" bind:value={parts} min="1" class="border p-2 w-full rounded" />

  <label>Image URL (or upload below)</label>
  <input
    type="text"
    bind:value={imageUrl}
    class="border p-2 w-full rounded"
    disabled={!!imageFile}
  />

  <label>Or Upload Image File</label>
  <input
    type="file"
    accept="image/*"
    on:change={handleFileChange}
    disabled={!!imageUrl}
  />

  {#if imageFile}
    <div>
      <p class="font-semibold">Preview:</p>
      <img src={URL.createObjectURL(imageFile)} alt="Image preview" class="max-w-full rounded" />
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
        <button class="bg-red-600 text-white px-4 py-2 rounded flex-grow" on:click={onCancelMnemonic}>Cancel</button>
      </div>
    </MnemonicInput>
  {/if}

  {#if !showMnemonic}
    <button
      on:click={onShowMnemonic}
      class="bg-blue-600 text-white px-4 py-2 rounded w-full"
    >
      Mint
    </button>
  {/if}
</div>
