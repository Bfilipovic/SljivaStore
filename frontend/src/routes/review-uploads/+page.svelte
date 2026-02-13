<script lang="ts">
  import { onMount } from "svelte";
  import { wallet } from "$lib/stores/wallet";
  import { get } from "svelte/store";
  import { goto } from "$app/navigation";
  import { apiFetch } from "$lib/api";

  let uploads: any[] = [];
  let loading = true;
  let error = "";
  let currentPage = 0;
  let totalUploads = 0;
  const pageSize = 5;

  async function loadUploads(page: number) {
    loading = true;
    error = "";
    try {
      const addr = get(wallet).ethAddress;
      if (!addr) return;
      
      // Pass admin address as query param
      const res = await apiFetch(`/uploads/pending?admin=${encodeURIComponent(addr)}`);
      if (!res.ok) throw new Error("Failed to fetch pending uploads");
      
      const data = await res.json();
      const allUploads = data.items || [];
      totalUploads = allUploads.length;
      
      // Client-side pagination
      const start = page * pageSize;
      const end = start + pageSize;
      uploads = allUploads.slice(start, end);
      currentPage = page;
    } catch (e: any) {
      error = e.message || "Error fetching uploads";
    } finally {
      loading = false;
    }
  }

  onMount(async () => {
    const addr = get(wallet).ethAddress;
    if (!addr) {
      goto("/login");
      return;
    }
    
    // Check if user is superadmin
    if (!get(wallet).isSuperAdmin) {
      error = "Access denied. Superadmin only.";
      return;
    }
    
    await loadUploads(0);
  });

  function formatDate(timestamp: Date | string | number) {
    const date = new Date(timestamp);
    return date.toLocaleDateString() + " " + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function reviewUpload(uploadId: string) {
    goto(`/review-uploads/${uploadId}`);
  }

  const totalPages = Math.ceil(totalUploads / pageSize);
</script>

<div class="max-w-4xl mx-auto p-4">
  <h1 class="text-2xl font-bold mb-6">Review Uploads</h1>

  {#if loading && uploads.length === 0}
    <p>Loading pending uploads...</p>
  {:else if error}
    <p class="text-red-600">{error}</p>
  {:else if uploads.length === 0}
    <p>No pending uploads to review.</p>
  {:else}
    <div class="space-y-4">
      {#each uploads as upload}
        <div class="border border-gray-300 p-4 bg-white shadow-sm hover:shadow-md transition">
          <div class="flex flex-col sm:flex-row gap-4">
            <!-- Image Preview -->
            {#if upload.imageData}
              <img
                src={upload.imageData}
                alt={upload.name || "Upload"}
                class="w-20 h-20 sm:w-24 sm:h-24 object-cover flex-shrink-0"
              />
            {:else}
              <div class="w-20 h-20 sm:w-24 sm:h-24 bg-gray-200 flex items-center justify-center flex-shrink-0">
                <span class="text-gray-400 text-xs">No image</span>
              </div>
            {/if}

            <!-- Upload Info -->
            <div class="flex-grow min-w-0">
              {#if upload.name}
                <h3 class="font-semibold text-lg mb-2 truncate">{upload.name}</h3>
              {/if}
              
              <div class="text-sm space-y-1 text-gray-700">
                {#if upload.description}
                  <div><span class="font-medium">Description:</span> {upload.description}</div>
                {/if}
                <div><span class="font-medium">Uploader:</span> <span class="font-mono text-xs">{upload.uploader}</span></div>
                <div><span class="font-medium">Created:</span> {formatDate(upload.time_created)}</div>
                <div><span class="font-medium">Status:</span> <span class="text-yellow-600 font-semibold">Pending</span></div>
              </div>
            </div>

            <!-- Action Button -->
            <div class="flex flex-col gap-2 sm:flex-shrink-0">
              <button
                on:click={() => reviewUpload(upload._id)}
                class="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded transition text-sm"
              >
                Review
              </button>
            </div>
          </div>
        </div>
      {/each}
    </div>

    <!-- Pagination -->
    {#if totalPages > 1}
      <div class="mt-6 flex justify-center gap-2">
        <button
          on:click={() => loadUploads(currentPage - 1)}
          disabled={currentPage === 0}
          class="px-4 py-2 border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
        >
          Previous
        </button>
        <span class="px-4 py-2 text-gray-700">
          Page {currentPage + 1} of {totalPages}
        </span>
        <button
          on:click={() => loadUploads(currentPage + 1)}
          disabled={currentPage >= totalPages - 1}
          class="px-4 py-2 border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
        >
          Next
        </button>
      </div>
    {/if}
  {/if}
</div>

