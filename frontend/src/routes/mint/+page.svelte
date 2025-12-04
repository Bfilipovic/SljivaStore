<script lang="ts">
  import { wallet } from "$lib/stores/wallet";
  import { get } from "svelte/store";
  import {
    mnemonicMatchesLoggedInWallet,
    signedFetch,
  } from "$lib/walletActions";
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import MnemonicInput from "$lib/MnemonicInput.svelte";
  import SuccessPopup from "$lib/SuccessPopup.svelte";

  let name = "";
  let description = "";
  let parts = 1;
  let imageUrl = "";

  let showMnemonic = false;
  let error = "";
  let successMessage = "";
  let showSuccessPopup = false;
  let processing = false;

  onMount(() => {
    const w = get(wallet);
    if (!w.ethAddress) {
      goto("/login");
    } else if (!w.isAdmin) {
      goto("/");
    }
  });

  function validateInputs() {
    if (!name.trim()) {
      error = "Name is required";
      return false;
    }
    if (!description.trim()) {
      error = "Description is required";
      return false;
    }
    if (parts < 1) {
      error = "Parts must be at least 1";
      return false;
    }
    if (!imageUrl.trim()) {
      error = "Image URL is required";
      return false;
    }
    error = "";
    return true;
  }

  function onShowMnemonic() {
    if (processing) return; // Prevent multiple clicks
    if (!validateInputs()) return;
    showMnemonic = true;
    error = "";
    successMessage = "";
    showSuccessPopup = false;
  }

  function onCancelMnemonic() {
    showMnemonic = false;
    error = "";
    successMessage = "";
    showSuccessPopup = false;
  }

  async function onConfirmMnemonic(e: any) {
    if (processing) return; // Prevent multiple submissions
    processing = true;
    
    const words = e.detail.words;
    if (words.some((w: string) => w.trim() === "")) {
      error = "Please enter all 12 words";
      processing = false;
      return;
    }

    try {
      const mnemonic = words.join(" ").trim();

      const loggedInAddress = get(wallet).ethAddress;
      if (!loggedInAddress) {
        error = "Not logged in";
        processing = false;
        return;
      }

      if (!mnemonicMatchesLoggedInWallet(mnemonic)) {
        error = "Mnemonic does not match the logged-in wallet";
        processing = false;
        return;
      }

      const res = await signedFetch(
        "/nfts/mint",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            description,
            parts,
            imageUrl,
            creator: loggedInAddress.toLowerCase(),
          }),
        },
        mnemonic,
      );

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "Failed to mint NFT");
      }

      successMessage = "NFT minted successfully!";
      showMnemonic = false;
      error = "";

      // Clear inputs
      name = "";
      description = "";
      parts = 1;
      imageUrl = "";
      
      // Show success popup
      showSuccessPopup = true;
    } catch (e: any) {
      error = e.message || "Error minting NFT";
      processing = false;
    }
  }
  
  function handleSuccessPopupClose() {
    showSuccessPopup = false;
    successMessage = "";
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

  {#if showMnemonic}
    <MnemonicInput
      label="Enter your 12-word mnemonic to confirm:"
      {error}
      success=""
      confirmText="Confirm"
      loading={processing}
      on:confirm={onConfirmMnemonic}
    >
      <div slot="actions" class="flex space-x-4 mt-2">
        <button
          class="bg-red-600 text-white px-4 py-2 flex-grow"
          on:click={onCancelMnemonic}>Cancel</button
        >
      </div>
    </MnemonicInput>
  {/if}

  {#if !showMnemonic}
    <button
      on:click={onShowMnemonic}
      disabled={processing}
      class="bg-blue-600 text-white px-4 py-2 w-full disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {processing ? "Processing..." : "Mint"}
    </button>
  {/if}
</div>

<SuccessPopup 
  message={successMessage} 
  bind:visible={showSuccessPopup}
  on:close={handleSuccessPopupClose}
/>
