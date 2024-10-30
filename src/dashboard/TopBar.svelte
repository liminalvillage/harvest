<script lang="ts">
	import { openSidebar, ID } from './store';
	import { onMount, onDestroy } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';

	let holonID: string = '';

	let showToast = false;

	onMount(() => {
		const storedHolonID = $page.params.id;
		if (storedHolonID) {
			ID.set(storedHolonID);
		} else {
			showToast = true;
		}
	});

	// Reactive statement to update route when ID changes
	$: if ($ID) {
		showToast = false;
		holonID = $ID;
		updateRoute($ID);
	}

	function updateRoute(id: string) {
		let currentPath = $page.url.pathname.split('/').pop();
		if (currentPath === holonID) currentPath = 'dashboard';
		goto(`/${id ? id : 'holonid'}/${currentPath}`);
	}

	function handleInput(event: Event) {
		const target = event.target as HTMLInputElement;
		ID.set(target.value);
		localStorage.setItem('holonID', target.value);
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			handleInput(event);
		}
	}

	// Clean up the subscription when the component is destroyed
	onDestroy(() => {
		// No need for explicit unsubscribe as we're using the $store syntax
	});
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
</style>

<header class="h-20 items-center relative z-10">
	<div
		class="flex flex-center flex-col h-full justify-center mx-auto relative px-3 text-white z-10"
	>
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
					<span class="absolute left-0 ml-4 text-gray-500 pointer-events-none">ID:</span>
					<input
						type="text"
						class="bg-gray-800 block leading-normal pl-12 py-1.5 pr-4 ring-opacity-90 rounded-2xl text-gray-400 w-full focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
						placeholder="Holon ID"
						on:keydown={handleKeydown}
						on:blur={handleInput}
						value={holonID}
					/>
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
