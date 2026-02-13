<script lang="ts">
  import { onMount } from "svelte";
  import { wallet } from "$lib/stores/wallet";
  import { get } from "svelte/store";
  import { goto } from "$app/navigation";
  import { signedFetch } from "$lib/signing";
  import { isSessionActive } from "$lib/walletActions";
  import SessionPasswordInput from "$lib/SessionPasswordInput.svelte";
  import SuccessPopup from "$lib/SuccessPopup.svelte";
  import ToggleSwitch from "$lib/ToggleSwitch.svelte";
  import { apiFetch } from "$lib/api";
  import PaginationControls from "$lib/PaginationControls.svelte";
  import TransactionActionButtons from "$lib/TransactionActionButtons.svelte";
  import ItemCard from "$lib/ItemCard.svelte";

  let address = "";
  let uploads: any[] = [];
  let loading = true;
  let error = "";
  let currentPage = 0;
  let totalUploads = 0;
  const pageSize = 5;
  let showActive = true;
  $: showCompleted = !showActive;
  let showSessionPasswordFor: { id: string; action: "cancel" } | null = null;
  let actionError = "";
  let successMessage = "";
  let showSuccessPopup = false;
  let processing = false;
  let copiedTxId: string | null = null;
  let profileStatus: 'none' | 'unconfirmed' | 'confirmed' | null = null;

  async function loadUploads(page: number, active: boolean) {
    if (!address) return;
    
    loading = true;
    error = "";
    try {
      const normalizedAddress = address.toLowerCase();
      const skip = page * pageSize;
      const endpoint = active
        ? `/uploads/user/${normalizedAddress}?skip=${skip}&limit=${pageSize}`
        : `/uploads/user/${normalizedAddress}/completed?skip=${skip}&limit=${pageSize}`;
      
      const res = await apiFetch(endpoint);
      if (!res.ok) throw new Error("Failed to fetch uploads");
      
      const data = await res.json();
      uploads = data.items || [];
      totalUploads = data.total || 0;
      currentPage = page;
    } catch (e: any) {
      error = e.message || "Error fetching uploads";
    } finally {
      loading = false;
    }
  }

  onMount(async () => {
    const addr = get(wallet).ethAddress;
    if (!addr) {
      goto("/login");
      return;
    }
    address = addr.toLowerCase();
    
    // Check profile status
    try {
      const res = await fetch(`/api/profile/${addr}`);
      if (res.ok) {
        const data = await res.json();
        const status = data.status?.toLowerCase();
        if (status === 'unconfirmed' || status === 'confirmed') {
          profileStatus = status;
          loading = false; // Set loading to false before loading uploads
          await loadUploads(0, true);
        } else {
          profileStatus = 'none';
          loading = false;
        }
      } else {
        profileStatus = 'none';
        loading = false;
      }
    } catch (e: any) {
      console.error('Error fetching profile:', e);
      profileStatus = 'none';
      loading = false;
    }
  });

  function handleToggleChange() {
    showActive = !showCompleted;
    loadUploads(0, showActive);
  }

  function formatDate(timestamp: Date | string | number) {
    const date = new Date(timestamp);
    return date.toLocaleDateString() + " " + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function getStatusLabel(status: string) {
    if (status === "PENDING") return "Pending";
    if (status === "CONFIRMED") return "Confirmed";
    if (status === "CANCELED") return "Canceled";
    if (status === "REFUSED") return "Refused";
    return status;
  }

  function getStatusColor(status: string) {
    if (status === "PENDING") return "text-yellow-600";
    if (status === "CONFIRMED") return "text-green-600";
    if (status === "CANCELED") return "text-red-600";
    if (status === "REFUSED") return "text-red-600";
    return "text-gray-600";
  }

  function getTxId(upload: any): string | null {
    return upload.transaction?._id || null;
  }

  function getArweaveTxId(upload: any): string | null {
    return upload.transaction?.arweaveTxId || null;
  }

  function copyTxHash(txId: string, arweaveTxId: string | null = null) {
    // Copy Transaction ID (not Arweave ID)
    navigator.clipboard.writeText(txId).then(() => {
      copiedTxId = txId;
      setTimeout(() => {
        copiedTxId = null;
      }, 2000);
    });
  }

  function openInArweave(arweaveTxId: string) {
    if (arweaveTxId) {
      window.open(`https://viewblock.io/arweave/tx/${arweaveTxId}`, '_blank');
    }
  }

  function viewImage(imageUrl: string) {
    if (imageUrl) {
      window.open(imageUrl, '_blank');
    }
  }

  function openSessionPassword(uploadId: string) {
    if (processing) return;
    if (!isSessionActive()) {
      actionError = "No active session. Please log in again.";
      return;
    }
    actionError = "";
    successMessage = "";
    showSuccessPopup = false;
    showSessionPasswordFor = { id: uploadId, action: "cancel" };
  }

  function cancelSessionPassword() {
    if (processing) return;
    showSessionPasswordFor = null;
    actionError = "";
    successMessage = "";
    showSuccessPopup = false;
  }

  async function confirmCancelSessionPassword(e: CustomEvent<{ password: string }>) {
    if (processing || !showSessionPasswordFor) return;
    processing = true;
    actionError = "";

    try {
      const uploadId = showSessionPasswordFor.id;
      const res = await signedFetch(`/uploads/${uploadId}`, {
        method: 'DELETE',
      }, e.detail.password);

      if (res.ok) {
        successMessage = "Upload canceled successfully!";
        showSuccessPopup = true;
        showSessionPasswordFor = null;
        
        // Reload uploads
        await loadUploads(currentPage, showActive);
      } else {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to cancel upload");
      }
    } catch (e: any) {
      actionError = e.message || "Error canceling upload";
    } finally {
      processing = false;
    }
  }

  const totalPages = Math.ceil(totalUploads / pageSize);
</script>

<div class="max-w-4xl mx-auto p-4">
  <div class="flex justify-between items-center mb-6">
    <h1 class="text-2xl font-bold">Uploads</h1>
    {#if profileStatus !== 'none'}
      <button
        on:click={() => goto('/uploads/new')}
        class="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded transition"
      >
        New Upload
      </button>
    {/if}
  </div>

  {#if loading && uploads.length === 0 && profileStatus === null}
    <p>Loading...</p>
  {:else if profileStatus === 'none'}
    <!-- Not verified - show message -->
    <div class="max-w-2xl mx-auto mt-8">
      <div class="bg-white border border-gray-300 rounded-lg p-6 shadow-sm">
        <h2 class="text-xl font-semibold mb-4">Uploads Available for Verified Photographers</h2>
        
        <div class="text-gray-700 space-y-4 mb-6">
          <p>
            The uploads feature is only available for verified photographers. 
            To get verified, you need to start the verification process on your profile page.
          </p>
          
          <p>
            Once you've started verification and uploaded your first photo, you'll be able to 
            manage your uploads here.
          </p>
        </div>
        
        <div class="mt-6">
          <button
            on:click={() => goto('/profile')}
            class="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded transition"
          >
            Go to Profile to Start Verification
          </button>
        </div>
      </div>
    </div>
  {:else}
    <ToggleSwitch bind:value={showCompleted} on:change={handleToggleChange} leftLabel="Active" rightLabel="Completed" />

    {#if loading && uploads.length === 0}
      <p>Loading your uploads...</p>
    {:else if error}
      <p class="text-red-600">{error}</p>
    {:else if uploads.length === 0}
      <p>You have no {showActive ? "active" : "completed"} uploads.</p>
    {:else}
    <div class="space-y-4">
      {#each uploads as upload}
        <ItemCard>
          <svelte:fragment slot="image">
            {#if upload.imageData || upload.imageUrl}
              <img
                src={upload.imageUrl || upload.imageData}
                alt={upload.name || "Upload"}
                class="w-20 h-20 sm:w-24 sm:h-24 object-cover flex-shrink-0"
              />
            {:else}
              <div class="w-20 h-20 sm:w-24 sm:h-24 bg-gray-200 flex items-center justify-center flex-shrink-0">
                <span class="text-gray-400 text-xs">No image</span>
              </div>
            {/if}
          </svelte:fragment>

          <svelte:fragment slot="title">
            {#if upload.name}
              <h3 class="font-semibold text-lg mb-2 truncate">{upload.name}</h3>
            {/if}
          </svelte:fragment>

          <svelte:fragment slot="info">
            <div class="text-sm space-y-1 text-gray-700">
              {#if upload.description}
                <div><span class="font-medium">Description:</span> {upload.description}</div>
              {/if}
              <div>
                <span class="font-medium">Status:</span> 
                <span class="{getStatusColor(upload.status)} font-semibold ml-1">
                  {getStatusLabel(upload.status)}
                </span>
              </div>
              <div><span class="font-medium">Created:</span> {formatDate(upload.time_created)}</div>
            </div>
          </svelte:fragment>

          <svelte:fragment slot="actions">
            {#if showActive}
              <!-- Active view: Cancel button -->
              {#if upload.status === "PENDING"}
                <button
                  on:click={() => openSessionPassword(upload._id)}
                  class="bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded transition text-sm w-full sm:w-auto"
                  disabled={processing}
                >
                  Cancel
                </button>
              {/if}
            {:else}
              <!-- Completed view: Copy Tx Hash and View Image buttons -->
              {#if getTxId(upload)}
                <TransactionActionButtons
                  txId={getTxId(upload)!}
                  arweaveTxId={getArweaveTxId(upload)}
                  {copiedTxId}
                  onCopyTxHash={copyTxHash}
                  onOpenInArweave={openInArweave}
                />
              {/if}
              {#if upload.imageUrl}
                <button
                  on:click={() => viewImage(upload.imageUrl)}
                  class="bg-orange-600 hover:bg-orange-700 text-white font-medium py-2 px-4 rounded transition text-sm w-full sm:w-auto"
                >
                  View Image
                </button>
              {/if}
            {/if}
          </svelte:fragment>
        </ItemCard>
      {/each}
    </div>

    <!-- Pagination -->
    <PaginationControls
      {currentPage}
      {totalPages}
      totalItems={totalUploads}
      {loading}
      onPrevious={() => loadUploads(currentPage - 1, showActive)}
      onNext={() => loadUploads(currentPage + 1, showActive)}
    />
    {/if}
  {/if}
</div>

<!-- Session Password Modal for Cancel -->
{#if showSessionPasswordFor}
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white p-6 rounded-lg max-w-md w-full mx-4">
      <h3 class="text-lg font-semibold mb-4">Confirm Cancel</h3>
      <SessionPasswordInput
        label="Enter your session password to cancel this upload:"
        error={actionError}
        success=""
        confirmText="Confirm"
        loading={processing}
        on:confirm={confirmCancelSessionPassword}
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
  bind:show={showSuccessPopup}
/>
