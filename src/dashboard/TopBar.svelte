<script lang="ts">
	import { openSidebar, ID } from './store';
	import { onMount, onDestroy } from 'svelte';
	import { page } from '$app/stores';
	import {goto} from '$app/navigation';

	// Subscribe to the store to automatically save the value in localStorage
	
	$: holonID = $ID;

	const unsubscribe = ID.subscribe(value => {
		holonID = value;
		ID.set(value); // Update localStorage when the value changes
	});

	// Clean up the subscription when the component is destroyed
	onDestroy(() => {
		unsubscribe();
	});

	onMount(() => {
		const storedHolonID =  $page.params.id;
		if (storedHolonID) {
			ID.set(storedHolonID);
		}
	});

	// Handle input changes
	function handleInput(event: Event) {
		const target = event.target as HTMLInputElement;
		ID.set(target.value); // Update the store, re-rendering all dependent components
		localStorage.setItem('holonID', target.value);
		//get current path
		let	currentPath = $page.url.pathname.split('/').pop();
		goto(`/${target.value}/${currentPath}`);
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			handleInput(event);
		}
	}
</script>


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
				<div class="group hidden items-center ml-8 relative w-full md:flex lg:w-72">
					<div
						class="absolute block cursor-pointer flex items-center justify-center h-10 p-3 pr-2 text-gray-500 text-sm uppercase w-auto sm:hidden"
					>
						<svg
							fill="none"
							class="h-5 relative w-5"
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width={2}
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
						</svg>
					</div>
					<svg
						class="absolute fill-current h-4 hidden left-0 ml-4 pointer-events-none text-gray-500 w-4 group-hover:text-gray-400 sm:block"
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 20 20"
					>
						<path
							d="M12.9 14.32a8 8 0 1 1 1.41-1.41l5.35 5.33-1.42 1.42-5.33-5.34zM8 14A6 6 0 1 0 8 2a6 6 0 0 0 0 12z"
						/>
					</svg>
					<input
						type="text"
						class="bg-gray-800 block leading-normal pl-10 py-1.5 pr-4 ring-opacity-90 rounded-2xl text-gray-400 w-full focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
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
