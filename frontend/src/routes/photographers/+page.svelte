<script lang="ts">
  import { onMount } from 'svelte';
  import { apiFetch } from '$lib/api';
  import { goto } from '$app/navigation';

  interface Photographer {
    username: string;
    profilepicture: string | null;
  }

  let loading = true;
  let photographers: Photographer[] = [];
  let total = 0;
  let error = '';
  let searchQuery = '';
  let currentPage = 1;
  const pageSize = 20;

  onMount(async () => {
    await loadPhotographers();
  });

  async function loadPhotographers() {
    loading = true;
    error = '';
    
    try {
      const skip = (currentPage - 1) * pageSize;
      const searchParam = searchQuery.trim() ? `&search=${encodeURIComponent(searchQuery.trim())}` : '';
      const res = await apiFetch(`/profile/photographers?skip=${skip}&limit=${pageSize}${searchParam}`);
      
      if (res.ok) {
        const data = await res.json();
        photographers = data.items || [];
        total = data.total || 0;
      } else {
        throw new Error('Failed to load photographers');
      }
    } catch (e: any) {
      console.error('Error loading photographers:', e);
      error = e.message || 'Error loading photographers';
      photographers = [];
      total = 0;
    } finally {
      loading = false;
    }
  }

  function handleSearch() {
    currentPage = 1; // Reset to first page when searching
    loadPhotographers();
  }

  function handleKeyPress(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      handleSearch();
    }
  }

  function goToPage(page: number) {
    currentPage = page;
    loadPhotographers();
  }

  function goToGallery(username: string) {
    goto(`/gallery/${username}`);
  }

  $: totalPages = Math.ceil(total / pageSize);
  $: hasNextPage = currentPage < totalPages;
  $: hasPrevPage = currentPage > 1;
</script>

<div class="max-w-4xl mx-auto p-4">
  <h1 class="text-2xl font-bold mb-6 text-center">Photographers</h1>

  <!-- Search Bar -->
  <div class="mb-6">
    <div class="flex gap-2">
      <input
        type="text"
        bind:value={searchQuery}
        on:keypress={handleKeyPress}
        placeholder="Search photographers by username..."
        class="flex-1 border border-gray-300 rounded px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <button
        on:click={handleSearch}
        class="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded transition"
      >
        Search
      </button>
    </div>
  </div>

  {#if loading}
    <div class="text-center text-gray-600 mt-8">
      <p>Loading photographers...</p>
    </div>
  {:else if error}
    <div class="text-center text-red-600 mt-8">
      <p>{error}</p>
    </div>
  {:else if photographers.length === 0}
    <div class="text-center text-gray-600 mt-8">
      <p>No photographers found.</p>
    </div>
  {:else}
    <!-- Photographers List -->
    <div class="bg-white border border-gray-300 rounded-lg p-6 shadow-sm mb-6">
      <div class="space-y-2">
        {#each photographers as photographer}
          <div
            class="flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer transition rounded"
            on:click={() => goToGallery(photographer.username)}
            role="button"
            tabindex="0"
            on:keypress={(e) => e.key === 'Enter' && goToGallery(photographer.username)}
          >
            <!-- Profile Photo -->
            {#if photographer.profilepicture}
              <img
                src={photographer.profilepicture}
                alt="{photographer.username} profile"
                class="w-12 h-12 rounded-full object-cover flex-shrink-0"
              />
            {:else}
              <div class="w-12 h-12 rounded-full bg-gray-300 flex-shrink-0 flex items-center justify-center">
                <span class="text-gray-500 text-xs">No photo</span>
              </div>
            {/if}
            <!-- Username -->
            <a
              href="/gallery/{photographer.username}"
              class="text-black hover:underline font-medium flex-1"
            >
              {photographer.username}
            </a>
          </div>
        {/each}
      </div>
    </div>

    <!-- Pagination -->
    {#if totalPages > 1}
      <div class="flex justify-center items-center gap-2 mt-6">
        <button
          on:click={() => goToPage(currentPage - 1)}
          disabled={!hasPrevPage}
          class="px-4 py-2 border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition"
        >
          Previous
        </button>
        
        <span class="text-gray-700 px-4">
          Page {currentPage} of {totalPages} ({total} total)
        </span>
        
        <button
          on:click={() => goToPage(currentPage + 1)}
          disabled={!hasNextPage}
          class="px-4 py-2 border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition"
        >
          Next
        </button>
      </div>
    {/if}
  {/if}
</div>
