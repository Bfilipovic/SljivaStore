<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { get } from 'svelte/store';
  import { wallet } from '$lib/stores/wallet';
  import { signedFetch } from '$lib/signing';
  import ProfileForm from '$lib/ProfileForm.svelte';

  let username = '';
  let biography = '';
  let loading = false;
  let error = '';
  let success = '';
  let showPasswordInput = false;

  onMount(() => {
    const addr = get(wallet).ethAddress;
    if (!addr) {
      goto('/login');
      return;
    }
  });

  async function handleSubmit(e: CustomEvent<{ password: string; data: any }>) {
    loading = true;
    error = '';
    success = '';

    try {
      const addr = get(wallet).ethAddress;
      if (!addr) {
        throw new Error('Not logged in');
      }

      const res = await signedFetch('/profile/verify', {
        method: 'POST',
        body: JSON.stringify(e.detail.data),
      }, e.detail.password);

      if (res.ok) {
        success = 'Verification request submitted successfully!';
        setTimeout(() => {
          goto('/profile');
        }, 2000);
      } else {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to submit verification');
      }
    } catch (e: any) {
      error = e.message || 'Error submitting verification';
      console.error('Verification error:', e);
    } finally {
      loading = false;
      showPasswordInput = false;
    }
  }
</script>

<ProfileForm
  bind:username
  bind:biography
  bind:loading
  bind:error
  bind:success
  bind:showPasswordInput
  title="Photographer Verification"
  submitButtonText="Submit Verification"
  on:submit={handleSubmit}
>
  <div slot="actions" class="flex gap-4">
    <button
      type="button"
      on:click={() => goto('/profile')}
      class="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-6 rounded transition"
      disabled={loading}
    >
      Cancel
    </button>
    <button
      type="submit"
      class="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded transition disabled:opacity-50 disabled:cursor-not-allowed"
      disabled={loading}
    >
      {loading ? 'Submitting...' : 'Submit Verification'}
    </button>
  </div>
</ProfileForm>

