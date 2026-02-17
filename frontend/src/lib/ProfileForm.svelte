<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import SessionPasswordInput from '$lib/SessionPasswordInput.svelte';
  import { sanitizeDescription, sanitizeUsername } from '$lib/utils/sanitize';

  export let username = '';
  export let biography = '';
  export let loading = false;
  export let error = '';
  export let success = '';
  export let showPasswordInput = false;
  export let title = 'Photographer Verification';
  export let submitButtonText = 'Submit Verification';

  const dispatch = createEventDispatcher();

  function validateForm(): boolean {
    if (!username.trim()) {
      error = 'Username is required';
      return false;
    }
    if (username.trim().length < 3) {
      error = 'Username must be at least 3 characters';
      return false;
    }
    if (!biography.trim()) {
      error = 'Biography is required';
      return false;
    }
    if (biography.trim().length < 10) {
      error = 'Biography must be at least 10 characters';
      return false;
    }
    return true;
  }

  function handlePasswordConfirm(e: CustomEvent<{ password: string }>) {
    if (validateForm()) {
      dispatch('submit', {
        password: e.detail.password,
        data: {
          username: sanitizeUsername(username, 50),
          biography: sanitizeDescription(biography, 1000),
        }
      });
    }
  }

  function handleSubmit() {
    error = '';
    if (validateForm()) {
      showPasswordInput = true;
    }
  }
</script>

<div class="max-w-2xl mx-auto p-4">
  <h1 class="text-2xl font-bold mb-6 text-center">{title}</h1>

  {#if showPasswordInput}
    <div class="bg-white border border-gray-300 rounded-lg p-6 shadow-sm mb-6">
      <SessionPasswordInput
        label="Enter your session password to sign the {title.toLowerCase()}:"
        error={error}
        success={success}
        on:confirm={handlePasswordConfirm}
        loading={loading}
      />
    </div>
  {:else}
    <div class="bg-white border border-gray-300 rounded-lg p-6 shadow-sm">
      <form on:submit|preventDefault={handleSubmit} class="space-y-6">
        <div>
          <label for="username" class="block text-sm font-medium text-gray-700 mb-1">
            Username *
          </label>
          <input
            id="username"
            type="text"
            bind:value={username}
            placeholder="Choose a username"
            class="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
            minlength="3"
            maxlength="50"
          />
          <p class="text-xs text-gray-500 mt-1">At least 3 characters</p>
        </div>

        <div>
          <label for="biography" class="block text-sm font-medium text-gray-700 mb-1">
            Biography *
          </label>
          <textarea
            id="biography"
            bind:value={biography}
            placeholder="Tell us about yourself and your photography..."
            rows="6"
            class="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
            minlength="10"
            maxlength="1000"
          ></textarea>
          <p class="text-xs text-gray-500 mt-1">At least 10 characters, up to 1000 characters</p>
        </div>

        {#if error}
          <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        {/if}

        {#if success}
          <div class="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
            {success}
          </div>
        {/if}

        <slot name="actions">
          <!-- Default actions if none provided -->
          <div class="flex gap-4">
            <button
              type="submit"
              class="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded transition disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading}
            >
              {loading ? 'Submitting...' : submitButtonText}
            </button>
          </div>
        </slot>
      </form>
    </div>
  {/if}
</div>

