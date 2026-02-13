<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { get } from 'svelte/store';
  import { wallet } from '$lib/stores/wallet';
  import { apiFetch } from '$lib/api';
  import ProfileDisplay from '$lib/ProfileDisplay.svelte';
  import GalleryGrid from '$lib/GalleryGrid.svelte';
  import { PROFILE_STATUS } from '$lib/statusConstants';

  let loading = true;
  let verificationStatus: 'none' | 'unconfirmed' | 'confirmed' | null = null;
  
  function normalizeStatus(status: string): 'none' | 'unconfirmed' | 'confirmed' {
    const upper = status?.toUpperCase();
    if (upper === PROFILE_STATUS.UNCONFIRMED) return 'unconfirmed';
    if (upper === PROFILE_STATUS.CONFIRMED) return 'confirmed';
    return PROFILE_STATUS.NONE;
  }
  let profileData: any = null;
  let error = '';
  let gallery: any[] = [];
  let galleryLoading = false;
  let galleryError = '';

  onMount(async () => {
    const addr = get(wallet).ethAddress;
    if (!addr) {
      goto('/login');
      return;
    }

    try {
      const res = await fetch(`/api/profile/${addr}`);
      if (res.ok) {
        const data = await res.json();
        verificationStatus = normalizeStatus(data.status || 'none');
        profileData = data.profile;
        
        // If verified, load gallery
        if (verificationStatus === 'confirmed') {
          await loadGallery(addr);
        }
      } else if (res.status === 404) {
        // If 404, user has no verification record
        verificationStatus = 'none';
        profileData = null;
      } else {
        throw new Error(`Failed to load profile: ${res.statusText}`);
      }
    } catch (e: any) {
      console.error('Error fetching profile:', e);
      // If it's a network error or 404, just set status to 'none'
      if (e.message?.includes('404') || e.message?.includes('Failed to fetch')) {
        verificationStatus = 'none';
        profileData = null;
        error = '';
      } else {
        error = e.message || 'Error loading profile';
        verificationStatus = 'none';
        profileData = null;
      }
    } finally {
      loading = false;
    }
  });

  async function loadGallery(address: string) {
    galleryLoading = true;
    galleryError = '';
    try {
      const res = await apiFetch(`/uploads/user/${normalizeAddress(address)}/gallery?skip=0&limit=50`);
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

  function startVerification() {
    goto('/profile/verify');
  }
</script>

<div class="max-w-4xl mx-auto p-4">
  <h1 class="text-2xl font-bold mb-6 text-center">Profile</h1>

  {#if loading}
    <div class="text-center text-gray-600 mt-8">
      <p>Loading profile...</p>
    </div>
  {:else if error}
    <div class="text-center text-red-600 mt-8">
      <p>{error}</p>
    </div>
  {:else if verificationStatus === 'none'}
    <!-- Not verified - show explanation and button -->
    <div class="max-w-2xl mx-auto mt-8">
      <div class="bg-white border border-gray-300 rounded-lg p-6 shadow-sm">
        <h2 class="text-xl font-semibold mb-4">Photographer Verification</h2>
        
        <div class="text-gray-700 space-y-4 mb-6">
          <p>
            Get verified as a photographer to showcase your work on our platform. 
            Verified photographers can upload their photos to create a portfolio that 
            will be displayed on the site.
          </p>
          
          <p>
            <strong>What is verification?</strong><br>
            Verification allows you to establish your identity as a photographer on our platform. 
            Once verified, you'll be able to upload photos that will be displayed in your portfolio 
            and can be viewed by other users.
          </p>
          
          <p>
            <strong>How does it work?</strong><br>
            To get verified, you'll need to provide some basic information about yourself 
            (username, biography, and email address). After submitting your verification request, 
            you'll need to upload at least one photo to complete the verification process. 
            Your first upload will be reviewed by our team before your verification is confirmed.
          </p>
        </div>
        
        <div class="mt-6">
          <button
            on:click={startVerification}
            class="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded transition"
          >
            Start Verification Process
          </button>
        </div>
      </div>
    </div>
  {:else if verificationStatus === 'unconfirmed'}
    <!-- Verification submitted but not confirmed yet -->
    <div class="max-w-2xl mx-auto mt-8">
      <div class="bg-yellow-50 border border-yellow-300 rounded-lg p-6 shadow-sm mb-6">
        <h2 class="text-xl font-semibold mb-4">Verification Pending</h2>
        
        <div class="text-gray-700 space-y-4 mb-6">
          <p class="font-semibold text-yellow-800">
            ⚠️ Your profile information is not visible to others yet.
          </p>
          
          <p>
            Your verification request has been submitted, but it's not yet complete. 
            To complete your verification, you need to upload at least one photo. 
            You can still edit your profile information before uploading your first photo.
          </p>
        </div>
        
        <div class="mt-6 flex gap-4">
          <button
            on:click={() => goto('/profile/edit')}
            class="bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-6 rounded transition"
          >
            Edit Info
          </button>
          <button
            on:click={() => goto('/uploads')}
            class="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded transition"
          >
            Finish Verifying
          </button>
        </div>
      </div>

      <!-- Profile Preview -->
      {#if profileData}
        <div class="bg-white border border-gray-300 rounded-lg p-6 shadow-sm">
          <h3 class="text-lg font-semibold mb-4">Profile Preview</h3>
          <p class="text-sm text-gray-600 mb-4 italic">
            This is how your profile will appear once your verification is confirmed.
          </p>
          
          <div class="space-y-3">
            <div>
              <span class="font-medium text-gray-700">Username:</span>
              <span class="ml-2">{profileData.username || 'N/A'}</span>
            </div>
            
            {#if profileData.fullName}
              <div>
                <span class="font-medium text-gray-700">Full Name:</span>
                <span class="ml-2">{profileData.fullName}</span>
              </div>
            {/if}
            
            <div>
              <span class="font-medium text-gray-700">Email:</span>
              <span class="ml-2">{profileData.email || 'N/A'}</span>
            </div>
            
            {#if profileData.country}
              <div>
                <span class="font-medium text-gray-700">Country:</span>
                <span class="ml-2">{profileData.country}</span>
              </div>
            {/if}
            
            {#if profileData.city}
              <div>
                <span class="font-medium text-gray-700">City:</span>
                <span class="ml-2">{profileData.city}</span>
              </div>
            {/if}
            
            {#if profileData.physicalAddress}
              <div>
                <span class="font-medium text-gray-700">Address:</span>
                <span class="ml-2">{profileData.physicalAddress}</span>
              </div>
            {/if}
            
            <div>
              <span class="font-medium text-gray-700">Biography:</span>
              <p class="mt-1 text-gray-600 whitespace-pre-wrap">{profileData.biography || 'N/A'}</p>
            </div>
          </div>
        </div>
      {/if}
    </div>
  {:else if verificationStatus === 'confirmed'}
    <!-- Verified - show profile info and gallery -->
    <div class="max-w-4xl mx-auto space-y-6">
      <ProfileDisplay {profileData} titleLevel="h2" />
      <GalleryGrid gallery={gallery} loading={galleryLoading} error={galleryError} />
    </div>
  {/if}
</div>
