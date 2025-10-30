<script lang="ts">
  import { createNewWallet } from '$lib/walletActions';
  import { onMount } from 'svelte';

  let mnemonic: string | null = null;
  let address: string | null = null;
  let copyButtonText = "Copy Mnemonic";
  let copyButtonClass = "bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded";

  function generateWallet() {
    ({ mnemonic, address } = createNewWallet());
  }

  async function copyMnemonic() {
    if (!mnemonic) return;
    
    try {
      await navigator.clipboard.writeText(mnemonic);
      copyButtonText = "Mnemonic Copied!";
      copyButtonClass = "bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded";
      
      // Reset button after 2 seconds
      setTimeout(() => {
        copyButtonText = "Copy Mnemonic";
        copyButtonClass = "bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded";
      }, 2000);
    } catch (err) {
      console.error('Failed to copy mnemonic:', err);
      copyButtonText = "Copy Failed";
      copyButtonClass = "bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded";
      
      // Reset button after 2 seconds
      setTimeout(() => {
        copyButtonText = "Copy Mnemonic";
        copyButtonClass = "bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded";
      }, 2000);
    }
  }

  onMount(async () => {
    generateWallet();
  });
</script>

<div class="flex flex-col items-center justify-center min-h-screen p-4">
  <div class="w-full max-w-2xl">
    <h1 class="text-2xl font-bold mb-6 text-center">Create New Wallet</h1>
    
    <div class="text-center mb-8">
      <button
        on:click={generateWallet}
        class="bg-green-600 hover:bg-green-700 text-white px-6 py-3 text-lg font-semibold rounded-lg shadow-lg"
      >
        Generate New Wallet
      </button>
    </div>

    {#if mnemonic}
      <div class="bg-green-50 border border-green-200 p-6 rounded-lg shadow-lg">
        <div class="text-center mb-4">
          <h2 class="text-2xl font-extrabold text-green-900 mb-2">🎉 Congratulations, you have generated a new wallet.</h2>
          <p class="text-sm text-yellow-800">⚠️ Important: Write down these 12 words and keep them safe. This is the only time you'll see them.</p>
        </div>
        
        <div class="bg-white p-4 rounded border-2 border-green-300 mb-4">
          <p class="font-mono text-lg leading-relaxed break-words text-gray-800">{mnemonic}</p>
        </div>
        
        <div class="text-center mb-4">
          <button
            on:click={copyMnemonic}
            class={copyButtonClass}
          >
            {copyButtonText}
          </button>
        </div>
        
        <hr class="my-4 border-green-200" />
        
        <div class="text-center">
          <p class="text-sm font-semibold text-gray-700 mb-2">Your Wallet Address:</p>
          <p class="font-mono text-sm bg-gray-100 p-2 rounded break-all text-green-700">{address}</p>
        </div>
      </div>
    {/if}
  </div>
</div>
