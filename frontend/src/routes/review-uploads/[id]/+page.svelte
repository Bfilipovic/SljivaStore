<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { get } from 'svelte/store';
  import { wallet } from '$lib/stores/wallet';
  import { apiFetch } from '$lib/api';
  import { signedFetch } from '$lib/signing';
  import { isSessionActive } from '$lib/walletActions';
  import SessionPasswordInput from '$lib/SessionPasswordInput.svelte';
  import SuccessPopup from '$lib/SuccessPopup.svelte';
  import { shorten } from '$lib/util';
  import { UPLOAD_STATUS } from '$lib/statusConstants';

  let uploadId = '';
  let upload: any = null;
  let part: any = null;
  let nft: any = null;
  let profile: any = null;
  let loading = true;
  let error = '';
  let showSessionPasswordFor: 'accept' | 'refuse' | null = null;
  let actionError = '';
  let successMessage = '';
  let showSuccessPopup = false;
  let processing = false;

  $: uploadId = $page.params.id || '';

  onMount(async () => {
    const addr = get(wallet).ethAddress;
    if (!addr) {
      goto('/login');
      return;
    }

    // Check if user is admin
    if (!get(wallet).isAdmin) {
      error = 'Access denied. Admin access required.';
      loading = false;
      return;
    }

    await loadUploadDetails();
  });

  async function loadUploadDetails() {
    loading = true;
    error = '';

    try {
      // Load upload
      const uploadRes = await apiFetch(`/uploads/${uploadId}`);
      if (!uploadRes.ok) throw new Error('Upload not found');
      upload = await uploadRes.json();

      // Load part that was reserved for payment
      // The part has listing field set to uploadId
      const partsRes = await apiFetch(`/parts/listing/${uploadId}?skip=0&limit=1`);
      if (partsRes.ok) {
        const partsData = await partsRes.json();
        if (partsData.parts && partsData.parts.length > 0) {
          part = partsData.parts[0];
        }
      }

      // Load NFT - try part.parent_hash first, then upload.nftId (deduplicate to avoid fetching same NFT twice)
      const nftIdToFetch = part?.parent_hash || upload.nftId;
      if (nftIdToFetch && !nft) {
        const nftRes = await apiFetch(`/nfts/${nftIdToFetch}`);
        if (nftRes.ok) {
          nft = await nftRes.json();
        }
      }

      // Load uploader's profile
      if (upload.uploader) {
        const profileRes = await fetch(`/api/profile/${upload.uploader}`);
        if (profileRes.ok) {
          const profileData = await profileRes.json();
          profile = profileData.profile;
        }
      }
    } catch (e: any) {
      error = e.message || 'Error loading upload details';
      console.error('Error loading upload:', e);
    } finally {
      loading = false;
    }
  }

  function openSessionPassword(action: 'accept' | 'refuse') {
    if (processing) return;
    if (!isSessionActive()) {
      actionError = 'No active session. Please log in again.';
      return;
    }
    actionError = '';
    successMessage = '';
    showSuccessPopup = false;
    showSessionPasswordFor = action;
  }

  function cancelSessionPassword() {
    if (processing) return;
    showSessionPasswordFor = null;
    actionError = '';
    successMessage = '';
    showSuccessPopup = false;
  }

  async function confirmAction(e: CustomEvent<{ password: string }>) {
    if (processing || !showSessionPasswordFor) return;
    processing = true;
    actionError = '';

    try {
      const action = showSessionPasswordFor;
      const endpoint = action === 'accept' ? '/uploads/accept' : '/uploads/refuse';
      
      const res = await signedFetch(endpoint, {
        method: 'POST',
        body: JSON.stringify({ uploadId }),
      }, e.detail.password);

      if (res.ok) {
        successMessage = `Upload ${action === 'accept' ? 'accepted' : 'refused'} successfully!`;
        showSuccessPopup = true;
        showSessionPasswordFor = null;
        
        // Reload upload details or redirect
        setTimeout(() => {
          goto('/review-uploads');
        }, 2000);
      } else {
        const errorData = await res.json();
        throw new Error(errorData.error || `Failed to ${action} upload`);
      }
    } catch (e: any) {
      actionError = e.message || `Error ${showSessionPasswordFor === 'accept' ? 'accepting' : 'refusing'} upload`;
    } finally {
      processing = false;
    }
  }

  function formatDate(timestamp: Date | string | number) {
    const date = new Date(timestamp);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
</script>

<div class="max-w-4xl mx-auto p-4">
  <h1 class="text-2xl font-bold mb-6">Review Upload</h1>

  {#if loading}
    <p>Loading upload details...</p>
  {:else if error}
    <p class="text-red-600">{error}</p>
  {:else if !upload}
    <p>Upload not found.</p>
  {:else}
    <div class="space-y-6">
      <!-- Image Section -->
      <div class="bg-white border border-gray-300 rounded-lg p-6 shadow-sm">
        <h2 class="text-xl font-semibold mb-4">Image</h2>
        {#if upload.imageData}
          <img
            src={upload.imageData}
            alt={upload.name || 'Upload'}
            class="max-w-full max-h-96 object-contain mx-auto border border-gray-300 rounded"
          />
        {:else}
          <div class="bg-gray-200 p-8 text-center text-gray-500">
            No image available
          </div>
        {/if}
      </div>

      <!-- Upload Information -->
      <div class="bg-white border border-gray-300 rounded-lg p-6 shadow-sm">
        <h2 class="text-xl font-semibold mb-4">Upload Information</h2>
        <div class="space-y-3 text-base">
          <div>
            <span class="font-medium text-gray-700">Name:</span>
            <span class="ml-2">{upload.name || 'N/A'}</span>
          </div>
          <div>
            <span class="font-medium text-gray-700">Description:</span>
            <p class="mt-1 text-gray-600 whitespace-pre-wrap">{upload.description || 'N/A'}</p>
          </div>
          <div>
            <span class="font-medium text-gray-700">Uploader:</span>
            <span class="ml-2 font-mono text-sm">{upload.uploader}</span>
          </div>
          {#if profile}
            <div>
              <span class="font-medium text-gray-700">Uploader Username:</span>
              <span class="ml-2">{profile.username || 'N/A'}</span>
            </div>
            {#if profile.email}
              <div>
                <span class="font-medium text-gray-700">Email:</span>
                <span class="ml-2">{profile.email}</span>
              </div>
            {/if}
          {/if}
          <div>
            <span class="font-medium text-gray-700">Created:</span>
            <span class="ml-2">{formatDate(upload.time_created)}</span>
          </div>
          <div>
            <span class="font-medium text-gray-700">Status:</span>
            <span class="ml-2 text-yellow-600 font-semibold">Pending</span>
          </div>
        </div>
      </div>

      <!-- Payment Part Information -->
      {#if part && nft}
        <div class="bg-white border border-gray-300 rounded-lg p-6 shadow-sm">
          <h2 class="text-xl font-semibold mb-4">Payment Part</h2>
          <div class="flex flex-col sm:flex-row gap-4">
            <!-- NFT Image -->
            {#if nft.imageurl}
              <img
                src={nft.imageurl}
                alt={nft.name || 'NFT'}
                class="w-32 h-32 sm:w-40 sm:h-40 object-cover flex-shrink-0 rounded"
              />
            {:else}
              <div class="w-32 h-32 sm:w-40 sm:h-40 bg-gray-200 flex items-center justify-center flex-shrink-0 rounded">
                <span class="text-gray-400 text-xs">No image</span>
              </div>
            {/if}

            <!-- Part Info -->
            <div class="flex-grow space-y-2 text-base">
              <div>
                <span class="font-medium text-gray-700">NFT:</span>
                <span class="ml-2">{nft.name || 'Unnamed NFT'}</span>
              </div>
              <div>
                <span class="font-medium text-gray-700">Part Number:</span>
                <span class="ml-2">{part.part_no}</span>
              </div>
              <div>
                <span class="font-medium text-gray-700">Part ID:</span>
                <a
                  href={`/part/${part._id}`}
                  class="ml-2 font-mono text-sm text-blue-600 hover:underline"
                >
                  {shorten(part._id)}
                </a>
              </div>
              <div>
                <span class="font-medium text-gray-700">Current Owner:</span>
                <span class="ml-2 font-mono text-sm">{shorten(part.owner)}</span>
              </div>
            </div>
          </div>
        </div>
      {/if}

      <!-- Action Buttons -->
      <div class="bg-white border border-gray-300 rounded-lg p-6 shadow-sm">
        <div class="flex gap-4">
          <button
            on:click={() => openSessionPassword('accept')}
            class="flex-1 bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-6 rounded transition disabled:opacity-50"
            disabled={processing || upload.status !== UPLOAD_STATUS.PENDING}
          >
            Accept
          </button>
          <button
            on:click={() => openSessionPassword('refuse')}
            class="flex-1 bg-red-600 hover:bg-red-700 text-white font-medium py-3 px-6 rounded transition disabled:opacity-50"
            disabled={processing || upload.status !== UPLOAD_STATUS.PENDING}
          >
            Refuse
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>

<!-- Session Password Modal -->
{#if showSessionPasswordFor}
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white p-6 rounded-lg max-w-md w-full mx-4">
      <h3 class="text-lg font-semibold mb-4">
        {showSessionPasswordFor === 'accept' ? 'Accept Upload' : 'Refuse Upload'}
      </h3>
      <SessionPasswordInput
        label={showSessionPasswordFor === 'accept'
          ? 'Enter your session password to accept this upload:'
          : 'Enter your session password to refuse this upload:'}
        error={actionError}
        success=""
        confirmText="Confirm"
        loading={processing}
        on:confirm={confirmAction}
      />
      <button
        on:click={cancelSessionPassword}
        disabled={processing}
        class="mt-4 w-full bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded transition disabled:opacity-50"
      >
        Cancel
      </button>
    </div>
  </div>
{/if}

<SuccessPopup 
  message={successMessage} 
  bind:visible={showSuccessPopup}
/>

