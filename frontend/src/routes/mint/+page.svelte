<script lang="ts">
  import { walletAddress } from '$lib/stores/wallet';
  import { get } from 'svelte/store';
  import { mintNFT } from '$lib/nftActions'; // or your wallet library
  import { getWalletFromMnemonic } from '$lib/walletActions'; // or your wallet library
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';

  // State variables
  let name = '';
  let description = '';
  let parts = 1;
  let imageUrl = '';
  let imageFile: File | null = null;

  let showMnemonic = false;
  let mnemonicWords = Array(12).fill('');

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
  function onMintClick() {
    if (validateInputs()) {
      error = '';
      success = '';
      showMnemonic = true;
    }
  }

  // Cancel mnemonic entry and go back
  function onCancelMnemonic() {
    showMnemonic = false;
    mnemonicWords = Array(12).fill('');
    error = '';
  }

  // Confirm minting: validate mnemonic, check wallet, then mint
  async function onConfirmMint() {
    const mnemonic = mnemonicWords.join(' ').trim();

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
      mnemonicWords = Array(12).fill('');
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

  {#if !showMnemonic}
    <button
      on:click={onMintClick}
      class="bg-blue-600 text-white px-4 py-2 rounded w-full"
    >
      Mint
    </button>
  {/if}

  {#if showMnemonic}
    <div class="mt-6 p-4 border rounded bg-gray-50">
      <p class="mb-2 font-semibold">Enter your 12-word mnemonic to confirm:</p>
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
      <div class="flex space-x-4">
        <button
          on:click={onConfirmMint}
          class="bg-green-600 text-white px-4 py-2 rounded flex-grow"
        >
          Confirm
        </button>
        <button
          on:click={onCancelMnemonic}
          class="bg-red-600 text-white px-4 py-2 rounded flex-grow"
        >
          Cancel
        </button>
      </div>
    </div>
  {/if}
</div>
