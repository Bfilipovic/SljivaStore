<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { get } from 'svelte/store';
  import { wallet } from '$lib/stores/wallet';
  import { apiFetch } from '$lib/api';
  import { signedFetch } from '$lib/signing';
  import SessionPasswordInput from '$lib/SessionPasswordInput.svelte';
  import { processImage } from '$lib/utils/imageProcessing';
  import { sanitizeText, sanitizeDescription } from '$lib/utils/sanitize';

  let loading = true;
  let profileStatus: 'none' | 'unconfirmed' | 'confirmed' | null = null;
  let nfts: any[] = [];
  let selectedNftId = '';
  let pictureName = '';
  let pictureDescription = '';
  let selectedFile: File | null = null;
  let filePreview = '';
  let processedImageDataCache = ''; // Store processed (metadata-stripped) image data
  let error = '';
  let success = '';
  let showPasswordInput = false;
  let password = '';
  let submitting = false;

  onMount(async () => {
    const addr = get(wallet).ethAddress;
    if (!addr) {
      goto('/login');
      return;
    }

    // Check profile status
    try {
      const res = await fetch(`/api/profile/${addr}`);
      if (res.ok) {
        const data = await res.json();
        profileStatus = data.status?.toLowerCase() === 'unconfirmed' || data.status?.toLowerCase() === 'confirmed' 
          ? data.status.toLowerCase() 
          : 'none';
        
        // If profile exists, load NFTs
        if (profileStatus !== 'none') {
          await loadNFTs(addr);
        }
      } else {
        profileStatus = 'none';
      }
    } catch (e: any) {
      console.error('Error fetching profile:', e);
      profileStatus = 'none';
    } finally {
      loading = false;
    }
  });

  async function loadNFTs(address: string) {
    try {
      const res = await apiFetch(`/uploads/nfts/${address}`);
      if (res.ok) {
        nfts = await res.json();
      }
    } catch (e: any) {
      console.error('Error loading NFTs:', e);
    }
  }

  async function handleFileSelect(e: Event) {
    const target = e.target as HTMLInputElement;
    const file = target.files?.[0];
    
    if (!file) return;

    // Check file size (10MB = 10 * 1024 * 1024 bytes)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      error = `File size must be less than 10MB (file is ${(file.size / (1024 * 1024)).toFixed(2)}MB)`;
      selectedFile = null;
      filePreview = '';
      return;
    }

    // Check if it's a JPG file by extension/MIME
    const fileName = file.name.toLowerCase();
    const isJpg = fileName.endsWith('.jpg') || fileName.endsWith('.jpeg');
    const isJpegMime = file.type === 'image/jpeg' || file.type === 'image/jpg';
    
    if (!isJpg && !isJpegMime) {
      error = 'Please select a JPG file (.jpg or .jpeg)';
      selectedFile = null;
      filePreview = '';
      return;
    }

    // Process image: verify magic bytes and strip metadata
    try {
      error = 'Processing image...';
      const processedImageData = await processImage(file, 10);
      
      // Create a new File object from the processed data for preview
      // We'll use the processed data directly in submission
      selectedFile = file; // Keep original for now, but we'll use processed data
      processedImageDataCache = processedImageData; // Store processed data
      error = '';
      
      // Create preview from processed image
      filePreview = processedImageData;
    } catch (e: any) {
      error = e.message || 'Failed to process image. Please ensure it is a valid JPG file.';
      selectedFile = null;
      filePreview = '';
      processedImageDataCache = '';
    }
  }

  function validateForm(): boolean {
    if (!pictureName.trim()) {
      error = 'Picture name is required';
      return false;
    }
    if (!pictureDescription.trim()) {
      error = 'Picture description is required';
      return false;
    }
    if (!selectedFile) {
      error = 'Please select an image file';
      return false;
    }
    if (!selectedNftId) {
      error = 'Please select an NFT to pay with';
      return false;
    }
    return true;
  }

  async function handlePasswordConfirm(e: CustomEvent<{ password: string }>) {
    password = e.detail.password;
    await submitUpload();
  }

  async function submitUpload() {
    if (!validateForm()) {
      return;
    }

    submitting = true;
    error = '';
    success = '';

    try {
      const addr = get(wallet).ethAddress;
      if (!addr || !selectedFile) {
        throw new Error('Missing required data');
      }

      // Use processed image data (metadata already stripped)
      if (!processedImageDataCache) {
        throw new Error('Image processing failed. Please try selecting the image again.');
      }

      const data = {
        name: sanitizeText(pictureName, 200),
        description: sanitizeDescription(pictureDescription, 1000),
        imageData: processedImageDataCache, // base64 encoded image (metadata stripped)
        nftId: selectedNftId,
      };

      const res = await signedFetch('/uploads', {
        method: 'POST',
        body: JSON.stringify(data),
      }, password);

      if (res.ok) {
        success = 'Upload request submitted successfully!';
        // Reset form
        pictureName = '';
        pictureDescription = '';
        selectedFile = null;
        filePreview = '';
        processedImageDataCache = '';
        selectedNftId = '';
        setTimeout(() => {
          goto('/profile');
        }, 2000);
      } else {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to submit upload');
      }
    } catch (e: any) {
      error = e.message || 'Error submitting upload';
      console.error('Upload error:', e);
    } finally {
      submitting = false;
      showPasswordInput = false;
      password = '';
    }
  }

  function handleSubmit() {
    error = '';
    if (validateForm()) {
      showPasswordInput = true;
    }
  }
</script>

