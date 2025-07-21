import { writable } from 'svelte/store';

export const sidebarExpanded = writable(false);
export const ID = writable<string | null>(null);
export const autoTransitionEnabled = writable<boolean>(true);
export const walletAddress = writable<string | null>(null);

export function openSidebar() {
	sidebarExpanded.set(true);
}

export function closeSidebar() {
	sidebarExpanded.set(false);
}

export function toggleSidebarExpanded() {
	sidebarExpanded.update(v => !v);
}

export const mapStore = writable({});
