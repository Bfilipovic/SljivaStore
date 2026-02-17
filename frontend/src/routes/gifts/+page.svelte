<script lang="ts">
    import { onMount } from "svelte";
    import { get } from "svelte/store";
    import { wallet } from "$lib/stores/wallet";
    import { goto } from "$app/navigation";
    import {
        isSessionActive
    } from "$lib/walletActions";
    import { signedFetch } from "$lib/signing";
    import SessionPasswordInput from "$lib/SessionPasswordInput.svelte";
    import SuccessPopup from "$lib/SuccessPopup.svelte";
    import ToggleSwitch from "$lib/ToggleSwitch.svelte";
    import { apiFetch } from "$lib/api";
    import { updateUserInfo } from "$lib/userInfo";
    import PaginationControls from "$lib/PaginationControls.svelte";
    import TransactionActionButtons from "$lib/TransactionActionButtons.svelte";
    import ItemCard from "$lib/ItemCard.svelte";
    import { normalizeAddress } from "$lib/utils/addressUtils";

    let gifts: any[] = [];
    let nfts: Record<string, any> = {};
    let loading = true;
    let error = "";
    let address = "";
    let currentPage = 0;
    let totalGifts = 0;
    const pageSize = 5;
    let showActive = true; // Toggle between active and completed
    $: showCompleted = !showActive; // Inverted for toggle switch
    let showSessionPasswordFor: { id: string; action: "accept" | "refuse" } | null =
        null;
    let actionError = "";
    let successMessage = "";
    let showSuccessPopup = false;
    let accepting = false;
    let copiedTxId: string | null = null;

    async function loadGifts(page: number, active: boolean) {
        if (!address) return;
        
        loading = true;
        error = "";
        try {
            const skip = page * pageSize;
            const endpoint = active 
                ? `/gifts/${address}?skip=${skip}&limit=${pageSize}`
                : `/gifts/${address}/completed?skip=${skip}&limit=${pageSize}`;
            
            const res = await apiFetch(endpoint);
            if (!res.ok) throw new Error("Failed to fetch gifts");
            const giftData = await res.json();
            gifts = giftData.gifts || [];
            totalGifts = giftData.total || 0;
            currentPage = page;

            // Fetch NFT details for all unique nftIds from gifts (deduplicate to avoid fetching same NFT multiple times)
            const nftIds = [...new Set(gifts.map(g => g.nftId).filter(Boolean))];
            const nftPromises = nftIds
                .filter(id => !nfts[id]) // Only fetch if not already cached
                .map(id => 
                    apiFetch(`/nfts/${id}`)
                        .then(r => r.ok ? r.json() : null)
                        .catch(() => null)
                );
            
            const nftResults = await Promise.allSettled(nftPromises);
            nftResults.forEach((result, i) => {
                if (result.status === "fulfilled" && result.value) {
                    nfts[nftIds[i]] = result.value;
                }
            });
        } catch (e: any) {
            error = e.message || "Error loading gifts";
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
        address = normalizeAddress(addr) || "";
        await loadGifts(0, true);
    });

    function handleToggleChange() {
        showActive = !showCompleted;
        loadGifts(0, showActive);
    }

    function shortHash(hash: string) {
        return hash.slice(0, 8) + "...";
    }

    function openSessionPassword(giftId: string, action: "accept" | "refuse") {
        if (accepting) return;
        if (!isSessionActive()) {
            actionError = "No active session. Please log in again.";
            return;
        }
        actionError = "";
        successMessage = "";
        showSuccessPopup = false;
        showSessionPasswordFor = { id: giftId, action };
    }

    function cancelSessionPassword() {
        if (accepting) return;
        showSessionPasswordFor = null;
        actionError = "";
        successMessage = "";
        showSuccessPopup = false;
    }

    async function confirmGiftSessionPassword(e: CustomEvent<{ password: string }>) {
        if (accepting) return;
        accepting = true;

        const sessionPassword = e.detail.password;

        try {
            if (!isSessionActive()) {
                actionError = "No active session. Please log in again.";
                accepting = false;
                return;
            }

            const gift = gifts.find((g) => g._id === showSessionPasswordFor?.id);
            if (!gift) throw new Error("Gift not found");

            if (showSessionPasswordFor?.action === "accept") {
                const res = await signedFetch(
                    "/gifts/claim",
                    {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            giftId: gift._id,
                        }),
                    },
                    sessionPassword,
                );

                if (!res.ok) {
                    const errJson = await res.json().catch(() => ({}));
                    throw new Error(errJson.error || "Failed to claim gift");
                }

                successMessage = "Gift claimed successfully!";
            } else {
                const res = await signedFetch(
                    "/gifts/refuse",
                    {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ giftId: gift._id }),
                    },
                    sessionPassword,
                );
                if (!res.ok) throw new Error("Failed to refuse gift");
                successMessage = "Gift refused successfully!";
            }

            showSessionPasswordFor = null;
            actionError = "";
            
            showSuccessPopup = true;
        } catch (e: any) {
            actionError = e.message || "Error processing gift";
            accepting = false;
        }
    }
    
    async function handleSuccessPopupClose() {
        showSuccessPopup = false;
        successMessage = "";
        accepting = false;
        await updateUserInfo(address, true);
        await loadGifts(currentPage, showActive);
    }

    const totalPages = Math.ceil(totalGifts / pageSize);

    async function copyTxHash(txId: string, arweaveTxId: string | null) {
        // Copy Transaction ID (not Arweave ID)
        const textToCopy = txId;
        try {
            await navigator.clipboard.writeText(textToCopy);
            copiedTxId = txId;
            setTimeout(() => {
                copiedTxId = null;
            }, 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    }

    function openInArweave(arweaveTxId: string) {
        if (arweaveTxId) {
            window.open(`https://viewblock.io/arweave/tx/${arweaveTxId}`, '_blank');
        }
    }

    function getTxHash(gift: any): string | null {
        if (gift.transaction?.arweaveTxId) {
            return gift.transaction.arweaveTxId;
        }
        if (gift.transaction?._id) {
            return gift.transaction._id;
        }
        return null;
    }
</script>

<div class="max-w-4xl mx-auto p-4">
    <h1 class="text-2xl font-bold mb-6">My Gifts</h1>

    <ToggleSwitch bind:value={showCompleted} on:change={handleToggleChange} leftLabel="Active" rightLabel="Completed" />

    {#if loading}
        <p>Loading your gifts...</p>
    {:else if error}
        <p class="text-red-600">{error}</p>
    {:else if gifts.length === 0}
        <p>You have no {showActive ? "active" : "completed"} gifts.</p>
    {:else}
        <div class="space-y-4">
            {#each gifts as gift}
                <ItemCard>
                    <svelte:fragment slot="image">
                        {#if nfts[gift.nftId]?.imageurl}
                            <img
                                src={nfts[gift.nftId].imageurl}
                                alt={nfts[gift.nftId].name || "NFT"}
                                class="w-20 h-20 sm:w-24 sm:h-24 object-cover flex-shrink-0"
                            />
                        {:else}
                            <div class="w-20 h-20 sm:w-24 sm:h-24 bg-gray-200 flex items-center justify-center flex-shrink-0">
                                <span class="text-gray-400 text-xs">Loading...</span>
                            </div>
                        {/if}
                    </svelte:fragment>

                    <svelte:fragment slot="title">
                        {#if nfts[gift.nftId]?.name}
                            <h3 class="font-semibold text-lg mb-2 truncate">{nfts[gift.nftId].name}</h3>
                        {/if}
                    </svelte:fragment>

                    <svelte:fragment slot="info">
                        <div class="text-sm space-y-1 text-gray-700">
                            <div><span class="font-medium">Giver:</span> {shortHash(gift.giver)}</div>
                            <div><span class="font-medium">Quantity:</span> {gift.quantity} part{gift.quantity > 1 ? "s" : ""}</div>
                            {#if !showActive}
                                <div><span class="font-medium">Status:</span> {gift.status}</div>
                            {/if}
                        </div>
                    </svelte:fragment>

                    <svelte:fragment slot="actions">
                        {#if showActive}
                            <div class="flex flex-col space-y-2 w-full sm:w-auto">
                                <button
                                    class="bg-green-600 text-white px-4 py-2 text-sm hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap w-full sm:w-auto"
                                    disabled={accepting}
                                    on:click={() => openSessionPassword(gift._id, "accept")}
                                >
                                    {accepting && showSessionPasswordFor?.id === gift._id && showSessionPasswordFor?.action === "accept" ? "Processing..." : "Accept"}
                                </button>
                                <button
                                    class="bg-red-600 text-white px-4 py-2 text-sm hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap w-full sm:w-auto"
                                    disabled={accepting}
                                    on:click={() => openSessionPassword(gift._id, "refuse")}
                                >
                                    {accepting && showSessionPasswordFor?.id === gift._id && showSessionPasswordFor?.action === "refuse" ? "Processing..." : "Refuse"}
                                </button>
                            </div>
                        {:else}
                            {#if gift.transaction?._id}
                                <TransactionActionButtons
                                    txId={gift.transaction._id}
                                    arweaveTxId={gift.transaction?.arweaveTxId || null}
                                    {copiedTxId}
                                    onCopyTxHash={copyTxHash}
                                    onOpenInArweave={openInArweave}
                                />
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
            totalItems={totalGifts}
            {loading}
            onPrevious={() => loadGifts(currentPage - 1, showActive)}
            onNext={() => loadGifts(currentPage + 1, showActive)}
        />
    {/if}

    {#if showSessionPasswordFor}
        <SessionPasswordInput
            label={showSessionPasswordFor.action === "accept"
                ? "Enter your session password to accept this gift."
                : "Enter your session password to refuse this gift."}
            error={actionError}
            success=""
            loading={accepting}
            confirmText="Confirm"
            on:confirm={confirmGiftSessionPassword}
            on:error={(e) => { actionError = e.detail.message; }}
        >
            <div slot="actions" class="flex space-x-4 mt-2">
                <button
                    class="bg-gray-400 px-4 py-2 flex-grow"
                    on:click={cancelSessionPassword}
                >
                    Cancel
                </button>
            </div>
        </SessionPasswordInput>
    {/if}
</div>

<SuccessPopup 
  message={successMessage} 
  bind:visible={showSuccessPopup}
  on:close={handleSuccessPopupClose}
/>
