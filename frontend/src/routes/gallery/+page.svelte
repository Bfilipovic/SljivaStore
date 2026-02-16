<script lang="ts">
  import { onMount } from 'svelte';

  let loading = true;

  onMount(() => {
    // Placeholder for default gallery
    // In the future, this will be managed by admins
    loading = false;
  });
</script>

<div class="max-w-4xl mx-auto p-4">
  <h1 class="text-2xl font-bold mb-6 text-center">Gallery</h1>

  {#if loading}
    <div class="text-center text-gray-600 mt-8">
      <p>Loading gallery...</p>
    </div>
  {:else}
    <div class="bg-white border border-gray-300 rounded-lg p-6 shadow-sm">
      <p class="text-gray-600 text-center">
        Default gallery coming soon. This will be managed by admins.
      </p>
    </div>
  {/if}
</div>

