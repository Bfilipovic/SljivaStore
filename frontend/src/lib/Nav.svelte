<script lang="ts">
  import { walletAddress, walletBalance } from '$lib/stores/wallet';
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
    <!-- user info row below navigation -->
    <div class="flex items-center justify-between w-full max-w-4xl mt-3 px-4">
      <div class="text-sm text-gray-300">
        <div class="font-mono">{$shortAddress}</div>
        <div class="text-xs">Balance: {$walletBalance} ETH</div>
      </div>
      <button
        on:click={logout}
        class="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded"
      >Logout</button>
    </div>
  {/if}
</nav>

<style>
  nav a {
    text-decoration: none;
  }
</style>
