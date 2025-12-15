<script lang="ts">
  import { loginWalletFromMnemonic, setupSession, isSessionActive, clearSession } from '$lib/walletActions';
  import { goto } from '$app/navigation';
  import MnemonicInput from '$lib/MnemonicInput.svelte';
  import SessionPasswordInput from '$lib/SessionPasswordInput.svelte';

  let error = '';
  let showMnemonic = true;
  let showSessionPassword = false;
  let mnemonic = '';

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
    {#if showMnemonic}
      <h2 class="text-xl font-semibold mb-4 text-center">
        Enter your 12-word mnemonic phrase
      </h2>

      <MnemonicInput
        label="Enter your 12-word mnemonic phrase:"
        error={error}
        confirmText="Login"
        on:confirm={onLoginMnemonic}
      />

      <h2 class="text-lg mt-6 text-center">
        Don't have an Ethereum wallet?
      </h2>

      <button
        class="mt-4 p-2 bg-blue-600 text-white w-full"
        on:click={createWallet}
      >
        Create Wallet
      </button>
    {:else if showSessionPassword}
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
  </div>
</div>
