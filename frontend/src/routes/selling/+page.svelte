<script lang="ts">
  import { onMount } from "svelte";
  import { walletAddress } from "$lib/stores/wallet";
  import { get } from "svelte/store";
  import { goto } from "$app/navigation";
  import { NFT, Part } from '$lib/classes';

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
      const partRes = await fetch(`/nfts/parts/owner/${address}`);
      if (!partRes.ok) throw new Error("Failed to fetch owned parts");
      const parts: Part[] = (await partRes.json()).map((p: any) => new Part(p));

      const byParent: { [hash: string]: Part[] } = {};
      for (const part of parts) {
        if (!byParent[part.parent_hash]) byParent[part.parent_hash] = [];
        byParent[part.parent_hash].push(part);
      }

      const nftIds = Object.keys(byParent);
      const nftResList = await Promise.all(
        nftIds.map(id => fetch(`/nfts/${id}`).then(r => r.ok ? r.json() : null))
      );

      for (let i = 0; i < nftIds.length; i++) {
        const nft = nftResList[i] ? new NFT(nftResList[i]) : null;
        if (!nft) continue;
        const ownedParts = byParent[nft._id];
        const availableParts = ownedParts.filter(p => !p.listing);
        grouped[nft._id] = { nft, ownedParts, availableParts };
      }
    } catch (e: any) {
      error = e.message;
    } finally {
      loading = false;
    }
  });

  function goToNFT(id: string) {
    goto(`/nft/${id}`);
  }

  function sellParts(nftId: string) {
    goto(`/createListing/${nftId}`);
  }
</script>

<h1>Your NFT Parts</h1>

{#if loading}
  <p>Loading...</p>
{:else if error}
  <p style="color: red">{error}</p>
{:else if Object.keys(grouped).length === 0}
  <p>You don’t own any NFT parts yet.</p>
{:else}
  <div class="grid gap-4">
    {#each Object.values(grouped) as group}
      <div class="border border-gray-600 p-4 rounded bg-gray-900 text-white">
        <img src={group.nft.imageurl} alt={group.nft.name} width="150" />
        <div class="mt-2">
          <strong>{group.nft.name}</strong><br />
          Total parts: {group.nft.part_count}<br />
          Owned: {group.ownedParts.length}<br />
          Available: {group.availableParts.length}
        </div>
        <div class="mt-3 flex gap-2">
          <button class="bg-green-600 text-white px-4 py-1 rounded" on:click={() => sellParts(group.nft._id)}>Sell</button>
          <button class="bg-gray-700 text-white px-4 py-1 rounded" on:click={() => goToNFT(group.nft._id)}>Info</button>
        </div>
      </div>
    {/each}
  </div>
{/if}
