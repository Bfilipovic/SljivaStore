<script lang="ts">
    import { onMount } from "svelte";
    import { get } from "svelte/store";
    import { wallet } from "$lib/stores/wallet";
    import { goto } from "$app/navigation";
    import {
        createETHTransaction,
        signedFetch,
        getCurrentTxCost,

        mnemonicMatchesLoggedInWallet

    } from "$lib/walletActions";
    import MnemonicInput from "$lib/MnemonicInput.svelte";
    import { apiFetch } from "$lib/api";
    import { updateUserInfo } from "$lib/userInfo";

    let gifts: any[] = [];
    let nfts: Record<string, any> = {};
    let loading = true;
    let error = "";
    let address = "";
    let showMnemonicFor: { id: string; action: "accept" | "refuse" } | null =
        null;
    let actionError = "";
    let actionSuccess = "";
    let accepting = false;
    let gasCost: string | null = null;   // ✅ gas estimate

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

            // ✅ fetch gas cost once
            gasCost = await getCurrentTxCost();
        } catch (e: any) {
            error = e.message || "Error loading gifts";
        } finally {
            loading = false;
        }
    });

    function shortHash(hash: string) {
        return hash.slice(0, 8) + "...";
    }

    function openMnemonic(giftId: string, action: "accept" | "refuse") {
        actionError = "";
        actionSuccess = "";
        showMnemonicFor = { id: giftId, action };
    }

    function cancelMnemonic() {
        showMnemonicFor = null;
        actionError = "";
        actionSuccess = "";
    }

    async function confirmGiftMnemonic(e) {
        if (accepting) return;
        accepting = true;

        const words = e.detail.words;
        if (words.some((w) => w.trim() === "")) {
            actionError = "Please enter all 12 words";
            accepting = false;
            return;
        }

        try {
            const mnemonic = words.join(" ").trim();
            if (!mnemonicMatchesLoggedInWallet(mnemonic)) {
                error = "Mnemonic does not match the logged-in wallet";
                return;
            }

            const gift = gifts.find((g) => g._id === showMnemonicFor?.id);
            if (!gift) throw new Error("Gift not found");

            if (showMnemonicFor?.action === "accept") {
                // 1. Send 0 ETH transaction to giver
                const chainTx = await createETHTransaction(
                    gift.giver,
                    "0",
                    mnemonic,
                );
                if (!chainTx) {
                    actionError = "Failed to send transaction";
                    return;
                }

                // 2. Notify backend
                const res = await signedFetch(
                    "/gifts/claim",
                    {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            giftId: gift._id,
                            chainTx,
                        }),
                    },
                    mnemonic,
                );

                if (!res.ok) {
                    const errJson = await res.json().catch(() => ({}));
                    throw new Error(errJson.error || "Failed to claim gift");
                }

                actionSuccess = "Gift claimed successfully!";
            } else {
                // REFUSE
                const res = await signedFetch(
                    "/gifts/refuse",
                    {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ giftId: gift._id }),
                    },
                    mnemonic,
                );
                if (!res.ok) throw new Error("Failed to refuse gift");
                actionSuccess = "Gift refused successfully!";
            }

            setTimeout(() => window.location.reload(), 1000);
            showMnemonicFor = null;
        } catch (e: any) {
            actionError = e.message || "Error processing gift";
        } finally {
            accepting = false;
            updateUserInfo(address, true); // Refresh user info
        }
    }

    function hoursUntilExpiration(expireDate: string | Date) {
        const exp = new Date(expireDate).getTime();
        const now = Date.now();
        const diffMs = exp - now;
        if (diffMs <= 0) return "expired";
        const hours = Math.floor(diffMs / (1000 * 60 * 60));
        const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
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
                        <p><strong>Quantity:</strong> {gift.parts.length}</p>
                        <p class="text-xs text-gray-500">
                            Expires in {hoursUntilExpiration(gift.expires)}
                        </p>
                    </div>
                    <div class="flex flex-col space-y-2">
                        <button
                            class="bg-green-600 text-white px-3 py-1 hover:bg-green-700"
                            on:click={() => openMnemonic(gift._id, "accept")}
                        >
                            Accept
                        </button>
                        <button
                            class="bg-red-600 text-white px-3 py-1 hover:bg-red-700"
                            on:click={() => openMnemonic(gift._id, "refuse")}
                        >
                            Refuse
                        </button>
                    </div>
                </div>
            {/each}
        </div>
    {/if}

    {#if showMnemonicFor}
        <MnemonicInput
            label={showMnemonicFor.action === "accept"
                ? `Enter your 12-word mnemonic to accept this gift. You will only pay ~${gasCost || "0.000000"} ETH for gas.`
                : "Enter your 12-word mnemonic to refuse this gift."}
            error={actionError}
            success={actionSuccess}
            confirmText="Confirm"
            on:confirm={confirmGiftMnemonic}
        >
            <div slot="actions" class="flex space-x-4 mt-2">
                <button
                    class="bg-gray-400 px-4 py-2 flex-grow"
                    on:click={cancelMnemonic}
                >
                    Cancel
                </button>
            </div>
        </MnemonicInput>
    {/if}
</div>
