<script context="module" lang="ts">
	// Extend Window interface for MetaMask
	interface MetaMaskWindow extends Window {
		ethereum?: any; // You can use a more specific type if you have one for ethers provider
	}

	declare let window: MetaMaskWindow;
</script>

<script lang="ts">
	import { openSidebar, ID, autoTransitionEnabled, walletAddress } from './store';
	import { onMount, onDestroy, getContext } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';
	import HoloSphere from 'holosphere';
	import { ethers } from 'ethers';
	import { fetchHolonName } from "../utils/holonNames";
	import { addVisitedHolon, getWalletAddress } from "../utils/localStorage";
	import MyHolonsIcon from './sidebar/icons/MyHolonsIcon.svelte';

	export let toggleMyHolons: () => void;

	let holosphere = getContext("holosphere") as HoloSphere;

	let currentHolonName: string | undefined;

	interface HolonInfo {
		id: string;
		name?: string;
	}


	let holonID: string = '';
	let showToast = false;

	// Ethereum wallet connection
	async function connectWallet() {
		if (browser && typeof window.ethereum !== 'undefined') {
			try {
				const provider = new ethers.BrowserProvider(window.ethereum);
				await provider.send("eth_requestAccounts", []);
				const signer = await provider.getSigner();
				const address = await signer.getAddress();
				walletAddress.set(address);
			} catch (error) {
				console.error('Error connecting to wallet:', error);
				// Handle error (e.g., show a message to the user)
			}
		} else {
			console.log('MetaMask is not installed!');
			// Handle case where MetaMask (or other provider) is not available
		}
	}

	onMount(() => {
		// Ensure auto-transition is off by default when TopBar loads
		autoTransitionEnabled.set(false);

		// Add event listeners only in browser environment
		if (browser) {
			window.addEventListener('mousemove', handleActivity);
			window.addEventListener('touchstart', handleActivity);
			window.addEventListener('touchmove', handleActivity);
			window.addEventListener('scroll', handleActivity);
		}
	});

	onDestroy(() => {
		if (browser) {
			window.removeEventListener('mousemove', handleActivity);
			window.removeEventListener('touchstart', handleActivity);
			window.removeEventListener('touchmove', handleActivity);
			window.removeEventListener('scroll', handleActivity);
		}
	});

	// Function to disconnect wallet
	function disconnectWallet() {
		walletAddress.set(null);
		// Potentially clear other related stored data if needed
	}

	// Use centralized holon name service
	async function updateCurrentHolonName(id: string) {
		if (!id || id === '') {
			currentHolonName = undefined;
			return;
		}
		
		try {
			currentHolonName = await fetchHolonName(holosphere, id);
		} catch (error) {
			console.error(`Error fetching name for holon ${id}:`, error);
			currentHolonName = undefined;
		}
	}

	// Function to save visited holon
	async function saveVisitedHolon(holonId: string, holonName: string) {
		const walletAddr = getWalletAddress();
		if (holonId && holonId !== 'undefined' && holonId !== 'null' && holonId.trim() !== '') {
			try {
				await addVisitedHolon(walletAddr, holonId, holonName, 'personal');
				console.log(`Saved visited holon from TopBar: ${holonId}`);
			} catch (err) {
				console.warn('Failed to save visited holon from TopBar:', err);
			}
		}
	}

	// Reactive statement to set ID from page params
	// Handle URL parameter changes with debouncing
	let urlUpdateTimeout: NodeJS.Timeout;
	$: {
		const storedHolonID = $page.params.id;
		if (storedHolonID && storedHolonID !== 'undefined' && storedHolonID !== 'null' && storedHolonID.trim() !== '') {
			// Clear any pending update
			if (urlUpdateTimeout) clearTimeout(urlUpdateTimeout);
			
			// Debounce the ID store update to avoid rapid changes
			urlUpdateTimeout = setTimeout(() => {
				ID.set(storedHolonID);
			}, 50);
		}
	}
	// Handle ID store changes with debouncing
	let idUpdateTimeout: NodeJS.Timeout;
	$: if ($ID && $ID !== 'undefined' && $ID !== 'null' && $ID.trim() !== '') {
		showToast = false;
		
		// Clear any pending update
		if (idUpdateTimeout) clearTimeout(idUpdateTimeout);
		
		// Debounce the updates to avoid rapid changes
		idUpdateTimeout = setTimeout(() => {
			// Always try to resolve the holon name when we have a valid ID
			updateCurrentHolonName($ID);
			
			// Save visited holon when we have a valid ID and we're not on a primary page
			if (browser && $page.url.pathname !== '/') {
				// Save the visited holon with the resolved name or fallback
				const holonName = currentHolonName || `Holon ${$ID}`;
				saveVisitedHolon($ID, holonName);
			}
			
			// Only update route if the ID actually changed AND we're not on a primary page
			// AND we're not already on a valid path for this holon
			if (holonID !== $ID && $page.url.pathname !== '/') {
				// Check if we're already on a valid path for this holon
				const currentPath = $page.url.pathname;
				const expectedPath = `/${$ID}`;
				
				// Only update if we're not already on the correct path
				if (!currentPath.startsWith(expectedPath)) {
					holonID = $ID;
					// Add a small delay to avoid interfering with initial navigation
					setTimeout(() => {
						updateRoute($ID);
					}, 100);
				} else {
					// Just update the holonID without changing the route
					holonID = $ID;
				}
			}
		}, 100);
	} else {
		// If ID becomes undefined, don't redirect - let the URL determine the page
		// This prevents redirect loops
	}

	function updateRoute(id: string) {
		if (!id || id === '' || id === 'undefined' || id === 'null' || id.trim() === '') {
			// If no valid ID, redirect to splash screen only if not already there
					if (browser && $page.url.pathname !== '/') {
			goto('/');
		}
			return;
		}
		
		// Check if we're already on the correct path for this holon
		const currentPath = $page.url.pathname;
		const expectedPath = `/${id}`;
		
		// Only navigate if we're not already on the correct path
		if (browser && !currentPath.startsWith(expectedPath)) {
			// Extract the sub-path more carefully
			const pathParts = currentPath.split('/');
			let subPath = pathParts[pathParts.length - 1]; // Get the last part
			
			// Only default to dashboard if we're currently on a path that's just the holon ID
			// or if the subPath is the old holon ID (meaning we're switching holons)
			if (pathParts.length === 2 || subPath === holonID) {
				subPath = 'dashboard';
			}
			
			const newPath = `/${id}/${subPath || 'dashboard'}`;
			goto(newPath);
		}
	}

	// Check if we're on a primary page (standalone routes)
	$: isPrimaryPage = $page.url.pathname === '/';
	
	// Reactive statement for walletAddress changes
	$: if ($walletAddress) {
		console.log('Wallet connected:', $walletAddress);
		// You can add logic here if something needs to happen when the wallet connects,
		// e.g., fetching user-specific data based on wallet address.
	}

	function toggleAutoTransition() {
		autoTransitionEnabled.update(value => !value);
	}

	// Pause on any mouse or touch activity
	function handleActivity() {
		if ($autoTransitionEnabled) {
			autoTransitionEnabled.set(false);
		}
	}


