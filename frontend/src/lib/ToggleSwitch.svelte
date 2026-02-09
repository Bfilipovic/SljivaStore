<script lang="ts">
  import { createEventDispatcher } from "svelte";
  
  export let value: boolean = false;
  export let leftLabel: string = "Active";
  export let rightLabel: string = "Completed";
  
  const dispatch = createEventDispatcher();
  
  function toggle() {
    value = !value;
    dispatch("change");
  }
</script>

<div class="mb-4">
  <button
    type="button"
    role="switch"
    aria-checked={value}
    on:click={toggle}
    class="relative inline-flex h-10 w-48 border border-gray-300 rounded bg-white overflow-hidden focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
  >
    <!-- Active half -->
    <div class="flex-1 flex items-center justify-center transition-colors {value === false ? 'bg-gray-600 text-white' : 'bg-white text-gray-600'}">
      <span class="text-sm font-medium">{leftLabel}</span>
    </div>
    <!-- Completed half -->
    <div class="flex-1 flex items-center justify-center transition-colors {value === true ? 'bg-gray-600 text-white' : 'bg-white text-gray-600'}">
      <span class="text-sm font-medium">{rightLabel}</span>
    </div>
  </button>
</div>
