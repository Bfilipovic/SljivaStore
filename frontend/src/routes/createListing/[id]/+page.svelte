<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { wallet } from "$lib/stores/wallet";
  import { get } from "svelte/store";
  import {
    isSessionActive,
  } from "$lib/walletActions";
  import { signedFetch } from "$lib/signing";
  import SessionPasswordInput from "$lib/SessionPasswordInput.svelte";
  import SuccessPopup from "$lib/SuccessPopup.svelte";

  import { page } from "$app/stores";
  import { apiFetch } from "$lib/api";
  import { yrtToEth } from "$lib/currency";
  import { normalizeAddress } from "$lib/utils/addressUtils";

  $: nftId = $page.params.id;

  let nft: any = null;
  let owned = 0;
  let available = 0;
  let quantity = 1;
  let price = "";
  let convertedEth: string = "";
  let address = "";
  let error = "";
  let successMessage = "";
  let showSuccessPopup = false;
  let showSessionPassword = false;
  let processing = false;

  // bundle sale toggle
  let bundleSale = false;
  let showTooltip = false;

  // currency acceptance checkboxes
  let acceptETH = true; // default to ETH
  let acceptSOL = false;

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
      nft = nftData.find((n: any) => n._id === nftId);
      if (!nft) throw new Error("NFT not found in owner data");

      owned = nft.owned;
      available = nft.available;
    } catch (e: any) {
      error = e.message || "Failed to load NFT";
      console.error("[CreateListing] Error loading NFT:", e);
    }
  });

  function validateInputs() {
    if (!price.trim() || isNaN(parseFloat(price)) || parseFloat(price) < 1) {
      error = "Invalid price";
      return false;
    }
    if (quantity < 1 || quantity > available) {
      error = `You can list between 1 and ${available} parts`;
      return false;
    }
    if (!acceptETH && !acceptSOL) {
      error = "Select at least one currency to accept";
      return false;
    }
    error = "";
    return true;
  }

  function onShowSessionPassword() {
    if (processing) return; // Prevent multiple clicks
    if (!validateInputs()) return;
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


      // Step 2: Build sellerWallets based on checkboxes and wallet store
      const w: any = get(wallet);
      const sellerWallets: Record<string, string> = {};
      if (acceptETH) {
        sellerWallets.ETH = w.ethAddress;
      }
      if (acceptSOL) {
        const solAddr = w.addresses?.find((a: any) => a.currency === "SOL")?.address;
        if (!solAddr) throw new Error("No SOL address available in your wallet");
        sellerWallets.SOL = solAddr;
      }

      // Step 3: Prepare payload
      const listing = {
        price,
        nftId,
        seller: address,
        quantity: quantity,
        bundleSale,
        sellerWallets,
      };

      // Step 4: Sign and send
      const res = await signedFetch(
        "/listings",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(listing),
        },
        sessionPassword,
      );

      if (!res.ok) throw new Error("Listing failed");

      successMessage = "Listing created successfully!";
      showSessionPassword = false;
      error = "";
      
      // Show success popup, then reload after it closes
      showSuccessPopup = true;
    } catch (e: any) {
      error = e.message || "Error creating listing";
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

  $: if (price && !isNaN(Number(price))) {
    yrtToEth(Number(price))
      .then((eth) => {
        convertedEth = Number(eth).toFixed(6);
      })
      .catch(() => {
        convertedEth = "";
      });
  } else {
    convertedEth = "";
  }
</script>

<div class="max-w-md mx-auto p-4 space-y-4">
  {#if nft}
    <img src={nft.imageurl} alt="NFT Image" class="w-full aspect-square" />
    <div>
      <strong>{nft.name}</strong><br />
      Total parts: {nft.part_count}<br />
      You own: {owned}<br />
      Available for sale: {available}
    </div>

    <!-- Bundle sale toggle -->
    <label class="flex items-center space-x-2">
      <input type="checkbox" bind:checked={bundleSale} />
      <span>Bundle sale?</span>
      <span
        class="ml-1 text-gray-500 cursor-pointer relative"
        on:mouseenter={() => (showTooltip = true)}
        on:mouseleave={() => (showTooltip = false)}
        on:click={() => (showTooltip = !showTooltip)}
      >
        ⓘ
        {#if showTooltip}
          <span
            class="absolute left-5 top-0 bg-black text-white text-xs p-2 w-48 z-10"
          >
            Bundle sale means buyer must purchase all listed parts together.
          </span>
        {/if}
      </span>
    </label>

    <label>Quantity to sell</label>
    <input
      type="number"
      bind:value={quantity}
      min="1"
      max={available}
      class="border p-2 w-full"
    />

    <label>Price in YRT</label>
    <input type="text" bind:value={price} class="border p-2 w-full" />

    {#if convertedEth}
      <p class="text-gray-500 text-sm">≈ {convertedEth} ETH</p>
    {/if}

    <!-- Currency acceptance checkboxes -->
    <div class="border p-3 space-y-2">
      <label class="block font-semibold">Accept payments in:</label>
      <label class="flex items-center space-x-2">
        <input type="checkbox" bind:checked={acceptETH} />
        <span>ETH</span>
      </label>
      <label class="flex items-center space-x-2">
        <input type="checkbox" bind:checked={acceptSOL} />
        <span>SOL</span>
      </label>
      <p class="text-xs text-gray-500">At least one must be selected</p>
    </div>

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
        class="bg-green-600 text-white px-4 py-2 w-full disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {processing ? "Processing..." : "Sell"}
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
