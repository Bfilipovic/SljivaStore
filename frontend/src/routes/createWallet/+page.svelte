<script lang="ts">
  import { createNewWallet } from '$lib/walletActions';

  let mnemonic: string | null = null;
  let address: string | null = null;

  function generateWallet() {
    ({ mnemonic, address } = createNewWallet());
  }
</script>
<h1 class="text-xl font-semibold mb-4">Create New Wallet</h1>

<button
  on:click={generateWallet}
  class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
>
  Create Wallet
</button>

{#if mnemonic}
  <div class="bg-yellow-100 p-4 mt-6 text-black rounded shadow">
    <p><strong>These are your 12 seed words:</strong></p>
    <p class="font-mono text-lg mt-2 mb-2 break-words">{mnemonic}</p>
    <p>Write them down and keep them safe. This is the only time you'll see them.</p>
    <hr class="my-4" />
    <p><strong>Wallet Address:</strong></p>
    <p class="font-mono text-sm text-green-700">{address}</p>
  </div>
{/if}
