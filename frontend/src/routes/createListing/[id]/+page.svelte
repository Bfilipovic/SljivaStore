<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { wallet } from "$lib/stores/wallet";
  import { get } from "svelte/store";
  import {
    mnemonicMatchesLoggedInWallet,
    signedFetch
  } from "$lib/walletActions";
  import MnemonicInput from "$lib/MnemonicInput.svelte";

  import { page } from "$app/stores";
  import { apiFetch } from "$lib/api";
  import { yrtToEth } from "$lib/currency";

  $: nftId = $page.params.id;

  let nft: any = null;
  let owned = 0;
  let available = 0;
  let quantity = 1;
  let price = "";
  let convertedEth: string = "";
  let address = "";
  let error = "";
  let success = "";
  let showMnemonic = false;

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
    address = addr.toLowerCase();

    try {
      const [nftRes] = await Promise.all([
        apiFetch(`/nfts/owner/${address}`),
      ]);

      if (!nftRes.ok) throw new Error("Failed to fetch ownership info");
      const nftData = await nftRes.json();
      console.log("[GIFT] /nfts/owner response:", nftData);
      nft = nftData.find((n: any) => n._id === nftId);
      if (!nft) throw new Error("NFT not found in owner data");

      owned = nft.owned;
      available = nft.available;

      console.log("[CreateListing] NFT loaded:", nft);
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

  function onShowMnemonic() {
    if (!validateInputs()) return;
    showMnemonic = true;
    error = "";
    success = "";
  }

  function onCancelMnemonic() {
    showMnemonic = false;
    error = "";
  }

  async function onConfirmMnemonic(e) {
    const words = e.detail.words;
    const mnemonic = words.join(" ").trim();

    if (mnemonic.split(" ").length !== 12) {
      error = "Enter all 12 words";
      return;
    }

    try {
      if (!mnemonicMatchesLoggedInWallet(mnemonic)) {
        error = "Mnemonic does not match the logged-in wallet";
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

      console.log("[LISTING] Payload:", listing);

      // Step 4: Sign and send
      const res = await signedFetch(
        "/listings",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(listing),
        },
        mnemonic,
      );

      if (!res.ok) throw new Error("Listing failed");

      success = "Listing created successfully!";
      showMnemonic = false;
      window.location.reload();
    } catch (e: any) {
      error = e.message || "Error creating listing";
    }
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

    {#if success}
      <p class="text-green-600">{success}</p>
    {/if}

    {#if showMnemonic}
      <MnemonicInput
        label="Enter your 12-word mnemonic to confirm:"
        {error}
        {success}
        confirmText="Confirm"
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
        class="bg-green-600 text-white px-4 py-2 w-full"
      >
        Sell
      </button>
    {/if}
  {:else}
    <p>Loading NFT...</p>
  {/if}
</div>
