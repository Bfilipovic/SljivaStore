<script lang="ts">
  import { onMount } from "svelte";
  import { walletAddress } from "$lib/stores/wallet";
  import { get } from "svelte/store";
  import { goto } from "$app/navigation";
  import { getWalletBalance } from "$lib/walletActions";

  import type { NFT } from "$lib/types/nft";

  let nfts: NFT[] = [];
  let loading = true;
  let error = "";
  let balance = "";
  let address = "";

  onMount(async () => {
    const addressResult = get(walletAddress);
    if (!addressResult) {  
      goto("/login");
      return;
    }
    address = addressResult;

    try {
      const [nftRes, bal] = await Promise.all([
        fetch(`/nfts/creator/${address.toLowerCase()}`),
        getWalletBalance(address),
      ]);

      if (!nftRes.ok) throw new Error("Failed to fetch your NFTs");
      nfts = await nftRes.json();
      balance = bal;
    } catch (e: any) {
      error = e.message;
    } finally {
      loading = false;
    }
  });

  function viewDetails(id: string) {
    goto(`/nft/${id}`);
  }
</script>

{#if balance}
  <div class="bg-gray-800 text-white p-4  mb-6">
    <p><strong>User Hash:</strong> {$walletAddress}</p>
    <p><strong>Balance:</strong> {balance} ETH</p>
  </div>
{/if}


<div class="flex justify-center px-4">
  <div class="max-w-3xl w-full space-y-6">

    <h1 class="text-2xl font-bold text-center">Your Personal NFTs</h1>

    {#if loading}
      <p class="text-center">Loading your NFTs...</p>
    {:else if error}
      <p class="text-center text-red-600">{error}</p>
    {:else if nfts.length === 0}
      <p class="text-center text-gray-600">You don’t own any NFTs yet.</p>
    {:else}
      <ul class="space-y-4">
        {#each nfts as nft}
          <li
            on:click={() => viewDetails(nft._id)}
            class="flex items-center space-x-4 p-4 border  hover:shadow-md cursor-pointer transition"
          >
            <img src={nft.imageurl} alt={nft.name} class="w-24 h-24 object-cover " />
            <div class="text-sm">
              <p class="font-semibold">{nft.name}</p>
              <p class="text-gray-600">Creator: {nft.creator}</p>
              <p class="text-gray-600">Parts: {nft.part_count}</p>
            </div>
          </li>
        {/each}
      </ul>
    {/if}

  </div>
</div>
