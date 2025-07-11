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
  <div class="bg-gray-800 text-white p-4 rounded mb-6">
    <p><strong>User Hash:</strong> {$walletAddress}</p>
    <p><strong>Balance:</strong> {balance} ETH</p>
  </div>
{/if}

<h1>Your Personal NFTs</h1>

{#if loading}
  <p>Loading your NFTs...</p>
{:else if error}
  <p style="color: red">{error}</p>
{:else if nfts.length === 0}
  <p>You don’t own any NFTs yet.</p>
{:else}
  <ul>
    {#each nfts as nft}
      <li
        on:click={() => viewDetails(nft._id)}
        style="cursor: pointer; margin-bottom: 1rem;"
      >
        <img src={nft.imageurl} alt={nft.name} width="150" />
        <div>
          <strong>{nft.name}</strong> 
          <br />
          Creator: {nft.creator}
          <br />
          Parts: {nft.part_count}
        </div>
      </li>
    {/each}
  </ul>
{/if}
