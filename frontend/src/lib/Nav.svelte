<script lang="ts">
  import { wallet } from "$lib/stores/wallet";
  import { logout } from "$lib/walletActions";

  let mobileMenuOpen = false;
  let transactionsDropdownOpen = false;

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

  function toggleTransactionsDropdown() {
    transactionsDropdownOpen = !transactionsDropdownOpen;
  }

  function closeTransactionsDropdown() {
    transactionsDropdownOpen = false;
  }
</script>

<!-- top navigation bar -->
<div class="bg-gray-900 text-white p-4">
  <div class="flex justify-between items-center max-w-4xl mx-auto">
    <!-- Desktop: nav links -->
    <nav class="hidden md:flex space-x-6 items-center">
      <a href="/store" class="hover:underline">Store</a>
      <a href="/selling" class="hover:underline">NFTs</a>
      
      <!-- Transactions Dropdown -->
      <div class="relative" on:mouseleave={closeTransactionsDropdown}>
        <button
          on:click={toggleTransactionsDropdown}
          class="hover:underline flex items-center"
        >
          Transactions
          <svg
            class="w-4 h-4 ml-1"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d={transactionsDropdownOpen ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"}
            />
          </svg>
        </button>
        
        {#if transactionsDropdownOpen}
          <div class="absolute top-full left-0 mt-1 bg-gray-800 rounded shadow-lg py-2 min-w-[180px] z-50">
            <a
              href="/transactions"
              on:click={closeTransactionsDropdown}
              class="block px-4 py-2 hover:bg-gray-700"
            >Buying/Selling</a>
            <a
              href="/gifts"
              on:click={closeTransactionsDropdown}
              class="block px-4 py-2 hover:bg-gray-700"
            >Gifts</a>
            <a
              href="/uploads"
              on:click={closeTransactionsDropdown}
              class="block px-4 py-2 hover:bg-gray-700"
            >Uploads</a>
            <a
              href="/listings"
              on:click={closeTransactionsDropdown}
              class="block px-4 py-2 hover:bg-gray-700"
            >Listings</a>
          </div>
        {/if}
      </div>
      
      <a href="/profile" class="hover:underline">Profile</a>
      <a href="/photographers" class="hover:underline">Photographers</a>
      {#if $wallet.isAdmin}
        <a href="/mint" class="hover:underline">Mint</a>
      {/if}
      {#if $wallet.isAdmin}
        <a href="/review-uploads" class="hover:underline">Review Uploads</a>
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
        >Store</a>
        <a
          href="/selling"
          on:click={closeMobileMenu}
          class="hover:underline px-4 py-2"
        >NFTs</a>
        
        <!-- Transactions Dropdown (Mobile) -->
        <div class="px-4">
          <button
            on:click={toggleTransactionsDropdown}
            class="hover:underline flex items-center justify-between w-full py-2"
          >
            <span>Transactions</span>
            <svg
              class="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d={transactionsDropdownOpen ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"}
              />
            </svg>
          </button>
          
          {#if transactionsDropdownOpen}
            <div class="pl-4 pt-2 space-y-2">
              <a
                href="/transactions"
                on:click={() => { closeMobileMenu(); closeTransactionsDropdown(); }}
                class="block hover:underline py-1"
              >Buying/Selling</a>
              <a
                href="/gifts"
                on:click={() => { closeMobileMenu(); closeTransactionsDropdown(); }}
                class="block hover:underline py-1"
              >Gifts</a>
              <a
                href="/uploads"
                on:click={() => { closeMobileMenu(); closeTransactionsDropdown(); }}
                class="block hover:underline py-1"
              >Uploads</a>
              <a
                href="/listings"
                on:click={() => { closeMobileMenu(); closeTransactionsDropdown(); }}
                class="block hover:underline py-1"
              >Listings</a>
            </div>
          {/if}
        </div>
        
        <a
          href="/profile"
          on:click={closeMobileMenu}
          class="hover:underline px-4 py-2"
        >Profile</a>
        <a
          href="/photographers"
          on:click={closeMobileMenu}
          class="hover:underline px-4 py-2"
        >Photographers</a>
        {#if $wallet.isAdmin}
          <a
            href="/mint"
            on:click={closeMobileMenu}
            class="hover:underline px-4 py-2"
          >Mint</a>
        {/if}
        {#if $wallet.isAdmin}
          <a
            href="/review-uploads"
            on:click={closeMobileMenu}
            class="hover:underline px-4 py-2"
          >Review Uploads</a>
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
