<script lang="ts">
  export let visible: boolean = false;
  export let faqText: string = '';

  function close() {
    visible = false;
  }
</script>

{#if visible}
  <!-- Modal container - no dark overlay, just centered -->
  <div
    class="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
  >
    <!-- Modal box -->
    <div
      class="bg-white rounded-lg shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col pointer-events-auto border-2 border-gray-300"
      role="dialog"
      aria-modal="true"
      aria-labelledby="faq-title"
    >
      <!-- Header -->
      <div class="px-6 py-4 border-b border-gray-200 bg-gray-50">
        <h2 id="faq-title" class="text-2xl font-bold text-gray-900">
          Frequently Asked Questions
        </h2>
      </div>

      <!-- Scrollable content -->
      <div class="px-6 py-4 overflow-y-auto flex-1">
        <div class="text-gray-700 whitespace-pre-line leading-relaxed">
          {faqText || 'Loading...'}
        </div>
      </div>

      <!-- Footer with close button -->
      <div class="px-6 py-4 border-t border-gray-200 flex justify-end bg-gray-50">
        <button
          on:click={close}
          class="bg-gray-500 hover:bg-gray-600 text-white px-6 py-2 rounded transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  </div>
{/if}

