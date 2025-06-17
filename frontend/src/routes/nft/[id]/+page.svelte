<script lang="ts">
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';

  let nftId = '';
  let nft = null;
  let loading = true;
  let error = '';
  let buying = false;
  let buyError = '';

  $: nftId = $page.params.id;

import type { NFT } from '$lib/types/nft';

let nfts: NFT[] = [];

  onMount(async () => {
    try {
      const res = await fetch(`/nfts/${nftId}`);
      if (!res.ok) throw new Error('Failed to fetch NFT details');
      nft = await res.json();
    } catch (e: any) {
      error = e.message;
    } finally {
      loading = false;
    }
  });

  async function buyNFT() {
    buyError = '';
    buying = true;
    try {
      const res = await fetch(`/nfts/${nftId}/buy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // You can send buyer info or payment info here
          buyerAddress: '0x123...', 
          paymentAmountEth: nft.price,
        }),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || 'Purchase failed');
      }
      alert('Purchase successful!');
      goto('/');
    } catch (e: any) {
      buyError = e.message;
    } finally {
      buying = false;
    }
  }
</script>

{#if loading}
  <p>Loading NFT details...</p>
{:else if error}
  <p style="color: red">{error}</p>
{:else}
  <div>
    <img src={nft.image} alt={nft.name} width="300" />
    <h2>{nft.name}</h2>
    <p>{nft.description}</p>
    <p>Owner: {nft.owner}</p>
    <p>Price: {nft.price} ETH</p>

    {#if buyError}
      <p style="color: red">{buyError}</p>
    {/if}

    <button on:click={buyNFT} disabled={buying}>
      {buying ? 'Buying...' : 'Buy this NFT'}
    </button>
  </div>
{/if}
