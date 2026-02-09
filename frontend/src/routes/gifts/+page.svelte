<script lang="ts">
    import { onMount } from "svelte";
    import { get } from "svelte/store";
    import { wallet } from "$lib/stores/wallet";
    import { goto } from "$app/navigation";
    import {
        signedFetch,
        isSessionActive
    } from "$lib/walletActions";
    import SessionPasswordInput from "$lib/SessionPasswordInput.svelte";
    import SuccessPopup from "$lib/SuccessPopup.svelte";
    import ToggleSwitch from "$lib/ToggleSwitch.svelte";
    import { apiFetch } from "$lib/api";
    import { updateUserInfo } from "$lib/userInfo";

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

            // Fetch NFTs metadata
            const nftRes = await apiFetch("/nfts");
            if (!nftRes.ok) throw new Error("Failed to fetch NFTs");
            const nftList = await nftRes.json();
            for (const nft of nftList) nfts[nft._id] = nft;
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
        address = addr.toLowerCase();
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
        const textToCopy = arweaveTxId || txId;
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
                <div class="border border-gray-300 p-4 bg-white shadow-sm hover:shadow-md transition">
                    <div class="flex flex-col sm:flex-row gap-4">
                        <!-- NFT Image -->
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

                        <!-- Gift Info -->
                        <div class="flex-grow min-w-0">
                            {#if nfts[gift.nftId]?.name}
                                <h3 class="font-semibold text-lg mb-2 truncate">{nfts[gift.nftId].name}</h3>
                            {/if}
                            
                            <div class="text-sm space-y-1 text-gray-700">
                                <div><span class="font-medium">Giver:</span> {shortHash(gift.giver)}</div>
                                <div><span class="font-medium">Quantity:</span> {gift.quantity} part{gift.quantity > 1 ? "s" : ""}</div>
                                {#if !showActive}
                                    <div><span class="font-medium">Status:</span> {gift.status}</div>
                                {/if}
                            </div>
                        </div>

                        <!-- Action Buttons -->
                        <div class="flex items-start">
                            {#if showActive}
                                <div class="flex flex-col space-y-2">
                                    <button
                                        class="bg-green-600 text-white px-3 py-2 text-sm hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                                        disabled={accepting}
                                        on:click={() => openSessionPassword(gift._id, "accept")}
                                    >
                                        {accepting && showSessionPasswordFor?.id === gift._id && showSessionPasswordFor?.action === "accept" ? "Processing..." : "Accept"}
                                    </button>
                                    <button
                                        class="bg-red-600 text-white px-3 py-2 text-sm hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                                        disabled={accepting}
                                        on:click={() => openSessionPassword(gift._id, "refuse")}
                                    >
                                        {accepting && showSessionPasswordFor?.id === gift._id && showSessionPasswordFor?.action === "refuse" ? "Processing..." : "Refuse"}
                                    </button>
                                </div>
                            {:else}
                                {@const txHash = getTxHash(gift)}
                                {#if txHash}
                                    {@const isCopied = copiedTxId === gift.transaction?._id}
                                    <button
                                        class="text-white px-3 py-2 text-sm sm:text-base whitespace-nowrap transition-colors {isCopied ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-600 hover:bg-gray-700'}"
                                        on:click={() => copyTxHash(gift.transaction?._id || "", gift.transaction?.arweaveTxId || null)}
                                        title={isCopied ? "Copied!" : "Copy transaction hash"}
                                    >
                                        {#if isCopied}
                                            <span class="hidden sm:inline">Copied!</span>
                                            <span class="sm:hidden">✓</span>
                                        {:else}
                                            <span class="hidden sm:inline">Copy Tx Hash</span>
                                            <span class="sm:hidden">Copy</span>
                                        {/if}
                                    </button>
                                {/if}
                            {/if}
                        </div>
                    </div>
                </div>
            {/each}
        </div>

        <!-- Pagination -->
        {#if totalPages > 1}
            <div class="mt-6 flex justify-center items-center gap-4">
                <button
                    on:click={() => loadGifts(currentPage - 1, showActive)}
                    disabled={currentPage === 0 || loading}
                    class="px-4 py-2 bg-gray-600 text-white disabled:bg-gray-400 disabled:cursor-not-allowed hover:bg-gray-700"
                >
                    Previous
                </button>
                
                <span class="text-sm text-gray-600">
                    Page {currentPage + 1} of {totalPages} ({totalGifts} total)
                </span>
                
                <button
                    on:click={() => loadGifts(currentPage + 1, showActive)}
                    disabled={currentPage >= totalPages - 1 || loading}
                    class="px-4 py-2 bg-gray-600 text-white disabled:bg-gray-400 disabled:cursor-not-allowed hover:bg-gray-700"
                >
                    Next
                </button>
            </div>
        {/if}
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
