<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';

  let partId = '';
  let part = null;
  let nft = null;
  let error = '';
  let loading = true;

  $: partId = $page.params.id;

  onMount(async () => {
    try {
      const partRes = await fetch(`/nfts/part/${partId}`);
      if (!partRes.ok) throw new Error('Part not found');
      part = await partRes.json();

      const nftRes = await fetch(`/nfts/${part.parent_hash}`);
      if (!nftRes.ok) throw new Error('Parent NFT not found');
      nft = await nftRes.json();
    } catch (e: any) {
      error = e.message;
    } finally {
      loading = false;
    }
  });
</script>

{#if loading}
  <p>Loading part...</p>
{:else if error}
  <p class="text-red-600">{error}</p>
{:else}
  <div class="max-w-md mx-auto p-4 space-y-4">
    <img src={nft.imageurl} alt="NFT image" class="w-full rounded" />

    <div class="text-sm text-gray-700">
      <p>
        Part of: 
        <a href={`/nft/${part.parent_hash}`} class="text-blue-700 underline hover:text-blue-900">
          {part.parent_hash}
        </a>
      </p>
      <p>Owner: {part.owner}</p>
    </div>
  </div>
{/if}
