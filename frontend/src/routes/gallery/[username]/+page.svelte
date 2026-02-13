<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { apiFetch } from '$lib/api';

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
      <div class="bg-white border border-gray-300 rounded-lg p-6 shadow-sm">
        <h1 class="text-2xl font-semibold mb-4">{profileData.username || 'Photographer'}</h1>
        
        <div class="space-y-4">
          {#if profileData.fullName}
            <div>
              <span class="font-medium text-gray-700">Full Name:</span>
              <span class="ml-2 text-gray-900">{profileData.fullName}</span>
            </div>
          {/if}
          
          {#if profileData.country || profileData.city}
            <div>
              <span class="font-medium text-gray-700">Location:</span>
              <span class="ml-2 text-gray-900">
                {[profileData.city, profileData.country].filter(Boolean).join(', ') || 'N/A'}
              </span>
            </div>
          {/if}
          
          {#if profileData.email}
            <div>
              <span class="font-medium text-gray-700">Email:</span>
              <span class="ml-2 text-gray-900">{profileData.email}</span>
            </div>
          {/if}
          
          {#if profileData.biography}
            <div>
              <span class="font-medium text-gray-700">Biography:</span>
              <p class="mt-1 text-gray-900 whitespace-pre-wrap">{profileData.biography}</p>
            </div>
          {/if}
        </div>
      </div>

      <!-- Gallery -->
      <div class="bg-white border border-gray-300 rounded-lg p-6 shadow-sm">
        <h2 class="text-xl font-semibold mb-4">Gallery</h2>
        
        {#if galleryLoading}
          <p class="text-gray-600">Loading gallery...</p>
        {:else if galleryError}
          <p class="text-red-600">{galleryError}</p>
        {:else if gallery.length === 0}
          <p class="text-gray-600">No images in gallery yet.</p>
        {:else}
          <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {#each gallery as upload}
              <div class="relative group cursor-pointer" on:click={() => upload.imageUrl && window.open(upload.imageUrl, '_blank')}>
                {#if upload.imageUrl}
                  <img
                    src={upload.imageUrl}
                    alt={upload.name || 'Gallery image'}
                    class="w-full aspect-square object-cover rounded border border-gray-300 hover:opacity-90 transition"
                  />
                {:else if upload.imageData}
                  <img
                    src={upload.imageData}
                    alt={upload.name || 'Gallery image'}
                    class="w-full aspect-square object-cover rounded border border-gray-300 hover:opacity-90 transition"
                  />
                {:else}
                  <div class="w-full aspect-square bg-gray-200 rounded border border-gray-300 flex items-center justify-center">
                    <span class="text-gray-400 text-xs">No image</span>
                  </div>
                {/if}
                {#if upload.name}
                  <div class="absolute bottom-0 left-0 right-0 bg-black bg-opacity-60 text-white text-xs p-2 rounded-b opacity-0 group-hover:opacity-100 transition">
                    {upload.name}
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>

