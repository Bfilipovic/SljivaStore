<script lang="ts">
  import { onMount } from "svelte";
  import { walletAddress } from "$lib/stores/wallet";
  import { get } from "svelte/store";
  import { goto } from "$app/navigation";
  import { NFT, Part } from "$lib/classes";
  import { apiFetch } from "$lib/api";

  let address = "";
  let grouped: {
    [nftId: string]: {
      nft: NFT;
      ownedParts: Part[];
      availableParts: Part[];
    };
  } = {};
  let loading = true;
  let error = "";

  onMount(async () => {
    const addr = get(walletAddress);
    if (!addr) {
      goto("/login");
      return;
    }
    address = addr.toLowerCase();

    try {
      const partRes = await apiFetch(`/parts/owner/${address}`);
      if (!partRes.ok) throw new Error("Failed to apiFetch owned parts");
      const parts: Part[] = (await partRes.json()).map((p: any) => new Part(p));

      const byParent: { [hash: string]: Part[] } = {};
      for (const part of parts) {
        if (!byParent[part.parent_hash]) byParent[part.parent_hash] = [];
        byParent[part.parent_hash].push(part);
      }

      const nftIds = Object.keys(byParent);
      const nftResList = await Promise.all(
        nftIds.map((id) =>
          apiFetch(`/nfts/${id}`).then((r) => (r.ok ? r.json() : null)),
        ),
      );

      for (let i = 0; i < nftIds.length; i++) {
        const nft = nftResList[i] ? new NFT(nftResList[i]) : null;
        if (!nft) continue;
        const ownedParts = byParent[nft._id];
        const availableParts = ownedParts.filter((p) => !p.listing);
        grouped[nft._id] = { nft, ownedParts, availableParts };
      }
    } catch (e: any) {
      error = e.message;
    } finally {
      loading = false;
    }
  });

  function goToManage(id: string) {
    goto(`/manage/${id}`);
  }

  function goToNFT(id: string) {
    goto(`/nft/${id}`);
  }

  function sellParts(nftId: string) {
    goto(`/createListing/${nftId}`);
  }

  function giftParts(nftId: string) {
    goto(`/createGift/${nftId}`);
  }

  // helper to calculate owned percentage
  const getOwnershipPercent = (group) =>
    group.nft.part_count === 0
      ? 0
      : group.ownedParts.length / group.nft.part_count;
</script>

<h1 class="text-2xl font-bold text-center mb-6">Your NFT Parts</h1>

{#if loading}
  <p class="text-center">Loading...</p>
{:else if error}
  <p class="text-center text-red-600">{error}</p>
{:else if Object.keys(grouped).length === 0}
  <p class="text-center text-gray-600">You don’t own any NFT parts yet.</p>
{:else}
  <!-- grid: up to 4 items per row on large screens -->
  <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 px-4">
    {#each Object.values(grouped) as group}
      <div
        class="border border-gray-600 p-4 bg-transparent shadow hover:shadow-lg transition text-black"
      >
        <!-- NFT Image (square) -->
        <img
          src={group.nft.imageurl}
          alt={group.nft.name}
          class="w-full aspect-square"
        />

        <!-- Progress bar -->
        <div
          class="mt-3 relative h-5 w-full overflow-hidden flex text-xs font-bold text-white"
        >
          <!-- Green filled part -->
          <div
            class="bg-green-600 h-full flex items-center justify-center"
            style="width: {getOwnershipPercent(group) * 100}%"
          >
            {group.ownedParts.length}/{group.nft.part_count}
          </div>
          <!-- Red unfilled part -->
          <div
            class="bg-red-600 h-full"
            style="width: {(1 - getOwnershipPercent(group)) * 100}%"
          ></div>
        </div>

        <!-- NFT Info -->
        <div class=" text-sm space-y-1">
          <p class="text-lg font-semibold">{group.nft.name}</p>
          <p>Total parts: {group.nft.part_count}</p>
          <p>Owned: {group.ownedParts.length}</p>
          <p>Available: {group.availableParts.length}</p>
        </div>

        <!-- Buttons -->
        <div class="mt-4 flex justify-center">
          <button
            class="bg-gray-600 hover:bg-gray-700 text-white w-9/10 py-3 font-bold"
            on:click={() => goToManage(group.nft._id)}
          >
            Manage
          </button>
        </div>
      </div>
    {/each}
  </div>
{/if}
