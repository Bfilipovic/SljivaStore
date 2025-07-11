<script lang="ts">
	import { walletAddress } from '$lib/stores/wallet';
	import { goto } from '$app/navigation';
	import { logout } from '$lib/walletActions';

</script>

<nav class="bg-gray-900 text-white px-6 py-3 shadow-md">
	<div class="max-w-7xl mx-auto flex justify-between items-center">
		<!-- Left: Brand / Links -->
		<div class="flex items-center space-x-6">
			<a href="/" class="text-lg font-semibold hover:text-blue-400 transition">NFT Gallery</a>
			<a href="/store" class="text-lg font-semibold hover:text-blue-400 transition">Store</a>
			<a href="/personal" class="text-lg font-semibold hover:text-blue-400 transition">My creations</a>
			<a href="/selling" class="text-lg font-semibold hover:text-blue-400 transition">Owned NFTs</a>
			<a href="/myListings" class="text-lg font-semibold hover:text-blue-400 transition">My sales</a>
			<a href="/mint" class="text-lg font-semibold hover:text-blue-400 transition">Mint</a>
		</div>

		<!-- Right: Wallet -->
		<div class="flex items-center space-x-4">
			{#if $walletAddress}
				<span class="text-sm text-gray-300">
					Logged in as: <span class="font-mono text-green-400">{$walletAddress}…</span>
				</span>
				<button
					on:click={logout}
					class="bg-red-600 hover:bg-red-700 text-sm px-3 py-1 rounded transition"
				>
					Logout
				</button>
			{:else}
				<a
					href="/login"
					class="bg-blue-600 hover:bg-blue-700 text-sm px-3 py-1 rounded transition"
				>
					Login
				</a>
			{/if}
		</div>
	</div>
</nav>
