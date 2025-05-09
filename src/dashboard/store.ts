import { writable } from 'svelte/store';

export const sidebarOpen = writable(false);
export const ID = writable<string | null>(null);
export const autoTransitionEnabled = writable<boolean>(true);
export const walletAddress = writable<string | null>(null);

export function openSidebar() {
	sidebarOpen.update((value) => !value);
}

export function closeSidebar() {
	sidebarOpen.set(false);
}

export const mapStore = writable({});