<div class="max-w-4xl mx-auto p-4">
  <h1 class="text-2xl font-bold mb-6 text-center">Upload Photo</h1>

  {#if loading}
    <div class="text-center text-gray-600 mt-8">
      <p>Loading...</p>
    </div>
  {:else if profileStatus === 'none'}
    <!-- No verification started -->
    <div class="max-w-2xl mx-auto mt-8">
      <div class="bg-white border border-gray-300 rounded-lg p-6 shadow-sm">
        <h2 class="text-xl font-semibold mb-4">Verification Required</h2>
        
        <div class="text-gray-700 space-y-4 mb-6">
          <p>
            You need to start the verification process and enter your profile information 
            before you can upload photos.
          </p>
        </div>
        
        <div class="mt-6">
          <button
            on:click={() => goto('/profile/verify')}
            class="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded transition"
          >
            Start Verification Process
          </button>
        </div>
      </div>
    </div>
  {:else if showPasswordInput}
    <!-- Password input for signing -->
    <div class="max-w-2xl mx-auto mt-8">
      <div class="bg-white border border-gray-300 rounded-lg p-6 shadow-sm">
        <SessionPasswordInput
          label="Enter your session password to sign the upload request:"
          error={error}
          success={success}
          on:confirm={handlePasswordConfirm}
          loading={submitting}
        />
      </div>
    </div>
  {:else}
    <!-- Upload form -->
    <div class="max-w-2xl mx-auto mt-8">
      <div class="bg-white border border-gray-300 rounded-lg p-6 shadow-sm">
        <form on:submit|preventDefault={handleSubmit} class="space-y-6">
          <div>
            <label for="pictureName" class="block text-base font-medium text-gray-700 mb-1">
              Picture Name *
            </label>
            <input
              id="pictureName"
              type="text"
              bind:value={pictureName}
              placeholder="Enter picture name"
              class="w-full px-3 py-2 text-base border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
              maxlength="200"
            />
          </div>

          <div>
            <label for="pictureDescription" class="block text-base font-medium text-gray-700 mb-1">
              Picture Description *
            </label>
            <textarea
              id="pictureDescription"
              bind:value={pictureDescription}
              placeholder="Describe your photo..."
              rows="4"
              class="w-full px-3 py-2 text-base border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
              maxlength="1000"
            ></textarea>
          </div>

          <div>
            <label for="pictureFile" class="block text-base font-medium text-gray-700 mb-1">
              Picture File *
            </label>
            <input
              id="pictureFile"
              type="file"
              accept="image/jpeg,.jpg,.jpeg"
              on:change={handleFileSelect}
              class="w-full px-3 py-2 text-base border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            <p class="text-sm text-gray-500 mt-1">JPG files only, maximum 10MB</p>
            {#if filePreview}
              <div class="mt-2">
                <img src={filePreview} alt="Preview" class="max-w-xs max-h-48 object-contain border border-gray-300 rounded" />
              </div>
            {/if}
          </div>

          <div>
            <label for="nftSelect" class="block text-base font-medium text-gray-700 mb-1">
              Select NFT to Pay With *
            </label>
            {#if nfts.length === 0}
              <p class="text-gray-600 text-base mb-2">You don't have any NFTs with available parts to use for payment.</p>
            {:else}
              <div class="border border-gray-300 rounded max-h-60 overflow-y-auto">
                {#each nfts as nft}
                  <label
                    class="flex items-center gap-2 p-2 hover:bg-gray-50 cursor-pointer border-b border-gray-200 last:border-b-0"
                  >
                    <input
                      type="radio"
                      name="nftSelect"
                      value={nft._id}
                      bind:group={selectedNftId}
                      class="w-4 h-4 text-blue-600"
                    />
                    {#if nft.imageurl}
                      <img
                        src={nft.imageurl}
                        alt={nft.name || 'NFT'}
                        class="w-5 h-5 object-cover rounded flex-shrink-0"
                      />
                    {:else}
                      <div class="w-5 h-5 bg-gray-200 rounded flex-shrink-0 flex items-center justify-center">
                        <span class="text-gray-400 text-[8px]">No</span>
                      </div>
                    {/if}
                    <div class="flex-grow min-w-0">
                      <p class="font-medium text-gray-900 truncate text-base">
                        {nft.name || 'Unnamed NFT'} <span class="text-gray-600 font-normal">({nft.available} part{nft.available !== 1 ? 's' : ''} available)</span>
                      </p>
                    </div>
                  </label>
                {/each}
              </div>
            {/if}
          </div>

          {#if selectedNftId && nfts.length > 0}
            {@const selectedNft = nfts.find(n => n._id === selectedNftId)}
            {#if selectedNft}
              <div class="bg-gray-50 border border-gray-200 rounded p-4">
                <div class="flex items-center gap-4">
                  {#if selectedNft.imageurl}
                    <img
                      src={selectedNft.imageurl}
                      alt={selectedNft.name || 'NFT'}
                      class="w-16 h-16 object-cover rounded"
                    />
                  {/if}
                  <div>
                    <p class="font-medium">{selectedNft.name || 'Unnamed NFT'}</p>
                    <p class="text-sm text-gray-600">{selectedNft.available} part{selectedNft.available !== 1 ? 's' : ''} available</p>
                  </div>
                </div>
              </div>
            {/if}
          {/if}

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

          <div class="flex gap-4">
            <button
              type="button"
              on:click={() => goto('/profile')}
              class="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-6 rounded transition"
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              class="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded transition disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={submitting || nfts.length === 0}
            >
              {submitting ? 'Uploading...' : 'Upload Photo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  {/if}
</div>
