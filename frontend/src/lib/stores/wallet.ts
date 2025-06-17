import { writable } from 'svelte/store';
import { browser } from '$app/environment';

export const walletAddress = writable<string | null>(null);

if (browser) {
	const saved = localStorage.getItem('walletAddress');
	if (saved) walletAddress.set(saved);

	walletAddress.subscribe((addr) => {
		if (addr) localStorage.setItem('walletAddress', addr);
		else localStorage.removeItem('walletAddress');
	});
}