</script>

<style>
	.toast {
		position: fixed;
		bottom: 20px;
		right: 20px;
		background-color: rgba(0, 0, 0, 0.7);
		color: white;
		padding: 10px 20px;
		border-radius: 5px;
		transition: opacity 0.5s ease;
		opacity: 0;
	}
	.toast.show {
		opacity: 1;
	}

	/* Add styles for the holon name in the top bar */
	.flex-shrink-0 {
		z-index: 102;
		background-color: #1f2937;
		padding: 0.5rem;
		border-radius: 0.5rem;
		margin-right: 1rem;
	}
	.wallet-button {
		background-color: #4a5568; /* gray-700 */
		color: white;
		padding: 0.5rem 1rem;
		border-radius: 0.375rem; /* rounded-md */
		font-weight: 500; /* font-medium */
		margin-left: 1rem; /* ml-4 */
		transition: background-color 0.2s;
	}
	.wallet-button:hover {
		background-color: #2d3748; /* gray-800 */
	}
	.wallet-info {
		color: white;
		margin-left: 1rem; /* ml-4 */
		font-size: 0.875rem; /* text-sm */
		display: flex;
		align-items: center;
	}
	.disconnect-button {
		background-color: transparent;
		color: #cbd5e0; /* gray-400 */
		border: 1px solid #cbd5e0; /* gray-400 */
		padding: 0.25rem 0.5rem;
		border-radius: 0.375rem; /* rounded-md */
		margin-left: 0.5rem; /* ml-2 */
		font-size: 0.75rem; /* text-xs */
		cursor: pointer;
	}
	.disconnect-button:hover {
		background-color: #ef4444; /* red-500 */
		color: white;
		border-color: #ef4444; /* red-500 */
	}
</style>

<div class="top-bar-container w-full px-4 py-2 flex items-center justify-between">
    <!-- Left side -->
    <div class="w-1/4">
        <button on:click={openSidebar} class="text-white lg:hidden p-2">
            Menu
        </button>
    </div>

    <!-- Center -->
    <div class="w-1/2 flex flex-col items-center">
        <button on:click={toggleMyHolons} class="p-2 rounded-full hover:ring-4 hover:ring-blue-400 ring-offset-2 transition-all cursor-pointer animate-pulse hover:animate-none" title="Open My Holons">
            <div class="w-20 h-20">
                <MyHolonsIcon />
            </div>
        </button>
        {#if !isPrimaryPage}
            <div class="text-center mt-1">
                <a href={`/${$ID}/dashboard`} class="text-sm font-semibold text-white hover:underline">
                    {currentHolonName || '...'}
                </a>
                <p class="text-xs text-gray-400 font-mono">{$ID || '...'}</p>
            </div>
        {/if}
    </div>

    <!-- Right side -->
    <div class="w-1/4 flex justify-end">
		{#if $walletAddress}
			<div class="wallet-info">
				<span>{`${$walletAddress.substring(0, 6)}...${$walletAddress.substring($walletAddress.length - 4)}`}</span>
				<button on:click={disconnectWallet} class="disconnect-button">Disconnect</button>
			</div>
		{:else}
			<button on:click={connectWallet} class="wallet-button">
				Connect Wallet
			</button>
		{/if}
    </div>
</div>

{#if showToast}
	<button
		class="toast show"
		on:click={() => showToast = false}
		on:keydown={(e) => e.key === 'Enter' && (showToast = false)}
	>
		To begin using the dashboard, please type the Holon ID in the search bar.<br/> You can get the Holon ID using the command /id on any chat containing the Telegram bot @HolonsBot.
	</button>
{/if}
