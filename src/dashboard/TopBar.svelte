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

	let holosphere = getContext("holosphere") as HoloSphere;

	let currentHolonName: string | undefined;

	interface HolonInfo {
		id: string;
		name?: string;
	}


	let holonID: string = '';
	let showToast = false;
	let showDropdown = false;
	let previousHolons: HolonInfo[] = [];
	let filteredHolons: HolonInfo[] = [];
	let inputValue: string = '';
	let isEditing: boolean = false;
	let blurTimeout: ReturnType<typeof setTimeout> | null = null;

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

		const storedHolonID = $page.params.id;
		if (storedHolonID) {
			ID.set(storedHolonID);
		} else {
			showToast = true;
		}

		// Load previous holons from localStorage
		if (browser) {
			const stored = localStorage.getItem('previousHolons');
			if (stored) {
				previousHolons = JSON.parse(stored).filter((holon: HolonInfo) => !holon.id.startsWith('8'));
				// Fetch names for holons that don't have them (batch to avoid redundant calls)
				const holonsNeedingNames = previousHolons.filter(holon => !holon.name);
				if (holonsNeedingNames.length > 0) {
					// Process all missing names in parallel but only update localStorage once
					Promise.all(holonsNeedingNames.map(async (holon) => {
						try {
							const holonName = await fetchHolonName(holosphere, holon.id);
							if (holonName && !holonName.startsWith('Holon ')) {
								holon.name = holonName;
								return true; // Indicate this holon was updated
							}
						} catch (error) {
							console.error(`Error fetching name for holon ${holon.id}:`, error);
						}
						return false;
					})).then((results) => {
						// Only update localStorage if any names were actually fetched
						if (results.some(updated => updated)) {
							localStorage.setItem('previousHolons', JSON.stringify(previousHolons));
						}
					});
				}
			}

			// Add event listeners only in browser environment
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
		try {
			currentHolonName = await fetchHolonName(holosphere, id);
		} catch (error) {
			console.error(`Error fetching name for holon ${id}:`, error);
			currentHolonName = undefined;
		}
	}

	// Update the reactive statement
	$: if ($ID) {
		showToast = false;
		holonID = $ID;
		updateRoute($ID);
		
		// Fetch the name whenever ID changes
		updateCurrentHolonName($ID);
		
		// Add to previous holons if it doesn't start with 8
		if (!$ID.startsWith('8') && !previousHolons.some(h => h.id === $ID)) {
			const newHolon: HolonInfo = { id: $ID };
			previousHolons = [...previousHolons, newHolon];
			if (browser) {
				localStorage.setItem('previousHolons', JSON.stringify(previousHolons));
			}
			
			// Then try to fetch and update its name in the previous holons list
			fetchHolonName(holosphere, $ID).then((holonName: string) => {
				if (holonName && !holonName.startsWith('Holon ')) {
					previousHolons = previousHolons.map(holon => 
						holon.id === $ID 
							? { ...holon, name: holonName }
							: holon
					);
					if (browser) {
						localStorage.setItem('previousHolons', JSON.stringify(previousHolons));
					}
				}
			}).catch((error: Error) => {
				console.error(`Error fetching name for holon ${$ID}:`, error);
			});
		}
	}

	function selectPreviousHolon(holon: HolonInfo) {
		if (blurTimeout) clearTimeout(blurTimeout);
		
		ID.set(holon.id);
		isEditing = false;
		showDropdown = false;
		filterHolons('');
	}

	function updateRoute(id: string) {
		let currentPath = $page.url.pathname.split('/').pop();
		if (currentPath === holonID) currentPath = 'dashboard'; // Default to dashboard if current path is just the ID
		// Ensure goto is only called on the client side
		if (browser) {
			goto(`/${id ? id : 'holonid'}/${currentPath}`);
		}
	}

	function filterHolons(value: string) {
		if (!value || !value.trim()) {
			filteredHolons = previousHolons;
			return;
		}
		
		const searchTerm = value.toLowerCase();
		filteredHolons = previousHolons.filter(holon => 
			holon.id.toLowerCase().includes(searchTerm) || 
			(holon.name && holon.name.toLowerCase().includes(searchTerm))
		);
	}

	function handleBlur() {
		blurTimeout = setTimeout(() => {
			if (isEditing) {
				if (inputValue.trim() && inputValue !== $ID) {
					ID.set(inputValue.trim());
				} else if (!inputValue.trim()) {
					inputValue = $ID || '';
				}
				isEditing = false;
			}
			showDropdown = false;
			filterHolons('');
		}, 150);
	}

	function handleFocus() {
		if (blurTimeout) clearTimeout(blurTimeout);
		showDropdown = true;
		isEditing = true;
		filterHolons(inputValue);
	}

	function handleInput() {
		isEditing = true;
		filterHolons(inputValue);
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			event.preventDefault();
			if (blurTimeout) clearTimeout(blurTimeout);

			if (inputValue.trim() && inputValue !== $ID) {
				ID.set(inputValue.trim());
			} else if (!inputValue.trim()) {
				inputValue = $ID || '';
			}
			isEditing = false;
			showDropdown = false;
			(event.target as HTMLElement).blur();
		}
	}

	// Initialize filtered holons
	$: filteredHolons = previousHolons;

	// Update inputValue from store *only* when not editing
	$: if ($ID && !isEditing) {
		holonID = $ID;
		inputValue = $ID;
	}

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

	function removePreviousHolon(holonId: string, event: MouseEvent) {
		event.preventDefault();
		event.stopPropagation();
		
		// Remove the holon from the array
		previousHolons = previousHolons.filter(holon => holon.id !== holonId);
		
		// Update localStorage if in browser environment
		if (browser) {
			localStorage.setItem('previousHolons', JSON.stringify(previousHolons));
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
	.dropdown {
		position: absolute;
		top: 100%;
		left: 0;
		right: 0;
		background-color: #1f2937;
		border: 1px solid #374151;
		border-radius: 8px;
		box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
		z-index: 100;
		max-height: 200px;
		overflow-y: auto;
		margin-top: 4px;
	}
	.dropdown-item {
		padding: 8px 12px;
		cursor: pointer;
		transition: background-color 0.2s;
	}
	.dropdown-item:hover {
		background-color: #374151;
	}
	.input-container {
		position: relative;
	}
	.dropdown::-webkit-scrollbar {
		width: 8px;
	}
	.dropdown::-webkit-scrollbar-track {
		background: #1f2937;
		border-radius: 8px;
	}
	.dropdown::-webkit-scrollbar-thumb {
		background: #4b5563;
		border-radius: 8px;
	}
	.dropdown::-webkit-scrollbar-thumb:hover {
		background: #6b7280;
	}
	.id-label {
		position: absolute;
		left: 0;
		margin-left: 1rem;
		color: #6b7280;
		z-index: 101;
		pointer-events: none;
		line-height: 2.25rem;
	}
	.holon-id {
		font-family: monospace;
	}
	.holon-name {
		font-size: 0.9em;
		color: #9ca3af;
		font-style: italic;
	}
	.delete-button {
		opacity: 0;
		transition: opacity 0.2s;
		color: #9ca3af;
	}
	.delete-button:hover {
		color: #ef4444;
	}
	.dropdown-item:hover .delete-button {
		opacity: 1;
	}
	.dropdown-item-content {
		display: flex;
		justify-content: space-between;
		align-items: center;
		width: 100%;
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

<header class="h-20 items-center relative z-10">
	<div class="flex flex-center flex-col h-full justify-center mx-auto relative px-3 text-white z-10">
		<div class="flex items-center pl-1 relative w-full sm:ml-0 sm:pr-2 lg:max-w-68">
			<div class="flex group h-full items-center relative w-12">
				<button
					type="button"
					aria-expanded="false"
					aria-label="Toggle sidenav"
					on:click={openSidebar}
					class="text-4xl text-white focus:outline-none"
				>
					&#8801;
				</button>
			</div>
			<div class="container flex left-0 relative w-3/4">
				{#if currentHolonName}
					<div class="flex items-center mr-4 flex-shrink-0">
						<span class="text-white text-xl font-medium whitespace-nowrap">
							{currentHolonName}
						</span>
					</div>
				{/if}
				<div class="group items-center relative w-full md:flex lg:w-72 flex-shrink">
					<span class="id-label">ID:</span>
					<div class="input-container w-full">
						<input
							type="text"
							class="bg-gray-800 block leading-normal pl-12 py-1.5 pr-4 ring-opacity-90 rounded-2xl text-gray-400 w-full focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
							placeholder="Holon ID"
							bind:value={inputValue}
							on:keydown={handleKeydown}
							on:input={handleInput}
							on:blur={handleBlur}
							on:focus={handleFocus}
						/>
						{#if showDropdown && filteredHolons.length > 0}
							<div class="dropdown">
								{#each filteredHolons as holon}
									<div 
										class="dropdown-item"
										role="button"
										tabindex="0"
										on:mousedown|preventDefault={() => selectPreviousHolon(holon)}
									>
										<div class="dropdown-item-content">
											<div class="flex-grow cursor-pointer flex flex-col">
												{#if holon.name}
													<span class="text-sm font-medium text-white holon-name">{holon.name}</span>
												{/if}
												<span class="holon-id text-xs {holon.name ? 'text-gray-400' : 'text-white'}">{holon.id}</span>
											</div>
											<button
												type="button"
												class="delete-button p-1 rounded-full hover:bg-gray-700"
												on:mousedown|stopPropagation|preventDefault={(e) => {
													removePreviousHolon(holon.id, e);
													showDropdown = true;
												}}
												aria-label="Remove holon from history"
											>
												<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
												</svg>
											</button>
										</div>
									</div>
								{/each}
							</div>
						{/if}
					</div>
				</div>
			</div>
			<div class="flex items-center justify-end ml-auto">
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
				<button
					on:click={toggleAutoTransition}
					class="p-2 rounded-full hover:bg-gray-700 transition-colors"
					aria-label={$autoTransitionEnabled ? 'Pause auto-transition' : 'Play auto-transition'}
				>
					{#if $autoTransitionEnabled}
						<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
						</svg>
					{:else}
						<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
						</svg>
					{/if}
				</button>
			</div>
		</div>
	</div>
</header>

{#if showToast}
	<button
		class="toast show"
		on:click={() => showToast = false}
		on:keydown={(e) => e.key === 'Enter' && (showToast = false)}
	>
		To begin using the dashboard, please type the Holon ID in the search bar.<br/> You can get the Holon ID using the command /id on any chat containing the Telegram bot @HolonsBot.
	</button>
{/if}
