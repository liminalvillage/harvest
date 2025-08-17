<script lang="ts">
	import 'tailwindcss/tailwind.css';
	import { page } from '$app/stores';
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { data } from './sidebar/data';
	import { onDestroy, onMount, setContext } from 'svelte';
	import { autoTransitionEnabled } from './store';
	import { fade, slide } from 'svelte/transition';

	import TopBar from './TopBar.svelte';
	import Overlay from './Overlay.svelte';
	import Sidebar from './sidebar/Sidebar.svelte';
	import MyHolons from '../components/MyHolons.svelte';
	import RouteTransition from '../components/RouteTransition.svelte';
	import ClockOverlay from '../components/ClockOverlay.svelte';

	const style = {
		container: `bg-gray-900 h-screen overflow-hidden relative`,
		mainContainer: `flex flex-col h-screen pl-0 w-full lg:pl-20 lg:space-y-4`,
		main: `h-screen overflow-auto pb-36 pt-4 px-2 md:pb-8 md:pt-4 lg:pt-0 lg:px-4`,
		rootContainer: `bg-gray-900 h-screen overflow-hidden relative`,
		rootMain: `h-screen overflow-auto p-4`
	};

	let lastMouseMove = Date.now();
	let currentRouteIndex = 0;
	let showMyHolons = false;
	let showClockOverlay = false;

	// Check if we're on the root route
	$: isRootRoute = $page.url.pathname === '/';

	// Define the allowed routes for auto-switching
	const allowedRoutes = data.filter(item => 
		['/tasks', '/schedule', '/roles', '/offers', '/status'].includes(item.link)
	);

	// Handle mouse movement
	function handleMouseMove() {
		lastMouseMove = Date.now();
	}

	// Handle global keyboard shortcuts
	function handleGlobalKeydown(event: KeyboardEvent) {
		// Toggle clock overlay with Ctrl+Shift+C or Cmd+Shift+C
		if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'C') {
			event.preventDefault();
			toggleClockOverlay();
		}
	}

	function toggleMyHolons() {
		showMyHolons = !showMyHolons;
	}

	function toggleClockOverlay() {
		showClockOverlay = !showClockOverlay;
	}

	// Set up auto-switching if in browser
	if (browser) {
		// Set up mouse move listener
		window.addEventListener('mousemove', handleMouseMove);

		// Set up interval for route switching
		const interval = setInterval(() => {
			const now = Date.now();
			// Only switch if auto-transition is enabled
			if ($autoTransitionEnabled && now - lastMouseMove >= 10 * 1000) {
				currentRouteIndex = (currentRouteIndex + 1) % allowedRoutes.length;
				goto('/' + $page.params.id + allowedRoutes[currentRouteIndex].link);
			}
		}, 10000); // 10 seconds

		// Cleanup on component destroy
		onDestroy(() => {
			clearInterval(interval);
			window.removeEventListener('mousemove', handleMouseMove);
		});
	}

	// Close drawer when a holon is selected (ID changes)
	page.subscribe((val) => {
		if (showMyHolons) {
			showMyHolons = false;
		}
	});

</script>

<svelte:window on:keydown={handleGlobalKeydown} />

{#if isRootRoute}
	<!-- Root route layout: Clean MyHolons view -->
	<div class={style.rootContainer}>
		<main class={style.rootMain}>
			<MyHolons />
		</main>
	</div>
{:else}
	<!-- Normal dashboard layout -->
	<div class={style.container} on:mousemove={handleMouseMove} role="presentation">
		<div class="flex items-start">
			<Overlay />
			<Sidebar mobileOrientation="start" />
			<div class={style.mainContainer}>
				<TopBar {toggleMyHolons} {toggleClockOverlay} />
				<main class={style.main}>
					<RouteTransition pathname={$page.url.pathname}>
						<slot />
					</RouteTransition>
				</main>
			</div>
		</div>

		{#if showMyHolons}
			<div
				class="absolute inset-0 z-40"
				on:click|self={() => showMyHolons = false}
				role="presentation"
				transition:fade
			>
				<div class="absolute top-0 left-4 right-4" transition:slide>
					<div class="bg-gray-900/90 backdrop-blur-sm max-h-[80vh] overflow-y-auto rounded-b-xl">
						<MyHolons />
					</div>
				</div>
			</div>
		{/if}

		<!-- Clock Overlay -->
		<ClockOverlay bind:isVisible={showClockOverlay} />
	</div>
{/if}
