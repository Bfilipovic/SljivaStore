<script lang="ts">
  import { walletAddress } from '$lib/stores/wallet';
  import { loginWalletFromMnemonic } from '$lib/walletActions';
  import { goto } from '$app/navigation';

  let words = Array(12).fill('');
  let error = '';

  function login() {
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
<div class="grid grid-cols-2 gap-2 max-w-md">
  {#each words as word, i}
    <input
      bind:value={words[i]}
      placeholder={`Word ${i + 1}`}
      class="border p-2 rounded"
    />
  {/each}
</div>

{#if error}
  <p class="text-red-600">{error}</p>
{/if}

<button class="mt-4 p-2 bg-blue-600 text-white rounded" on:click={login}>Login</button>

<h2>Don't have an Etherium wallet? Click the button bellow to get one</h2>
<button class="mt-4 p-2 bg-blue-600 text-white rounded" on:click={createWallet}>Create Wallet</button>