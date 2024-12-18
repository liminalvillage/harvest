<script lang="ts">
	import { setContext } from 'svelte';
	import HoloSphere from "../../../holosphere/holosphere"
	import Layout from '../dashboard/Layout.svelte';

    let environmentName: string =
        import.meta.env.VITE_LOCAL_MODE === "development" ? "HolonsDebug" : "Holons";

	console.log(import.meta.env.VITE_LOCAL_MODE)
    console.log("Environment:", environmentName)
	// Create holosphere instance at the root level
	const holosphere = new HoloSphere(environmentName);
	
	// Set the context here, before any child components
	setContext('holosphere', holosphere);
</script>

<svelte:head>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
</svelte:head>

<Layout>
<slot />
</Layout>
