<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { get } from 'svelte/store';
  import { loginWalletFromMnemonic, setupSession, isSessionActive, clearSession, getMnemonicFromSession } from '$lib/walletActions';
  import { goto } from '$app/navigation';
  import { wallet } from '$lib/stores/wallet';
  import { hasActiveSession } from '$lib/sessionManager';
  import MnemonicInput from '$lib/MnemonicInput.svelte';
  import SessionPasswordInput from '$lib/SessionPasswordInput.svelte';

  let error = '';
  let showMnemonic = false;
  let showSessionPassword = false;
  let mnemonic = '';
  let promptForSessionPassword = false;

  onMount(() => {
    // Check if we should prompt for session password (user has wallet but no session in this tab)
    const currentWallet = get(wallet);
    const urlParams = new URLSearchParams($page.url.search);
    const promptParam = urlParams.get('prompt');
    
    if (promptParam === 'session' || (currentWallet?.ethAddress && hasActiveSession() && !isSessionActive())) {
      // Wallet exists and encrypted mnemonic exists, but no session password entered in this tab
      promptForSessionPassword = true;
      showSessionPassword = true;
    }
  });

  async function onSessionPassword(e: CustomEvent<{ password: string }>) {
    const sessionPassword = e.detail.password;
    try {
      // Verify the session password by trying to decrypt
      await getMnemonicFromSession(sessionPassword);
      // If successful, redirect to store
      goto('/store');
    } catch (e: any) {
      error = e.message || 'Invalid session password';
    }
  }

  async function onLoginMnemonic(e: CustomEvent<{ words: string[] }>) {
    const words = e.detail.words;
    mnemonic = words.join(' ').trim();
    try {
      const address = await loginWalletFromMnemonic(mnemonic);
      // Always clear any existing session and prompt for new password
      // This ensures that when logging in with a different account, 
      // the old session is cleared
      clearSession();
      showMnemonic = false;
      showSessionPassword = true;
    } catch (e) {
      error = 'Invalid mnemonic';
    }
  }

  async function onSetupSession(e: CustomEvent<{ password: string }>) {
    const sessionPassword = e.detail.password;
    try {
      await setupSession(mnemonic, sessionPassword);
      // Clear mnemonic from memory
      mnemonic = '';
      goto('/store');
    } catch (e) {
      error = 'Failed to set up session';
    }
  }

  function createWallet() {
    goto('/createWallet');
  }
</script>

<div class="flex flex-col items-center justify-center min-h-screen p-4">
  <div class="w-full max-w-md">
    {#if showSessionPassword}
      {#if promptForSessionPassword}
        <h2 class="text-xl font-semibold mb-4 text-center">
          Enter your session password
        </h2>
        <p class="text-sm text-gray-600 mb-4 text-center">
          You're logged in on another tab. Enter your session password to continue.
        </p>
        <SessionPasswordInput
          label="Enter your session password:"
          error={error}
          confirmText="Continue"
          isSetup={false}
          on:confirm={onSessionPassword}
          on:error={(e) => { error = e.detail.message; }}
        />
      {:else}
        <h2 class="text-xl font-semibold mb-4 text-center">
          Set up session password
        </h2>
        <SessionPasswordInput
          label="Create a session password:"
          error={error}
          confirmText="Continue"
          isSetup={true}
          on:confirm={onSetupSession}
          on:error={(e) => { error = e.detail.message; }}
        />
      {/if}
    {:else if showMnemonic}
      <h2 class="text-xl font-semibold mb-4 text-center">
        Enter your 12-word mnemonic phrase
      </h2>

      <MnemonicInput
        label="Enter your 12-word mnemonic phrase:"
        error={error}
        confirmText="Login"
        on:confirm={onLoginMnemonic}
      />
    {:else}
      <!-- Initial view: Create wallet button on top -->
      <button
        class="mt-4 p-4 bg-blue-600 text-white w-full rounded hover:bg-blue-700 font-medium text-lg"
        on:click={createWallet}
      >
        Create Wallet
      </button>

      <button
        class="mt-4 p-3 bg-gray-600 text-white w-full rounded hover:bg-gray-700 font-medium"
        on:click={() => { showMnemonic = true; error = ''; }}
      >
        Already have a wallet? Click to login
      </button>
    {/if}
  </div>
</div>
