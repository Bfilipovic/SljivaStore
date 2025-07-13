<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  export let label = 'Enter your 12-word mnemonic:';
  export let error = '';
  export let success = '';
  export let confirmText = 'Confirm';
  export let loading = false;
  export let timer: number | null = null;
  export let autoFocus = true;

  let words: string[] = Array(12).fill('');
  const dispatch = createEventDispatcher();

  function handlePaste(event: ClipboardEvent) {
    const pasted = event.clipboardData && event.clipboardData.getData('text') || '';
    const split = pasted.trim().split(/\s+/);
    if (split.length === 12) {
      words = split;
      event.preventDefault();
    }
  }

  function onInput(i: number, e: Event) {
    words[i] = (e.target as HTMLInputElement).value;
  }

  function confirm() {
    dispatch('confirm', { words });
  }

  onMount(() => {
    if (autoFocus) {
      const el = document.getElementById('mnemonic-word-0');
      if (el) el.focus();
    }
  });
</script>

<div class="p-4 border rounded bg-gray-50 max-w-md">
  {#if timer !== null}
    <p class="text-red-600 font-semibold mb-2">You have {timer} seconds to confirm.</p>
  {/if}
  <label class="block mb-1">{label}</label>
  <div class="grid grid-cols-3 gap-2 mb-4">
    {#each words as word, i}
      <input
        id={`mnemonic-word-${i}`}
        type="text"
        bind:value={words[i]}
        placeholder={`Word ${i + 1}`}
        class="border p-2 rounded w-full"
        on:paste={i === 0 ? handlePaste : undefined}
        on:input={(e) => onInput(i, e)}
        autocomplete="off"
      />
    {/each}
  </div>
  {#if error}
    <p class="text-red-600 text-sm mt-1">{error}</p>
  {/if}
  {#if success}
    <p class="text-green-600 text-sm mt-1">{success}</p>
  {/if}
  <button class="mt-3 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 w-full" on:click={confirm} disabled={loading}>
    {loading ? 'Processing...' : confirmText}
  </button>
  <slot name="actions" />
</div>
