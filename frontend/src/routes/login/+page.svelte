<script lang="ts">
  import { walletAddress } from '$lib/stores/wallet';
  import { loginWalletFromMnemonic } from '$lib/walletActions';
  import { goto } from '$app/navigation';
  import MnemonicInput from '$lib/MnemonicInput.svelte';

  let error = '';

  function onLoginMnemonic(e) {
    const words = e.detail.words;
    const mnemonic = words.join(' ').trim();
    try {
      const address = loginWalletFromMnemonic(mnemonic);
      goto('/personal');
    } catch (e) {
      error = 'Invalid mnemonic';
    }
  }

  function createWallet() {
    goto('/createWallet');
  }
</script>

<h2>Enter your 12-word recovery phrase</h2>
<MnemonicInput
  label="Enter your 12-word recovery phrase:"
  error={error}
  confirmText="Login"
  on:confirm={onLoginMnemonic}
/>

<h2>Don't have an Etherium wallet? Click the button bellow to get one</h2>
<button class="mt-4 p-2 bg-blue-600 text-white rounded" on:click={createWallet}>Create Wallet</button>