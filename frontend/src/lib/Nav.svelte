<script lang="ts">
  import { walletAddress } from "$lib/stores/wallet";
  import { logout } from "$lib/walletActions";
  import { shorten } from "./util";
  let mobileOpen = false;
</script>

<nav class="bg-gray-900 text-white px-4 py-3 shadow-md">
  <div class="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-3 items-center">
    <!-- Left: Brand -->
    <div class="flex items-center">
      <a href="/store" class="text-lg font-bold">SljivaStore</a>
    </div>

    <!-- Center: Links (desktop only) -->
    <div class="hidden md:flex justify-center space-x-6">
      <a href="/store" class="hover:text-blue-400">Store</a>
      <a href="/selling" class="hover:text-blue-400">Owned NFTs</a>
      <a href="/myListings" class="hover:text-blue-400">My sales</a>
      <a href="/mint" class="hover:text-blue-400">Mint</a>
    </div>

    <!-- Right: Wallet / Logout / Hamburger -->
    <div class="flex justify-end items-center space-x-3 text-sm">
      {#if $walletAddress}
        <span class="text-gray-300">{shorten($walletAddress)}</span>
        <button
          on:click={logout}
          class="bg-red-600 hover:bg-red-700 px-2 py-1"
        >
          Logout
        </button>
      {/if}

      <!-- Hamburger button (mobile only) -->
      <button class="md:hidden ml-2" on:click={() => (mobileOpen = !mobileOpen)}>
        ☰
      </button>
    </div>
  </div>

  <!-- Mobile dropdown -->
  {#if mobileOpen}
    <div class="mt-2 flex flex-col space-y-2 md:hidden">
      <a href="/store" class="hover:text-blue-400">Store</a>
      <a href="/selling" class="hover:text-blue-400">Owned NFTs</a>
      <a href="/myListings" class="hover:text-blue-400">My sales</a>
      <a href="/mint" class="hover:text-blue-400">Mint</a>
    </div>
  {/if}
</nav>

