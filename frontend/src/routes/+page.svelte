<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import '../app.css'; // << this is critical


import type { NFT } from '$lib/types/nft';



  let nfts: NFT[] = [];
  let loading = true;
  let error = '';

  onMount(async () => {
    try {
      const res = await fetch('/nfts');
      if (!res.ok) throw new Error('Failed to fetch NFTs!');
      nfts = await res.json();
      console.log('NFTs:', nfts);
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

{#if loading}
  <p>Loading NFTs...</p>
{:else if error}
  <p style="color: red">{error}</p>
{:else}
  <ul>
    {#each nfts as nft}
      <li on:click={() => viewDetails(nft._id)} style="cursor: pointer; margin-bottom: 1rem;">
        <img src={nft.image} alt={nft.name} width="150" />
        <div>
          <strong>{nft.name}</strong> — {nft.price} ETH
          <br />
          Owner: {nft.owner}
        </div>
      </li>
    {/each}
  </ul>
{/if}
