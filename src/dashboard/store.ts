import { writable } from 'svelte/store';

const sidebarOpen = writable(false);

const openSidebar = () => {
	sidebarOpen.update(() => true);
};

const closeSidebar = () => {
	sidebarOpen.update(() => false);
};

export const ID = writable('');
export { sidebarOpen, openSidebar, closeSidebar};

export const mapStore = writable({});
