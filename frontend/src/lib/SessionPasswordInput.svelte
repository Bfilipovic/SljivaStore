<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  
  export let label = 'Enter your session password:';
  export let error = '';
  export let success = '';
  export let confirmText = 'Confirm';
  export let loading = false;
  export let isSetup = false; // If true, show password confirmation field
  export let autoFocus = true;

  let password = '';
  let confirmPassword = '';
  let localError = '';
  const dispatch = createEventDispatcher();

  function confirm() {
    localError = '';
    if (isSetup) {
      if (password.length < 6) {
        localError = 'Password must be at least 6 characters';
        dispatch('error', { message: localError });
        return;
      }
      if (password !== confirmPassword) {
        localError = 'Passwords do not match';
        dispatch('error', { message: localError });
        return;
      }
    }
    if (!password) {
      localError = 'Please enter a password';
      dispatch('error', { message: localError });
      return;
    }
    dispatch('confirm', { password });
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault(); // Prevent any form submission
      confirm();
    }
  }

  onMount(() => {
    if (autoFocus) {
      const el = document.getElementById('session-password-input');
      if (el) el.focus();
    }
  });
</script>

<div class="p-4 border bg-gray-50 max-w-md">
  <label for="session-password-input" class="block mb-1">{label}</label>
  
  {#if isSetup}
    <div class="mb-3">
      <input
        id="session-password-input"
        type="password"
        bind:value={password}
        placeholder="Enter session password (min 6 characters)"
        class="border p-2 w-full"
        on:keydown={handleKeydown}
        autocomplete="new-password"
      />
    </div>
    <div class="mb-3">
      <input
        id="session-password-confirm"
        type="password"
        bind:value={confirmPassword}
        placeholder="Confirm session password"
        class="border p-2 w-full"
        on:keydown={handleKeydown}
        autocomplete="new-password"
      />
    </div>
    <p class="text-sm text-gray-600 mb-3">
      This password will be used to unlock your wallet during this session. 
      You won't need to enter your mnemonic again until the session expires.
    </p>
  {:else}
    <div class="mb-3">
      <input
        id="session-password-input"
        type="password"
        bind:value={password}
        placeholder="Enter session password"
        class="border p-2 w-full"
        on:keydown={handleKeydown}
        autocomplete="current-password"
      />
    </div>
  {/if}

  {#if error || localError}
    <p class="text-red-600 text-sm mt-1">{error || localError}</p>
  {/if}
  {#if success}
    <p class="text-green-600 text-sm mt-1">{success}</p>
  {/if}
  
  <button 
    type="button"
    class="mt-3 bg-blue-600 text-white px-4 py-2 hover:bg-blue-700 w-full disabled:opacity-50 disabled:cursor-not-allowed" 
    on:click={confirm} 
    disabled={loading || (isSetup && (!password || !confirmPassword))}
  >
    {loading ? 'Processing...' : confirmText}
  </button>
  <slot name="actions" />
</div>

