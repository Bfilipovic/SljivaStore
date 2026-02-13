<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { apiFetch } from '$lib/api';
  import ProfileDisplay from '$lib/ProfileDisplay.svelte';
  import GalleryGrid from '$lib/GalleryGrid.svelte';

  let loading = true;
  let profileData: any = null;
  let notFound = false;
  let gallery: any[] = [];
  let galleryLoading = false;
  let galleryError = '';

  $: username = $page.params.username;

  onMount(async () => {
    if (!username) {
      notFound = true;
      loading = false;
      return;
    }

    await loadProfile();
  });

  async function loadProfile() {
    loading = true;
    notFound = false;
    
    try {
      const res = await fetch(`/api/profile/username/${username}`);
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'CONFIRMED' && data.profile) {
          profileData = data.profile;
          await loadGallery(data.profile.address);
        } else {
          notFound = true;
        }
      } else if (res.status === 404) {
        notFound = true;
      } else {
        // For other errors, also show not found to avoid exposing internal errors
        notFound = true;
      }
    } catch (e: any) {
      console.error('Error fetching profile:', e);
      // Show not found instead of error
      notFound = true;
    } finally {
      loading = false;
    }
  }

  async function loadGallery(address: string) {
    galleryLoading = true;
    galleryError = '';
    try {
      const res = await apiFetch(`/uploads/user/${address.toLowerCase()}/gallery?skip=0&limit=50`);
      if (res.ok) {
        const data = await res.json();
        gallery = data.items || [];
      } else {
        throw new Error('Failed to load gallery');
      }
    } catch (e: any) {
      galleryError = e.message || 'Error loading gallery';
      console.error('Error loading gallery:', e);
    } finally {
      galleryLoading = false;
    }
  }
</script>

<div class="max-w-4xl mx-auto p-4">
  {#if loading}
    <div class="text-center text-gray-600 mt-8">
      <p>Loading profile...</p>
    </div>
  {:else if notFound}
    <div class="max-w-2xl mx-auto mt-8">
      <div class="bg-white border border-gray-300 rounded-lg p-8 shadow-sm text-center">
        <h1 class="text-2xl font-semibold mb-4 text-gray-800">User Not Found</h1>
        <p class="text-gray-600 mb-6">
          The user <span class="font-mono font-medium text-gray-800">"{username}"</span> does not exist or is not verified.
        </p>
        <a
          href="/gallery"
          class="inline-block bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded transition"
        >
          Back to Gallery
        </a>
      </div>
    </div>
  {:else if profileData}
    <!-- Profile Information -->
    <div class="max-w-4xl mx-auto space-y-6">
      <ProfileDisplay {profileData} titleLevel="h1" />
      <GalleryGrid gallery={gallery} loading={galleryLoading} error={galleryError} />
    </div>
  {/if}
</div>

