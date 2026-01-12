<script lang="ts">
  import { wallet } from "$lib/stores/wallet";
  import { logout } from "$lib/walletActions";

  function onCurrencyChange(e: Event) {
    const value = (e.target as HTMLSelectElement).value;
    wallet.update((w) => {
      w.setSelectedCurrency(value);
      return w;
    });
  }
</script>

<!-- top navigation bar -->
<div class="bg-gray-900 text-white p-4">
  <div class="flex justify-between items-center max-w-4xl mx-auto">
    <!-- left: nav links -->
    <div class="flex space-x-6">
      <a href="/store" class="hover:underline">STORE</a>
      <a href="/selling" class="hover:underline">MY NFTS</a>
      <a href="/transactions" class="hover:underline">MY TRANSACTIONS</a>
      {#if $wallet.isAdmin}
        <a href="/mint" class="hover:underline">MINT</a>
      {/if}
    </div>

    <!-- right: login/logout -->
    <div class="flex items-center space-x-4">
      {#if $wallet.selectedAddress}
        <button
          on:click={logout}
          class="bg-gray-600 hover:bg-gray-700 text-white px-3 py-1"
        >Logout</button>
      {:else}
        <a
          href="/login"
          class="bg-gray-600 hover:bg-gray-700 text-white px-3 py-1"
        >Login</a>
      {/if}
    </div>
  </div>
</div>

<!-- wallet info bar -->
{#if $wallet.selectedAddress}
  <div class="bg-gray-800 text-white px-4 py-2">
    <div class="max-w-4xl mx-auto text-sm text-gray-300">
      <!-- address row -->
      <div class="font-mono break-all">
        {$wallet.selectedAddress}
      </div>

      <!-- balance + currency selector row -->
      <div class="flex items-center justify-between mt-1 text-xs">
        <span>
          Balance: {$wallet.selectedBalance} {$wallet.selectedCurrency}
        </span>

<select
  class="bg-gray-700 text-white px-2 pr-6 py-0.5 appearance-none"
  style="-moz-appearance:none; -webkit-appearance:none; appearance:none;"
  on:change={onCurrencyChange}
  bind:value={$wallet.selectedCurrency}
>
  <option value="ETH">ETH</option>
  <option value="SOL">SOL</option>
</select>
      </div>

      <!-- gifts (ETH only) -->
      {#if $wallet.gifts.length > 0}
        <div class="mt-1 text-yellow-400 text-xs">
          🎁 You have {$wallet.gifts.length} gift{ $wallet.gifts.length > 1 ? "s" : "" }!
          <a href="/gifts" class="underline ml-1">View</a>
        </div>
      {/if}
    </div>
  </div>
{/if}
