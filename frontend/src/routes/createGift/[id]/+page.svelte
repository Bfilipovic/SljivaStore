<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { wallet } from "$lib/stores/wallet";
  import { get } from "svelte/store";
  import {
    mnemonicMatchesLoggedInWallet,
    signedFetch,
  } from "$lib/walletActions";
  import MnemonicInput from "$lib/MnemonicInput.svelte";
  import SuccessPopup from "$lib/SuccessPopup.svelte";

  import { page } from "$app/stores";
  import { apiFetch } from "$lib/api";
  $: nftId = $page.params.id;

  let nft: any = null;
  let quantity = 1;
  let receiver = "";
  let address = "";
  let error = "";
  let successMessage = "";
  let showSuccessPopup = false;
  let showMnemonic = false;
  let processing = false;
  let owned = 0;
  let available = 0;

  onMount(async () => {
    console.log("[GIFT] onMount started");
    const addr = get(wallet).ethAddress;
    if (!addr) {
      console.log("[GIFT] No wallet address, redirecting");
      goto("/login");
      return;
    }
    address = addr.toLowerCase();
    console.log("[GIFT] Wallet address:", address);
    console.log("[GIFT] NFT ID from params:", nftId);

    try {
      const [nftRes] = await Promise.all([
        apiFetch(`/nfts/owner/${address}`),
      ]);

      if (!nftRes.ok) throw new Error("Failed to fetch ownership info");
      const nftData = await nftRes.json();
      console.log("[GIFT] /nfts/owner response:", nftData);
      const record = nftData.find((n: any) => n._id === nftId);
      if (!record) throw new Error("NFT not found in owner data");

      nft = record;
      owned = record.owned;
      available = record.available;

      console.log("[GIFT] NFT loaded:", nft);
    } catch (e: any) {
      error = e.message || "Failed to load NFT";
      console.error("[GIFT] Error loading NFT:", e);
    }
  });

  function validateInputs() {
    if (!/^0x[a-fA-F0-9]{40}$/.test(receiver)) {
      error = "Invalid receiver address";
      return false;
    }
    if (receiver.toLowerCase() === address.toLowerCase()) {
      error = "You cannot gift to yourself";
      return false;
    }
    if (quantity < 1 || quantity > available) {
      error = `You can gift between 1 and ${available} parts`;
      return false;
    }
    error = "";
    return true;
  }

  function onShowMnemonic() {
    if (processing) return; // Prevent multiple clicks
    if (!validateInputs()) return; // ✅ run validation
    showMnemonic = true;
    error = "";
    successMessage = "";
    showSuccessPopup = false;
  }

  function onCancelMnemonic() {
    showMnemonic = false;
    error = "";
  }

  async function onConfirmMnemonic(e) {
    if (processing) return; // Prevent multiple submissions
    processing = true;
    
    const words = e.detail.words;
    const mnemonic = words.join(" ").trim();

    if (mnemonic.split(" ").length !== 12) {
      error = "Enter all 12 words";
      processing = false;
      return;
    }

    try {
      if (!mnemonicMatchesLoggedInWallet(mnemonic)) {
        error = "Mnemonic does not match the logged-in wallet";
        processing = false;
        return;
      }

      // Step 1: Prepare payload
      const gift = {
        giver: address,
        receiver,
        nftId,
        quantity: quantity,
      };
      console.log("[GIFT] Payload:", gift);

      // Step 2: Sign and send
      const res = await signedFetch(
        "/gifts",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(gift),
        },
        mnemonic,
      );

      if (!res.ok) throw new Error("Gift failed");

      successMessage = "Gift created successfully!";
      showMnemonic = false;
      error = "";
      console.log("[GIFT] Gift creation success");
      
      // Show success popup
      showSuccessPopup = true;
    } catch (e: any) {
      error = e.message || "Error creating gift";
      console.error("[GIFT] Error creating gift:", e);
    } finally {
      processing = false;
    }
  }
  
  function handleSuccessPopupClose() {
    showSuccessPopup = false;
    successMessage = "";
  }
</script>

<div class="max-w-md mx-auto p-4 space-y-4">
  {#if nft}
    <img src={nft.imageurl} alt="NFT Image" class="w-full aspect-square" />
    <div>
      <strong>{nft.name}</strong><br />
      Total parts: {nft.part_count}<br />
      You own: {owned}<br />
      Available to gift: {available}
    </div>

    <label>Quantity to gift</label>
    <input
      type="number"
      bind:value={quantity}
      min="1"
      max={available}
      class="border p-2 w-full"
    />

    <label>Receiver Address</label>
    <input
      type="text"
      bind:value={receiver}
      class="border p-2 w-full"
      placeholder="0x..."
    />

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
        {processing ? "Processing..." : "Gift"}
      </button>
    {/if}
  {:else}
    <p>Loading NFT...</p>
  {/if}
</div>

<SuccessPopup 
  message={successMessage} 
  bind:visible={showSuccessPopup}
  on:close={handleSuccessPopupClose}
/>
