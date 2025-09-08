<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { walletAddress } from "$lib/stores/wallet";
  import { get } from "svelte/store";
  import { getWalletFromMnemonic, signedFetch } from "$lib/walletActions";
  import MnemonicInput from "$lib/MnemonicInput.svelte";

  import { page } from "$app/stores";
  import { apiFetch } from "$lib/api";
  $: nftId = $page.params.id;

  let nft: any = null;
  let userParts = 0;
  let availableParts = 0;
  let quantity = 1;
  let receiver = "";
  let address = "";
  let error = "";
  let success = "";
  let showMnemonic = false;

  onMount(async () => {
    console.log("[GIFT] onMount started");
    const addr = get(walletAddress);
    if (!addr) {
      console.log("[GIFT] No wallet address, redirecting");
      goto("/login");
      return;
    }
    address = addr.toLowerCase();
    console.log("[GIFT] Wallet address:", address);
    console.log("[GIFT] NFT ID from params:", nftId);

    try {
      const [nftRes, partsRes] = await Promise.all([
        apiFetch(`/nfts/${nftId}`),
        apiFetch(`/nfts/${nftId}/parts`),
      ]);

      console.log("[GIFT] NFT fetch status:", nftRes.status);
      console.log("[GIFT] Parts fetch status:", partsRes.status);

      if (!nftRes.ok || !partsRes.ok)
        throw new Error("Failed to fetch NFT or parts");

      nft = await nftRes.json();
      const parts = await partsRes.json();

      const owned = parts.filter((p) => p.owner === address);
      const unlisted = owned.filter((p) => !p.listing);

      userParts = owned.length;
      availableParts = unlisted.length;

      console.log("[GIFT] NFT loaded:", nft);
      console.log(
        "[GIFT] User owns",
        userParts,
        "parts,",
        availableParts,
        "available",
      );
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
    if (quantity < 1 || quantity > availableParts) {
      error = `You can gift between 1 and ${availableParts} parts`;
      return false;
    }
    error = "";
    return true;
  }

  function onShowMnemonic() {
    if (!validateInputs()) return; // ✅ run validation
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
      const wallet = getWalletFromMnemonic(mnemonic);
      if (wallet.address.toLowerCase() !== address.toLowerCase()) {
        error = "Mnemonic does not match the logged-in wallet";
        return;
      }

      // Step 1: Fetch parts
      const partListRes = await apiFetch(`/nfts/${nftId}/parts`);
      const allParts = await partListRes.json();

      const ownedUnlisted = allParts.filter(
        (p) => p.owner === address && !p.listing,
      );
      const selectedParts = ownedUnlisted.slice(0, quantity);
      const partHashes = selectedParts.map((p) => p._id);

      // Step 2: Prepare payload
      const gift = {
        giver: address,
        receiver,
        nftId,
        parts: partHashes,
      };
      console.log("[GIFT] Payload:", gift);

      // Step 3: Sign and send
      const res = await signedFetch(
        "/gifts",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(gift),
        },
        wallet,
      );

      if (!res.ok) throw new Error("Gift failed");

      success = "Gift created successfully!";
      showMnemonic = false;
      console.log("[GIFT] Gift creation success");
    } catch (e: any) {
      error = e.message || "Error creating gift";
      console.error("[GIFT] Error creating gift:", e);
    }
  }
</script>

<div class="max-w-md mx-auto p-4 space-y-4">
  {#if nft}
    <img src={nft.imageurl} alt="NFT Image" class="w-full aspect-square" />
    <div>
      <strong>{nft.name}</strong><br />
      Total parts: {nft.part_count}<br />
      You own: {userParts}<br />
      Available to gift: {availableParts}
    </div>

    <label>Quantity to gift</label>
    <input
      type="number"
      bind:value={quantity}
      min="1"
      max={availableParts}
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
        class="bg-blue-600 text-white px-4 py-2 w-full"
      >
        Gift
      </button>
      <p class="text-gray-700 text-s mt-2">
        Gifts are valid for 24 hours from creation.
      </p>
    {/if}
  {:else}
    <p>Loading NFT...</p>
  {/if}
</div>
