<script lang="ts">
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { walletAddress } from '$lib/stores/wallet';
  import { get } from 'svelte/store';
  import { NFT, Part } from '$lib/classes';

  let nftId = '';
  let nft: NFT | null = null;
  let parts: Part[] = [];
  let ownedParts: Part[] = [];

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
      const nftData = await nftRes.json();
      nft = new NFT(nftData);

      const partsData = await partsRes.json();
      parts = partsData.map((p: any) => new Part(p));
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

    <div class="mt-6 border-t pt-4">
      <p class="font-semibold">
        You own {ownedParts.length} out of {parts.length} parts of this NFT
      </p>
      <ul class="mt-2 list-disc list-inside text-sm">
        {#each parts as part}
          <li>
            <a href={`/part/${part._id}`}
              class="underline hover:text-blue-900 {part.owner.toLowerCase() === address ? 'text-green-700 font-semibold' : 'text-blue-700'}">
              {part._id}
            </a>
            {#if part.owner.toLowerCase() === address}
              <span class="ml-1 text-green-600 font-bold">✔</span>
            {/if}
          </li>
        {/each}
      </ul>
    </div>
  </div>
{/if}
