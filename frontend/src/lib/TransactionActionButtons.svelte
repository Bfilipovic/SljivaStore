<script lang="ts">
  export let txId: string;
  export let arweaveTxId: string | null = null;
  export let copiedTxId: string | null = null;
  export let onCopyTxHash: (txId: string, arweaveTxId: string | null) => void;
  export let onOpenInArweave: (arweaveTxId: string) => void;
</script>

{#if txId}
  {@const isCopied = copiedTxId === txId}
  <div class="flex flex-col gap-2">
    <button
      on:click={() => onCopyTxHash(txId, arweaveTxId)}
      class="text-white px-3 py-2 text-sm sm:text-base whitespace-nowrap transition-colors {isCopied ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-600 hover:bg-gray-700'}"
      title={isCopied ? "Copied!" : "Copy transaction hash"}
    >
      {#if isCopied}
        <span class="hidden sm:inline">Copied!</span>
        <span class="sm:hidden">✓</span>
      {:else}
        <span class="hidden sm:inline">Copy Tx Hash</span>
        <span class="sm:hidden">Copy</span>
      {/if}
    </button>
    {#if arweaveTxId}
      <button
        on:click={() => onOpenInArweave(arweaveTxId)}
        class="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 text-sm sm:text-base whitespace-nowrap transition flex items-center justify-center gap-1"
        title="Open in Arweave explorer"
      >
        <span class="hidden sm:inline">Open in Arweave</span>
        <span class="sm:hidden">Arweave</span>
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
        </svg>
      </button>
    {/if}
  </div>
{/if}

