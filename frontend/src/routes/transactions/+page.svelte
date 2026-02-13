<script lang="ts">
  import { onMount } from "svelte";
  import { wallet } from "$lib/stores/wallet";
  import { get } from "svelte/store";
  import { goto } from "$app/navigation";
  import { apiFetch } from "$lib/api";
  import { shorten } from "$lib/util";
  import type { NFT } from "$lib/types/nft";
  import PaginationControls from "$lib/PaginationControls.svelte";
  import TransactionActionButtons from "$lib/TransactionActionButtons.svelte";
  import ItemCard from "$lib/ItemCard.svelte";

  let address = "";
  let transactions: any[] = [];
  let nfts: Record<string, NFT> = {};
  let loading = true;
  let error = "";
  let currentPage = 0;
  let totalTransactions = 0;
  const pageSize = 20;
  let copiedTxId: string | null = null;

  async function loadTransactions(page: number) {
    if (!address) return;
    
    loading = true;
    error = "";
    try {
      const skip = page * pageSize;
      const res = await apiFetch(`/transactions/user/${address}?skip=${skip}&limit=${pageSize}`);
      if (!res.ok) throw new Error("Failed to fetch transactions");
      
      const data = await res.json();
      transactions = data.items || [];
      totalTransactions = data.total || 0;
      currentPage = page;

      // Fetch NFT details for all unique nftIds
      const nftIds = [...new Set(transactions.map(tx => tx.nftId).filter(Boolean))];
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
      error = e.message || "Error fetching transactions";
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
    await loadTransactions(0);
  });

  async function copyTxHash(txId: string, chainTx: string | null) {
    // Copy Transaction ID (not chainTx)
    const textToCopy = txId;
    try {
      await navigator.clipboard.writeText(textToCopy);
      copiedTxId = txId;
      // Reset feedback after 2 seconds
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

  function getTxHashToCopy(tx: any): string | null {
    // Prefer chainTx, but fall back to transaction _id if chainTx is null
    return tx.chainTx || tx._id || null;
  }

  function formatDate(timestamp: Date | string | number) {
    const date = new Date(timestamp);
    return date.toLocaleDateString() + " " + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function getTransactionLabel(tx: any) {
    if (tx.type === "NFT_BUY") {
      return tx.buyer?.toLowerCase() === address ? "Bought" : "Sold";
    }
    if (tx.type === "GIFT_CLAIM") {
      return tx.receiver?.toLowerCase() === address ? "Received Gift" : "Gave Gift";
    }
    return tx.type || "Transaction";
  }

  const totalPages = Math.ceil(totalTransactions / pageSize);
</script>

<div class="max-w-4xl mx-auto p-4">
  <h1 class="text-2xl font-bold mb-6">My Transactions</h1>

  {#if loading && transactions.length === 0}
    <p class="text-center">Loading transactions...</p>
  {:else if error}
    <p class="text-center text-red-600">{error}</p>
  {:else if transactions.length === 0}
    <p class="text-center text-gray-600">You don't have any transactions yet.</p>
  {:else}
    <!-- Transaction list -->
    <div class="space-y-4">
      {#each transactions as tx}
        {@const nft = nfts[tx.nftId]}
        {@const isBuyer = tx.type === "NFT_BUY" ? (tx.buyer?.toLowerCase() === address) : (tx.type === "GIFT_CLAIM" ? (tx.receiver?.toLowerCase() === address) : false)}
        <ItemCard>
          <svelte:fragment slot="image">
            {#if nft}
              <img
                src={nft.imageurl}
                alt={nft.name || "NFT"}
                class="w-20 h-20 sm:w-24 sm:h-24 object-cover flex-shrink-0"
              />
            {:else}
              <div class="w-20 h-20 sm:w-24 sm:h-24 bg-gray-200 flex items-center justify-center flex-shrink-0">
                <span class="text-gray-400 text-xs">Loading...</span>
              </div>
            {/if}
          </svelte:fragment>

          <svelte:fragment slot="title">
            {#if nft}
              <h3 class="font-semibold text-lg mb-2 truncate">{nft.name}</h3>
            {/if}
          </svelte:fragment>

          <svelte:fragment slot="info">
            <div class="text-sm space-y-1 text-gray-700">
              <div><span class="font-medium">Type:</span> {getTransactionLabel(tx)}</div>
              {#if tx.quantity}
                <div><span class="font-medium">Quantity:</span> {tx.quantity} part{tx.quantity > 1 ? "s" : ""}</div>
              {/if}
              {#if tx.type === "NFT_BUY" && tx.amount && tx.currency && parseFloat(tx.amount) > 0}
                <div>
                  <span class="font-medium">{isBuyer ? "Paid:" : "Received:"}</span> {tx.amount} {tx.currency}
                </div>
              {/if}
              {#if tx.timestamp}
                <div><span class="font-medium">Date:</span> {formatDate(tx.timestamp)}</div>
              {/if}
              {#if getTxHashToCopy(tx)}
                <div class="text-xs font-mono text-gray-600 break-all">
                  <span class="font-medium">Tx:</span> {shorten(getTxHashToCopy(tx) || "", 8)}
                </div>
              {/if}
            </div>
          </svelte:fragment>

          <svelte:fragment slot="actions">
            {#if getTxHashToCopy(tx)}
              <TransactionActionButtons
                txId={tx._id}
                arweaveTxId={tx.arweaveTxId || null}
                {copiedTxId}
                onCopyTxHash={copyTxHash}
                onOpenInArweave={openInArweave}
              />
            {/if}
          </svelte:fragment>
        </ItemCard>
      {/each}
    </div>

    <!-- Pagination -->
    <PaginationControls
      {currentPage}
      {totalPages}
      totalItems={totalTransactions}
      loading={loading}
      onPrevious={() => loadTransactions(currentPage - 1)}
      onNext={() => loadTransactions(currentPage + 1)}
    />
  {/if}
</div>

