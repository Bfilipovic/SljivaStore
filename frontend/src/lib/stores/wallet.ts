import { writable } from 'svelte/store';
import { browser } from '$app/environment';

export const walletAddress = writable<string | null>(null);
export const walletBalance = writable<string>('0'); // <-- add balance store

if (browser) {
	const saved = localStorage.getItem('walletAddress');
	const savedBalance = localStorage.getItem('walletBalance');

	if (saved) walletAddress.set(saved);
	if (savedBalance) walletBalance.set(savedBalance);

	walletAddress.subscribe((addr) => {
		if (addr) localStorage.setItem('walletAddress', addr);
		else localStorage.removeItem('walletAddress');
	});

	walletBalance.subscribe((bal) => {
		if (bal) localStorage.setItem('walletBalance', bal);
		else localStorage.removeItem('walletBalance');
	});
}
