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
  let profileLoaded = false;

  onMount(async () => {
    const addr = get(wallet).ethAddress;
    if (!addr) {
      goto('/login');
      return;
    }

    // Load existing profile data
    try {
      const res = await fetch(`/api/profile/${addr}`);
      if (res.ok) {
        const data = await res.json();
        if (data.profile) {
          username = data.profile.username || '';
          biography = data.profile.biography || '';
          profileLoaded = true;
        } else {
          // No profile found, redirect to verify page
          goto('/profile/verify');
        }
      } else {
        error = 'Failed to load profile';
      }
    } catch (e: any) {
      console.error('Error loading profile:', e);
      error = e.message || 'Error loading profile';
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
        success = 'Profile updated successfully!';
        setTimeout(() => {
          goto('/profile');
        }, 2000);
      } else {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to update profile');
      }
    } catch (e: any) {
      error = e.message || 'Error updating profile';
      console.error('Profile update error:', e);
    } finally {
      loading = false;
      showPasswordInput = false;
    }
  }
</script>

{#if !profileLoaded && !error}
  <div class="max-w-2xl mx-auto p-4">
    <div class="text-center text-gray-600 mt-8">
      <p>Loading profile...</p>
    </div>
  </div>
{:else if error && !profileLoaded}
  <div class="max-w-2xl mx-auto p-4">
    <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
      {error}
    </div>
    <div class="mt-4">
      <button
        on:click={() => goto('/profile')}
        class="bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-6 rounded transition"
      >
        Back to Profile
      </button>
    </div>
  </div>
{:else}
  <ProfileForm
    bind:username
    bind:biography
    bind:loading
    bind:error
    bind:success
    bind:showPasswordInput
    title="Edit Profile Information"
    submitButtonText="Update Profile"
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
        {loading ? 'Updating...' : 'Update Profile'}
      </button>
    </div>
  </ProfileForm>
{/if}

