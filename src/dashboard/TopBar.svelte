<script lang="ts">
	import { openSidebar, ID } from './store';
	import { onMount, onDestroy } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { getContext } from 'svelte';
	import HoloSphere from 'holosphere';

	let holosphere = getContext('holosphere') || new HoloSphere('HolonsDebug');
	
	interface HolonInfo {
		id: string;
		name?: string;
	}

	let holonID: string = '';
	let showToast = false;
	let showDropdown = false;
	let previousHolons: HolonInfo[] = [];

	onMount(() => {
		const storedHolonID = $page.params.id;
		if (storedHolonID) {
			ID.set(storedHolonID);
		} else {
			showToast = true;
		}

		// Load previous holons from localStorage
		const stored = localStorage.getItem('previousHolons');
		if (stored) {
			previousHolons = JSON.parse(stored).filter((holon: HolonInfo) => !holon.id.startsWith('8'));
			// Fetch names for holons that don't have them
			previousHolons.forEach(async (holon) => {
				if (!holon.name) {
					try {
						const data = await holosphere.get(holon.id, 'settings');
						console.log(data);
						if (data) {
							holon.name = data;
							localStorage.setItem('previousHolons', JSON.stringify(previousHolons));
						}
					} catch (error) {
						console.error(`Error fetching name for holon ${holon.id}:`, error);
					}
				}
			});
		}
	});

	// Reactive statement to update route when ID changes
	$: if ($ID) {
		showToast = false;
		holonID = $ID;
		updateRoute($ID);
		
		// Add to previous holons if it doesn't start with 8
		if (!$ID.startsWith('8') && !previousHolons.some(h => h.id === $ID)) {
			const newHolon: HolonInfo = { id: $ID };
			// Fetch the name for the new holon
			holosphere.get($ID, 'name').then(name => {
				if (name) {
					newHolon.name = name;
					localStorage.setItem('previousHolons', JSON.stringify(previousHolons));
				}
			}).catch(error => {
				console.error(`Error fetching name for holon ${$ID}:`, error);
			});
			previousHolons = [...previousHolons, newHolon];
			localStorage.setItem('previousHolons', JSON.stringify(previousHolons));
		}
	}

	function selectPreviousHolon(holon: HolonInfo) {
		ID.set(holon.id);
		showDropdown = false;
	}

	function updateRoute(id: string) {
		let currentPath = $page.url.pathname.split('/').pop();
		if (currentPath === holonID) currentPath = 'dashboard';
		goto(`/${id ? id : 'holonid'}/${currentPath}`);
	}

	function handleInput(event: Event) {
		const target = event.target as HTMLInputElement;
		ID.set(target.value);
		showDropdown = false;
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			handleInput(event);
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
		color: #d1d5db;
		transition: background-color 0.2s;
		display: flex;
		flex-direction: column;
		gap: 2px;
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
				<div class="group items-center ml-8 relative w-full md:flex lg:w-72">
					<span class="id-label">ID:</span>
					<div class="input-container w-full">
						<input
							type="text"
							class="bg-gray-800 block leading-normal pl-12 py-1.5 pr-4 ring-opacity-90 rounded-2xl text-gray-400 w-full focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
							placeholder="Holon ID"
							on:keydown={handleKeydown}
							on:blur={handleInput}
							on:focus={() => showDropdown = true}
							value={holonID}
						/>
						{#if showDropdown && previousHolons.length > 0}
							<div class="dropdown">
								{#each previousHolons as holon}
									<div 
										class="dropdown-item"
										on:mousedown={() => selectPreviousHolon(holon)}
									>
										<span class="holon-id">{holon.id}</span>
										{#if holon.name}
											<span class="holon-name">{holon.name}</span>
										{/if}
									</div>
								{/each}
							</div>
						{/if}
					</div>
				</div>
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
