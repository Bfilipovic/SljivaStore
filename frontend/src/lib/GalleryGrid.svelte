<script lang="ts">
  export let gallery: any[] = [];
  export let loading: boolean = false;
  export let error: string = '';
</script>

<div class="bg-white border border-gray-300 rounded-lg p-6 shadow-sm">
  <h2 class="text-xl font-semibold mb-4">Gallery</h2>
  
  {#if loading}
    <p class="text-gray-600">Loading gallery...</p>
  {:else if error}
    <p class="text-red-600">{error}</p>
  {:else if gallery.length === 0}
    <p class="text-gray-600">No images in gallery yet.</p>
  {:else}
    <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
      {#each gallery as upload}
        <a
          href="/image/{upload._id}"
          class="relative group cursor-pointer block"
        >
          {#if upload.imageUrl}
            <img
              src={upload.imageUrl}
              alt={upload.name || 'Gallery image'}
              class="w-full aspect-square object-cover rounded border border-gray-300 hover:opacity-90 transition"
            />
          {:else if upload.imageData}
            <img
              src={upload.imageData}
              alt={upload.name || 'Gallery image'}
              class="w-full aspect-square object-cover rounded border border-gray-300 hover:opacity-90 transition"
            />
          {:else}
            <div class="w-full aspect-square bg-gray-200 rounded border border-gray-300 flex items-center justify-center">
              <span class="text-gray-400 text-xs">No image</span>
            </div>
          {/if}
          {#if upload.name}
            <div class="absolute bottom-0 left-0 right-0 bg-black bg-opacity-60 text-white text-xs p-2 rounded-b opacity-0 group-hover:opacity-100 transition">
              {upload.name}
            </div>
          {/if}
        </a>
      {/each}
    </div>
  {/if}
</div>

