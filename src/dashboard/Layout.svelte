<script lang="ts">
	import 'tailwindcss/tailwind.css';
	import { page } from '$app/stores';
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { data } from './sidebar/data';
	import { onDestroy, onMount, setContext } from 'svelte';
	import { autoTransitionEnabled } from './store';

	import TopBar from './TopBar.svelte';
	import Overlay from './Overlay.svelte';
	import Sidebar from './sidebar/Sidebar.svelte';
	import { closeSidebar, sidebarOpen } from './store';
	import RouteTransition from '../components/RouteTransition.svelte';

	const style = {
		container: `bg-gray-900 h-screen overflow-hidden relative`,
		mainContainer: `flex flex-col h-screen pl-0 w-full lg:pl-20 lg:space-y-4`,
		main: `h-screen overflow-auto pb-36 pt-4 px-2 md:pb-8 md:pt-4 lg:pt-0 lg:px-4`
	};

	let lastMouseMove = Date.now();
	let currentRouteIndex = 0;

	// Define the allowed routes for auto-switching
	const allowedRoutes = data.filter(item => 
		['/tasks', '/schedule', '/roles', '/offers', '/status'].includes(item.link)
	);

	// Handle mouse movement
	function handleMouseMove() {
		lastMouseMove = Date.now();
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

	page.subscribe(() => {
		// close Sidebar on route changes.
		if ($sidebarOpen) {
			closeSidebar();
		}
	});
</script>

<div class={style.container} role="presentation" on:mousemove={handleMouseMove}>
	<div class="flex items-start">
		<Overlay />
		<Sidebar mobileOrientation="start" />
		<div class={style.mainContainer}>
			<TopBar />
			<main class={style.main}>
				<RouteTransition pathname={$page.url.pathname}>
					<slot />
				</RouteTransition>
			</main>
		</div>
	</div>
</div>
