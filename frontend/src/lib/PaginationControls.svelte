<script lang="ts">
  export let currentPage: number;
  export let totalPages: number;
  export let totalItems: number;
  export let loading: boolean = false;
  export let onPrevious: () => void;
  export let onNext: () => void;
</script>

{#if totalPages > 1}
  <div class="mt-6 flex justify-center items-center gap-4">
    <button
      on:click={onPrevious}
      disabled={currentPage === 0 || loading}
      class="px-4 py-2 bg-gray-600 text-white disabled:bg-gray-400 disabled:cursor-not-allowed hover:bg-gray-700"
    >
      Previous
    </button>
    
    <span class="text-sm text-gray-600">
      Page {currentPage + 1} of {totalPages} {totalItems !== undefined ? `(${totalItems} total)` : ''}
    </span>
    
    <button
      on:click={onNext}
      disabled={currentPage >= totalPages - 1 || loading}
      class="px-4 py-2 bg-gray-600 text-white disabled:bg-gray-400 disabled:cursor-not-allowed hover:bg-gray-700"
    >
      Next
    </button>
  </div>
{/if}

