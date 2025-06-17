<script lang="ts">
  import { onMount } from 'svelte';
  import { walletAddress } from '$lib/stores/wallet';
  import { get } from 'svelte/store';
  import { goto } from '$app/navigation';

  import type { NFT } from '$lib/types/nft';

  let nfts: NFT[] = [];
  let loading = true;
  let error = '';

  onMount(async () => {
    const address = get(walletAddress);
    if (!address) {
      goto('/login');
      return;
    }

    try {
      const res = await fetch(`/nfts/owner/${address.toLowerCase()}`);
      if (!res.ok) throw new Error('Failed to fetch your NFTs');
      nfts = await res.json();
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
      <li on:click={() => viewDetails(nft._id)} style="cursor: pointer; margin-bottom: 1rem;">
        <img src={nft.image || nft.image} alt={nft.name} width="150" />
        <div>
          <strong>{nft.name}</strong> — {nft.price} ETH
          <br />
          Owner: {nft.owner}
        </div>
      </li>
    {/each}
  </ul>
{/if}
