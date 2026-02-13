<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { wallet } from "$lib/stores/wallet";
  import { get } from "svelte/store";
  import {
    isSessionActive,
    signedFetch,
  } from "$lib/walletActions";
  import SessionPasswordInput from "$lib/SessionPasswordInput.svelte";
  import SuccessPopup from "$lib/SuccessPopup.svelte";

  import { page } from "$app/stores";
  import { apiFetch } from "$lib/api";
  import { normalizeAddress, addressesMatch } from "$lib/utils/addressUtils";
  $: nftId = $page.params.id;

  let nft: any = null;
  let quantity = 1;
  let receiver = "";
  let address = "";
  let error = "";
  let successMessage = "";
  let showSuccessPopup = false;
  let showSessionPassword = false;
  let processing = false;
  let owned = 0;
  let available = 0;

  onMount(async () => {
    const addr = get(wallet).ethAddress;
    if (!addr) {
      goto("/login");
      return;
    }
    address = normalizeAddress(addr) || "";

    try {
      const [nftRes] = await Promise.all([
        apiFetch(`/nfts/owner/${address}`),
      ]);

      if (!nftRes.ok) throw new Error("Failed to fetch ownership info");
      const nftData = await nftRes.json();
      const record = nftData.find((n: any) => n._id === nftId);
      if (!record) throw new Error("NFT not found in owner data");

      nft = record;
      owned = record.owned;
      available = record.available;
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
    if (addressesMatch(receiver, address)) {
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

  function onShowSessionPassword() {
    if (processing) return; // Prevent multiple clicks
    if (!validateInputs()) return; // ✅ run validation
    if (!isSessionActive()) {
      error = "No active session. Please log in again.";
      return;
    }
    showSessionPassword = true;
    error = "";
    successMessage = "";
    showSuccessPopup = false;
  }

  function onCancelSessionPassword() {
    showSessionPassword = false;
    error = "";
  }

  async function onConfirmSessionPassword(e: CustomEvent<{ password: string }>) {
    if (processing) return; // Prevent multiple submissions
    processing = true;
    
    const sessionPassword = e.detail.password;

    try {
      if (!isSessionActive()) {
        error = "No active session. Please log in again.";
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

      // Step 2: Sign and send
      const res = await signedFetch(
        "/gifts",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(gift),
        },
        sessionPassword,
      );

      if (!res.ok) throw new Error("Gift failed");

      successMessage = "Gift created successfully!";
      showSessionPassword = false;
      error = "";
      
      // Show success popup
      showSuccessPopup = true;
    } catch (e: any) {
      error = e.message || "Error creating gift";
      console.error("[GIFT] Error creating gift:", e);
    } finally {
      processing = false;
    }
  }
  
  async function handleSuccessPopupClose() {
    showSuccessPopup = false;
    successMessage = "";
    // Refresh owner data to get updated available count before reload
    try {
      const nftRes = await apiFetch(`/nfts/owner/${address}`);
      if (nftRes.ok) {
        const nftData = await nftRes.json();
        const record = nftData.find((n: any) => n._id === nftId);
        if (record) {
          owned = record.owned;
          available = record.available;
        }
      }
    } catch (e) {
      // Ignore errors, just reload
    }
    // Reload page after popup closes
    window.location.reload();
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

    {#if showSessionPassword}
      <SessionPasswordInput
        label="Enter your session password to confirm:"
        {error}
        success=""
        confirmText="Confirm"
        loading={processing}
        on:confirm={onConfirmSessionPassword}
        on:error={(e) => { error = e.detail.message; }}
      >
        <div slot="actions" class="flex space-x-4 mt-2">
          <button
            class="bg-red-600 text-white px-4 py-2 flex-grow"
            on:click={onCancelSessionPassword}>Cancel</button
          >
        </div>
      </SessionPasswordInput>
    {/if}
    {#if !showSessionPassword}
      <button
        on:click={onShowSessionPassword}
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
