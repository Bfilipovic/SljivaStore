<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  
  export let message: string;
  export let visible: boolean = false;
  
  const dispatch = createEventDispatcher();
  
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  
  $: if (visible && message) {
    // Clear existing timeout
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    
    // Auto-hide after 3 seconds
    timeoutId = setTimeout(() => {
      visible = false;
      dispatch('close');
    }, 3000);
  }
  
  function handleClose() {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    visible = false;
    dispatch('close');
  }
  
  onMount(() => {
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  });
</script>

{#if visible && message}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" 
       on:click={handleClose}
       role="dialog"
       aria-modal="true"
       aria-labelledby="success-popup-title">
    <div class="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6" 
         on:click|stopPropagation>
      <div class="flex items-center space-x-4">
        <div class="flex-shrink-0">
          <svg class="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
          </svg>
        </div>
        <div class="flex-1">
          <h3 id="success-popup-title" class="text-lg font-semibold text-gray-900 mb-1">
            Success
          </h3>
          <p class="text-gray-700">{message}</p>
        </div>
      </div>
      <div class="mt-6 flex justify-end">
        <button
          class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
          on:click={handleClose}
        >
          OK
        </button>
      </div>
    </div>
  </div>
{/if}

