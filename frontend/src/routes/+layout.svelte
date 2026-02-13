<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  import { get } from 'svelte/store';
  import { page } from '$app/stores';
  import Nav from '$lib/Nav.svelte';
  import Footer from '$lib/Footer.svelte';
  import { logout, isSessionActive } from '$lib/walletActions';
  import { wallet } from '$lib/stores/wallet';
  import '../app.css'; // << this is critical
  import "$lib/polyfills";

  let sessionCheckInterval: ReturnType<typeof setInterval> | null = null;

  async function checkSessionAndLogout() {
    // Don't check session on login page - it interferes with the login flow
    if ($page.url.pathname === '/login' || $page.url.pathname === '/createWallet') {
      return;
    }
    
    if (!isSessionActive()) {
      // Get current wallet state
      const currentWallet = get(wallet);
      
      // If wallet has an address but no session password entered in this tab,
      // redirect to login page to enter session password
      // (encrypted mnemonic exists in localStorage, just need to decrypt it)
      if (currentWallet?.ethAddress) {
        // Check if encrypted mnemonic exists (user logged in another tab)
        const { hasActiveSession } = await import('$lib/sessionManager');
        if (hasActiveSession()) {
          // Encrypted mnemonic exists - redirect to login to enter session password
          goto('/login?prompt=session');
        } else {
          // No encrypted mnemonic - full logout
          logout();
        }
      }
    }
  }

  onMount(() => {
    if (browser) {
      // Check immediately on mount
      checkSessionAndLogout();
      
      // Then check session expiration every 30 seconds
      sessionCheckInterval = setInterval(() => {
        checkSessionAndLogout();
      }, 30000); // Check every 30 seconds
    }
  });

  onDestroy(() => {
    if (sessionCheckInterval) {
      clearInterval(sessionCheckInterval);
    }
  });
</script>

<div class="min-h-screen flex flex-col">
  <Nav />
  
  <main class="flex-1">
    <slot />
  </main>
  
  <Footer />
</div>
