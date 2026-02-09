<script lang="ts">
  import { wallet } from "$lib/stores/wallet";
  import { logout } from "$lib/walletActions";

  let mobileMenuOpen = false;

  function onCurrencyChange(e: Event) {
    const value = (e.target as HTMLSelectElement).value;
    wallet.update((w) => {
      w.setSelectedCurrency(value);
      return w;
    });
  }

  function toggleMobileMenu() {
    mobileMenuOpen = !mobileMenuOpen;
  }

  function closeMobileMenu() {
    mobileMenuOpen = false;
  }
</script>

<!-- top navigation bar -->
<div class="bg-gray-900 text-white p-4">
  <div class="flex justify-between items-center max-w-4xl mx-auto">
    <!-- Desktop: nav links -->
    <nav class="hidden md:flex space-x-6">
      <a href="/store" class="hover:underline">Shop</a>
      <a href="/selling" class="hover:underline">My NFTs</a>
      <a href="/transactions" class="hover:underline">My Transactions</a>
      <a href="/gifts" class="hover:underline">Gifts</a>
      <a href="/uploads" class="hover:underline">Uploads</a>
      <a href="/listings" class="hover:underline">My Listings</a>
      <a href="/profile" class="hover:underline">Profile</a>
      <a href="/photographers" class="hover:underline">Our Photographers</a>
      {#if $wallet.isAdmin}
        <a href="/mint" class="hover:underline">MINT</a>
      {/if}
    </nav>

    <!-- Mobile: hamburger button -->
    <button
      on:click={toggleMobileMenu}
      class="md:hidden text-white focus:outline-none"
      aria-label="Toggle menu"
    >
      <svg
        class="w-6 h-6"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        {#if mobileMenuOpen}
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M6 18L18 6M6 6l12 12"
          />
        {:else}
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M4 6h16M4 12h16M4 18h16"
          />
        {/if}
      </svg>
    </button>

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

  <!-- Mobile: expandable menu -->
  {#if mobileMenuOpen}
    <nav class="md:hidden mt-4 pb-2 border-t border-gray-700">
      <div class="flex flex-col space-y-3 pt-3">
        <a
          href="/store"
          on:click={closeMobileMenu}
          class="hover:underline px-4 py-2"
        >Shop</a>
        <a
          href="/selling"
          on:click={closeMobileMenu}
          class="hover:underline px-4 py-2"
        >My NFTs</a>
        <a
          href="/transactions"
          on:click={closeMobileMenu}
          class="hover:underline px-4 py-2"
        >My Transactions</a>
        <a
          href="/gifts"
          on:click={closeMobileMenu}
          class="hover:underline px-4 py-2"
        >Gifts</a>
        <a
          href="/uploads"
          on:click={closeMobileMenu}
          class="hover:underline px-4 py-2"
        >Uploads</a>
        <a
          href="/listings"
          on:click={closeMobileMenu}
          class="hover:underline px-4 py-2"
        >My Listings</a>
        <a
          href="/profile"
          on:click={closeMobileMenu}
          class="hover:underline px-4 py-2"
        >Profile</a>
        <a
          href="/photographers"
          on:click={closeMobileMenu}
          class="hover:underline px-4 py-2"
        >Our Photographers</a>
        {#if $wallet.isAdmin}
          <a
            href="/mint"
            on:click={closeMobileMenu}
            class="hover:underline px-4 py-2"
          >MINT</a>
        {/if}
      </div>
    </nav>
  {/if}
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
