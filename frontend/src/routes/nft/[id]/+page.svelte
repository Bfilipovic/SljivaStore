<script lang="ts">
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { walletAddress } from '$lib/stores/wallet';
  import { get } from 'svelte/store';

  let nftId = '';
  let nft = null;
  let parts = [];
  let ownedParts = [];

  let loading = true;
  let error = '';
  let buying = false;
  let buyError = '';
  let address = '';

  $: nftId = $page.params.id;

  onMount(async () => {
    try {
      const addr = get(walletAddress);
      if (!addr) {
        goto('/login');
        return;
      }
      address = addr.toLowerCase();

      const [nftRes, partsRes] = await Promise.all([
        fetch(`/nfts/${nftId}`),
        fetch(`/nfts/${nftId}/parts`)
      ]);

      if (!nftRes.ok) throw new Error('Failed to fetch NFT details');
      nft = await nftRes.json();

      parts = await partsRes.json();
      ownedParts = parts.filter(p => p.owner.toLowerCase() === address);
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
          buyerAddress: address
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
    <img src={nft.imageurl} alt={nft.name} width="300" />
    <h2>{nft.name} ({nft._id})</h2>
    <p>{nft.description}</p>
    <p>creator: {nft.creator}</p>
    <p>parts: {nft.part_count}</p>

    {#if buyError}
      <p style="color: red">{buyError}</p>
    {/if}

    <button on:click={buyNFT} disabled={buying}>
      {buying ? 'Buying...' : 'Buy this NFT'}
    </button>

    {#if ownedParts.length > 0}
      <div class="mt-6 border-t pt-4">
        <p class="font-semibold">
          You own {ownedParts.length} out of {parts.length} parts of this NFT
        </p>

        <ul class="mt-2 list-disc list-inside text-sm text-blue-700">
          {#each ownedParts as part}
            <li>
              <a href={`/part/${part._id}`} class="underline hover:text-blue-900">
                {part._id}
              </a>
            </li>
          {/each}
        </ul>
      </div>
    {/if}
  </div>
{/if}
