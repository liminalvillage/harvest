<script lang="ts">
	import { setContext, onDestroy } from 'svelte';
	import HoloSphere from "holosphere"
	import Layout from '../dashboard/Layout.svelte';

    let environmentName: string =
        import.meta.env.VITE_LOCAL_MODE === "development" ? "HolonsDebug" : "Holons";

	console.log(import.meta.env.VITE_LOCAL_MODE)
    console.log("Environment:", environmentName)
	
	// Create holosphere instance at the root level with memory management settings
	const holosphere = new HoloSphere(environmentName, false, null, {
		opt: {
			peers: ['https://gun.holons.io/gun'],
			axe: false,
			// Add memory management configuration
			localStorage: false, // Use memory storage instead of localStorage
			memory: {
				limit: 500 * 1024 * 1024, // Set memory limit to 500MB
				check: 30 * 1000 // Check memory usage every 30 seconds
			},
			radisk: false, // Disable radisk persistence to reduce memory usage
			radmem: true, // Use in-memory radix storage
			disableWebRTC: true, // Disable WebRTC to reduce connections and memory usage
			disablePing: true, // Disable ping to reduce network activity
		}
	});
	
	// Periodically check for garbage collection opportunities
	const gcInterval = setInterval(() => {
		if (typeof window !== 'undefined') {
			// Request browser to run garbage collection by forcing memory pressure
			try {
				// Create and quickly release a large array to hint the browser
				// that it might want to run GC
				const largeArray = new Array(10 * 1024 * 1024).fill(0);
				setTimeout(() => {
					// Release the reference immediately
					largeArray.length = 0;
				}, 50);
			} catch (e) {
				// Ignore any errors, this is just an optimization
			}
		}
	}, 60 * 1000); // Run every minute
	
	// Set the context here, before any child components
	setContext('holosphere', holosphere);
	
	// Clean up on destroy
	onDestroy(() => {
		clearInterval(gcInterval);
		
		// Close Holosphere connection when the app is destroyed
		if (holosphere && typeof holosphere.close === 'function') {
			holosphere.close();
		}
	});
</script>

<svelte:head>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
</svelte:head>

<Layout>
<slot />
</Layout>
