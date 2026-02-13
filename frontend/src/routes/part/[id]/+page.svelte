<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/stores";
  import { NFT, Part } from "$lib/classes";
  import { apiFetch } from "$lib/api";
  import { shorten } from "$lib/util";

  let partId = "";
  let part: Part | null = null;
  let nft: NFT | null = null;
  let error = "";
  let loading = true;
  let partialTransactions = [];
  let txError = "";

  function getTransactionTypeLabel(type: string | undefined): string {
    if (!type) return "";
    if (type === "GIFT") return "[GIFT]";
    if (type === "MINT") return "[NFT Minted]";
    return ""; // Regular TRANSACTION has no label
  }

  $: partId = $page.params.id;

  onMount(async () => {
    try {
      const partRes = await apiFetch(`/parts/${partId}`);
      if (!partRes.ok) throw new Error("Part not found");
      part = new Part(await partRes.json());

      const nftRes = await apiFetch(`/nfts/${part.parent_hash}`);
      if (!nftRes.ok) throw new Error("Parent NFT not found");
      nft = new NFT(await nftRes.json());

      // apiFetch partial transaction history for this part
      const txRes = await apiFetch(`/transactions/partial/${partId}`);
      if (!txRes.ok) throw new Error("Could not apiFetch transaction history");
      partialTransactions = await txRes.json();
      // Sort oldest to newest
      partialTransactions.sort((a, b) => a.timestamp - b.timestamp);
    } catch (e: any) {
      error = e.message;
    } finally {
      loading = false;
    }
  });
</script>

{#if loading}
  <p>Loading part...</p>
{:else if error}
  <p class="text-red-600">{error}</p>
{:else}
  <div class="max-w-md mx-auto p-4 space-y-4">
    <img src={nft.imageurl} alt="NFT image" class="w-full aspect-square" />

    <div class="text-sm text-gray-700">
      <p>
        Part of:
        <a
          href={`/manage/${part.parent_hash}`}
          class="text-blue-700 underline hover:text-blue-900"
        >
          {shorten(part.parent_hash)}
        </a>
      </p>
      <p>Owner: {part.owner}</p>
      <p>
        <span class="font-semibold">Part Hash:</span>
        <span class="break-all">{part._id}</span>
      </p>
    </div>

    <div>
      <h3 class="font-semibold mb-2">Transaction History</h3>
      {#if txError}
        <p class="text-red-600 text-sm">{txError}</p>
      {:else if partialTransactions.length === 0}
        <p class="text-gray-500 text-sm">No transactions for this part.</p>
      {:else}
        <div class="max-h-64 overflow-y-auto border bg-gray-50 p-2">
          <ul class="divide-y divide-gray-200">
            {#each partialTransactions as tx}
              <li class="py-2 text-xs">
                <div class="text-gray-600">
                  {new Date(tx.timestamp).toLocaleString()}
                  {#if tx.transactionType}
                    <span class="ml-2 font-semibold text-blue-600">
                      {getTransactionTypeLabel(tx.transactionType)}
                    </span>
                  {/if}
                </div>
                <div class="mt-1">
                  {#if tx.from && tx.from.trim()}
                    <span class="font-mono">{tx.from}</span>
                    <span class="text-gray-400">→</span>
                    <span class="font-mono">{tx.to}</span>
                  {:else}
                    <span class="text-gray-500 italic">Created</span>
                    <span class="text-gray-400">→</span>
                    <span class="font-mono">{tx.to}</span>
                  {/if}
                </div>
                <div class="text-gray-700"></div>
                <div class="truncate text-gray-500">
                  Tx: <span class="font-mono">{tx.transaction}</span>
                </div>

                {#if tx.chainTx}
                  <div class="truncate text-gray-500">
                    Chain Tx:
                    {#if tx.currency === "SOL"}
                      <a
                        href={`https://explorer.solana.com/tx/${String(tx.chainTx)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        class="font-mono text-blue-600 hover:underline"
                      >
                        {String(tx.chainTx)}
                      </a>
                    {:else}
                      <a
                        href={`https://etherscan.io/tx/${String(tx.chainTx)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        class="font-mono text-blue-600 hover:underline"
                      >
                        {String(tx.chainTx)}
                      </a>
                    {/if}
                  </div>
                {/if}
              </li>
            {/each}
          </ul>
        </div>
      {/if}
    </div>
  </div>
{/if}
