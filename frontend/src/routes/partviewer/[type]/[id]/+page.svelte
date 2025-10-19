<script lang="ts">
  import { page } from "$app/stores";
  import { onMount } from "svelte";
  import { apiFetch } from "$lib/api";
  import { shorten } from "$lib/util";

  let type = "";
  let id = "";
  let owner = "";
  $: type = $page.params.type;
  $: id = $page.params.id;
  $: owner = $page.url.searchParams.get("owner") || "";

  let parts: any[] = [];
  let total = 0;
  let skip = 0;
  let limit = 50;
  let loading = true;
  let error = "";

  // derived
  $: currentPage = Math.floor(skip / limit) + 1;
  $: totalPages = Math.max(1, Math.ceil(total / limit));

async function loadParts() {
  loading = true;
  error = "";
  try {
    let endpoint = "";
    if (type === "listing") {
      endpoint = `/parts/listing/${id}?skip=${skip}&limit=${limit}`;
    } else if (type === "nft") {
      if (owner) {
        endpoint = `/parts/owner/${owner}/nft/${id}?skip=${skip}&limit=${limit}`;
      } else {
        endpoint = `/nfts/${id}/parts?skip=${skip}&limit=${limit}`;
      }
    } else {
      throw new Error("Unsupported type");
    }

    const res = await apiFetch(endpoint);
    if (!res.ok) throw new Error("Failed to load parts");
    const data = await res.json();
    total = data.total;
    parts = data.parts;
  } catch (e: any) {
    error = e.message;
  } finally {
    loading = false;
  }
}


  function goToPage(p: number) {
    if (p < 1 || p > totalPages) return;
    skip = (p - 1) * limit;
    loadParts();
  }

  onMount(loadParts);
</script>

<div class="max-w-4xl mx-auto p-4">
  <h1 class="text-2xl font-bold mb-4">
    {#if owner}
      Viewing parts owned by {shorten(owner)} for NFT {shorten(id)}
    {:else}
      Viewing parts for {type} {shorten(id)}
    {/if}
  </h1>

  {#if loading}
    <p>Loading parts…</p>
  {:else if error}
    <p class="text-red-600">{error}</p>
  {:else}
    <table class="w-full border border-gray-400 text-sm">
      <thead class="bg-gray-200">
        <tr>
          <th class="p-2 border border-gray-400">#</th>
          <th class="p-2 border border-gray-400">Part ID</th>
          <th class="p-2 border border-gray-400">Owner</th>
          <th class="p-2 border border-gray-400">Listing</th>
        </tr>
      </thead>
      <tbody>
        {#each parts as part, i}
          <tr class="odd:bg-gray-50 even:bg-white">
            <td class="p-2 border border-gray-300">{skip + i + 1}</td>
            <td class="p-2 border border-gray-300 font-mono">
  <a
    href={`/part/${part._id}`}
    class="text-blue-600 hover:underline"
  >
    {shorten(part._id, 8)}
  </a>
</td>

            <td class="p-2 border border-gray-300 font-mono">{shorten(part.owner, 8)}</td>
            <td class="p-2 border border-gray-300">
              {part.listing ? shorten(part.listing, 8) : "-"}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>

    <!-- Pagination controls -->
    <div class="flex justify-center items-center space-x-2 mt-4">
      <button on:click={() => goToPage(1)} disabled={currentPage === 1}
        class="px-3 py-1 border">« First</button>
      <button on:click={() => goToPage(currentPage - 1)} disabled={currentPage === 1}
        class="px-3 py-1 border">‹ Prev</button>
      <span>Page {currentPage} / {totalPages}</span>
      <button on:click={() => goToPage(currentPage + 1)} disabled={currentPage === totalPages}
        class="px-3 py-1 border">Next ›</button>
      <button on:click={() => goToPage(totalPages)} disabled={currentPage === totalPages}
        class="px-3 py-1 border">Last »</button>
    </div>
  {/if}
</div>
