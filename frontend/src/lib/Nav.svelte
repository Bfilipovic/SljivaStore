<script lang="ts">
  import { walletAddress, walletBalance, walletGifts } from '$lib/stores/wallet';
  import { logout } from '$lib/walletActions';
  import { derived } from 'svelte/store';

  const shortAddress = derived(walletAddress, ($addr) => {
    if (!$addr) return '';
    return $addr.slice(0, 6) + '...' + $addr.slice(-4);
  });
</script>

<nav class="flex flex-col items-center bg-gray-900 text-white p-4">
  <!-- main navigation -->
  <div class="flex space-x-6 justify-center">
    <a href="/" class="hover:underline">STORE</a>
    <a href="/selling" class="hover:underline">MY NFTS</a>
    <a href="/mint" class="hover:underline">MINT</a>
  </div>

  {#if $walletAddress}
    <div class="flex items-center justify-between w-full max-w-4xl mt-3 px-4">
      <div class="text-sm text-gray-300">
        <div class="font-mono">{$shortAddress}</div>
        <div class="text-xs">Balance: {$walletBalance} ETH</div>
        {#if $walletGifts.length > 0}
          <div class="mt-1 text-yellow-400 text-xs">
            🎁 You have {$walletGifts.length} gift{ $walletGifts.length > 1 ? 's' : '' }!
            <a href="/gifts" class="underline ml-1">View</a>
          </div>
        {/if}
      </div>
      <button
        on:click={logout}
        class="bg-red-600 hover:bg-red-700 text-white px-3 py-1"
      >Logout</button>
    </div>
  {/if}
</nav>

<style>
  nav a {
    text-decoration: none;
  }
</style>

