<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { apiFetch } from '$lib/api';
  import { goto } from '$app/navigation';

  let loading = true;
  let upload: any = null;
  let error = '';

  $: uploadId = $page.params.id;

  onMount(async () => {
    if (!uploadId) {
      error = 'Image ID is required';
      loading = false;
      return;
    }

    await loadImage();
  });

  async function loadImage() {
    loading = true;
    error = '';
    
    try {
      const res = await apiFetch(`/uploads/${uploadId}`);
      if (res.ok) {
        upload = await res.json();
      } else if (res.status === 404) {
        error = 'Image not found';
      } else {
        throw new Error('Failed to load image');
      }
    } catch (e: any) {
      console.error('Error fetching image:', e);
      error = e.message || 'Error loading image';
    } finally {
      loading = false;
    }
  }

  function copyToClipboard(text: string, label: string) {
    navigator.clipboard.writeText(text).then(() => {
      // Could show a toast notification here
      alert(`${label} copied to clipboard!`);
    }).catch(err => {
      console.error('Failed to copy:', err);
      alert('Failed to copy to clipboard');
    });
  }

  function openInArweave(txId: string) {
    if (txId) {
      // Open in viewblock.io explorer to see transaction details, tags, and data
      window.open(`https://viewblock.io/arweave/tx/${txId}`, '_blank');
    }
  }

  $: imageUrl = upload?.imageUrl || upload?.imageData || null;
  $: uploadTxId = upload?.transaction?._id || null;
  $: uploadArweaveTxId = upload?.transaction?.arweaveTxId || null;
  $: imageArweaveTxId = upload?.imageArweaveTxId || null;
</script>

<div class="max-w-4xl mx-auto p-4">
  {#if loading}
    <div class="text-center text-gray-600 mt-8">
      <p>Loading image...</p>
    </div>
  {:else if error}
    <div class="text-center text-red-600 mt-8">
      <p>{error}</p>
      <button
        on:click={() => goto('/gallery')}
        class="mt-4 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded transition"
      >
        Back to Gallery
      </button>
    </div>
  {:else if upload}
    <div class="space-y-6">
      <!-- Image -->
      <div class="bg-white border border-gray-300 rounded-lg p-6 shadow-sm">
        {#if imageUrl}
          <img
            src={imageUrl}
            alt={upload.name || 'Image'}
            class="w-full max-w-2xl mx-auto rounded border border-gray-300"
          />
        {:else}
          <div class="w-full aspect-square bg-gray-200 rounded border border-gray-300 flex items-center justify-center">
            <span class="text-gray-400">No image available</span>
          </div>
        {/if}
      </div>

      <!-- Image Details -->
      <div class="bg-white border border-gray-300 rounded-lg p-6 shadow-sm">
        <h2 class="text-xl font-semibold mb-4">Image Details</h2>
        
        <div class="space-y-3">
          {#if upload.name}
            <div>
              <span class="font-medium text-gray-700">Name:</span>
              <span class="ml-2 text-gray-900">{upload.name}</span>
            </div>
          {/if}
          
          {#if upload.description}
            <div>
              <span class="font-medium text-gray-700">Description:</span>
              <p class="mt-1 text-gray-900 whitespace-pre-wrap">{upload.description}</p>
            </div>
          {/if}
          
          {#if upload.time_created}
            <div>
              <span class="font-medium text-gray-700">Uploaded:</span>
              <span class="ml-2 text-gray-900">
                {new Date(upload.time_created).toLocaleString()}
              </span>
            </div>
          {/if}
        </div>
      </div>

      <!-- Transaction Hashes -->
      <div class="bg-white border border-gray-300 rounded-lg p-6 shadow-sm">
        <h2 class="text-xl font-semibold mb-4">Transaction Information</h2>
        
        <div class="space-y-4">
          <!-- Upload Transaction Hash -->
          {#if uploadTxId}
            <div class="border border-gray-200 rounded p-4">
              <div class="font-medium text-gray-700 mb-2">Upload Transaction Hash</div>
              <div class="font-mono text-sm text-gray-900 break-all mb-3">{uploadTxId}</div>
              <div class="flex gap-2">
                <button
                  on:click={() => copyToClipboard(uploadTxId, 'Transaction hash')}
                  class="bg-gray-600 hover:bg-gray-700 text-white text-sm px-4 py-2 rounded transition"
                >
                  Copy Tx Hash
                </button>
                {#if uploadArweaveTxId}
                  <button
                    on:click={() => openInArweave(uploadArweaveTxId)}
                    class="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded transition"
                  >
                    Open in Arweave
                  </button>
                {/if}
              </div>
            </div>
          {/if}

          <!-- Image Upload Hash (Arweave) -->
          {#if imageArweaveTxId}
            <div class="border border-gray-200 rounded p-4">
              <div class="font-medium text-gray-700 mb-2">Image Upload Hash (Arweave)</div>
              <div class="font-mono text-sm text-gray-900 break-all mb-3">{imageArweaveTxId}</div>
              <div class="flex gap-2">
                <button
                  on:click={() => copyToClipboard(imageArweaveTxId, 'Image hash')}
                  class="bg-gray-600 hover:bg-gray-700 text-white text-sm px-4 py-2 rounded transition"
                >
                  Copy Tx Hash
                </button>
                <button
                  on:click={() => openInArweave(imageArweaveTxId)}
                  class="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded transition"
                >
                  Open in Arweave
                </button>
              </div>
            </div>
          {:else if imageUrl}
            <div class="text-gray-600 text-sm">
              Image Arweave transaction ID not available
            </div>
          {/if}
        </div>
      </div>
    </div>
  {/if}
</div>

