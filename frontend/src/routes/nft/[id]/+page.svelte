<script lang="ts">
  import { page } from "$app/stores";
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { walletAddress } from "$lib/stores/wallet";
  import { get } from "svelte/store";
  import { NFT, Part } from "$lib/classes";
  import { apiFetch } from "$lib/api";
  import { linkifyMarkdown } from "$lib/util";

  let nftId = "";
  let nft: NFT | null = null;
  let parts: Part[] = [];
  let ownedParts: Part[] = [];

  let loading = true;
  let error = "";
  let buyError = "";
  let address = "";

  $: nftId = $page.params.id;

  onMount(async () => {
    try {
      const addr = get(walletAddress);
      if (!addr) {
        goto("/login");
        return;
      }
      address = addr.toLowerCase();

      const [nftRes, partsRes] = await Promise.all([
        apiFetch(`/nfts/${nftId}`),
        apiFetch(`/nfts/${nftId}/parts`),
      ]);

      if (!nftRes.ok) throw new Error("Failed to fetch NFT details");
      nft = new NFT(await nftRes.json());

      parts = (await partsRes.json()).map((p: any) => new Part(p));
      ownedParts = parts.filter((p) => p.owner.toLowerCase() === address);
    } catch (e: any) {
      error = e.message;
    } finally {
      loading = false;
    }
  });

  async function buyNFT() {
    buyError = "";
    buying = true;
    try {
      const res = await fetch(`/nfts/${nftId}/buy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          buyerAddress: address,
        }),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || "Purchase failed");
      }
      alert("Purchase successful!");
      goto("/");
    } catch (e: any) {
      buyError = e.message;
    } finally {
      buying = false;
    }
  }
</script>

{#if loading}
  <p class="text-center">Loading NFT details...</p>
{:else if error}
  <p class="text-center text-red-600">{error}</p>
{:else}
  <div class="flex justify-center px-4">
    <div class="max-w-2xl w-full text-center space-y-4">
      <img src={nft.imageurl} alt={nft.name} class="mx-auto" width="300" />
      <h2 class="text-xl font-bold">{nft.name}</h2>
      <p class="break-all">({nft._id})</p>
      <p>{@html linkifyMarkdown(nft.description)}</p>
      <p class="text-sm text-gray-600">creator: {nft.creator}</p>
      <p class="text-sm text-gray-600">parts: {nft.part_count}</p>

      {#if buyError}
        <p class="text-red-600">{buyError}</p>
      {/if}

      {#if ownedParts.length > 0}
        <div class="mt-6 border-t pt-4">
          <p class="font-semibold">
            You own {ownedParts.length} out of {parts.length} parts of this NFT
          </p>
          <ul class="mt-2 list-disc list-inside text-sm text-left inline-block">
            {#each ownedParts as part}
              <li>
                <a
                  href={`/part/${part._id}`}
                  class="break-all underline hover:text-blue-900 text-green-700 font-semibold"
                >
                  {part._id}
                </a>
                <span class="ml-1 text-green-600 font-bold">✔</span>
              </li>
            {/each}
          </ul>
        </div>
      {/if}
    </div>
  </div>
{/if}
