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
    import { apiFetch } from "$lib/api";
    import { updateUserInfo } from "$lib/userInfo";

    let gifts: any[] = [];
    let nfts: Record<string, any> = {};
    let loading = true;
    let error = "";
    let address = "";
    let showSessionPasswordFor: { id: string; action: "accept" | "refuse" } | null =
        null;
    let actionError = "";
    let successMessage = "";
    let showSuccessPopup = false;
    let accepting = false;

    onMount(async () => {
        const addr = get(wallet).ethAddress;
        if (!addr) {
            goto("/login");
            return;
        }
        address = addr.toLowerCase();

        try {
            loading = true;

            // Fetch gifts
            const res = await apiFetch(`/gifts/${address}`);
            if (!res.ok) throw new Error("Failed to fetch gifts");
            const giftData = await res.json();
            gifts = giftData.gifts || [];

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
    });

    function shortHash(hash: string) {
        return hash.slice(0, 8) + "...";
    }

    function openSessionPassword(giftId: string, action: "accept" | "refuse") {
        if (accepting) return; // Prevent opening if already processing
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
        if (accepting) return; // Prevent canceling if processing
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
                // Claim gift (no blockchain transaction needed - everything stored on Arweave)
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
                // REFUSE
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
            
            // Show success popup, then reload after it closes
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
        // Refresh user info before reload to update gift count
        await updateUserInfo(address, true);
        // Reload page after popup closes
        window.location.reload();
    }

</script>

<div class="max-w-3xl mx-auto p-4">
    <h1 class="text-2xl font-bold mb-4">My Gifts</h1>

    {#if loading}
        <p>Loading your gifts...</p>
    {:else if error}
        <p class="text-red-600">{error}</p>
    {:else if gifts.length === 0}
        <p>You have no active gifts.</p>
    {:else}
        <div class="space-y-4">
            {#each gifts as gift}
                <div class="border p-4 flex items-center space-x-4">
                    <!-- NFT Thumbnail -->
                    <img
                        src={nfts[gift.nftId]?.imageurl || ""}
                        alt="NFT"
                        class="w-16 h-16 object-cover"
                    />
                    <div class="flex-grow">
                        <p>
                            <strong>NFT:</strong>
                            {nfts[gift.nftId]?.name || shortHash(gift.nftId)}
                        </p>
                        <p><strong>Giver:</strong> {shortHash(gift.giver)}</p>
                        <p><strong>Quantity:</strong> {gift.quantity}</p>
                    </div>
                    <div class="flex flex-col space-y-2">
                        <button
                            class="bg-green-600 text-white px-3 py-1 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={accepting}
                            on:click={() => openSessionPassword(gift._id, "accept")}
                        >
                            {accepting && showSessionPasswordFor?.id === gift._id && showSessionPasswordFor?.action === "accept" ? "Processing..." : "Accept"}
                        </button>
                        <button
                            class="bg-red-600 text-white px-3 py-1 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={accepting}
                            on:click={() => openSessionPassword(gift._id, "refuse")}
                        >
                            {accepting && showSessionPasswordFor?.id === gift._id && showSessionPasswordFor?.action === "refuse" ? "Processing..." : "Refuse"}
                        </button>
                    </div>
                </div>
            {/each}
        </div>
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
