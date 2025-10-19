<script lang="ts">
  import { loginWalletFromMnemonic } from '$lib/walletActions';
  import { goto } from '$app/navigation';
  import MnemonicInput from '$lib/MnemonicInput.svelte';

  let error = '';

  function onLoginMnemonic(e) {
    const words = e.detail.words;
    const mnemonic = words.join(' ').trim();
    try {
      const address = loginWalletFromMnemonic(mnemonic);
      goto('/store');
    } catch (e) {
      error = 'Invalid mnemonic';
    }
  }

  function createWallet() {
    goto('/createWallet');
  }
</script>

<div class="flex flex-col items-center justify-center min-h-screen p-4">
  <div class="w-full max-w-md">
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
  </div>
</div>
