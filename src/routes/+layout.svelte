<script lang="ts">
	import { setContext } from 'svelte';
	import HoloSphere from 'holosphere';
	import Layout from '../dashboard/Layout.svelte';

    let environmentName: string =
        import.meta.env.LOCAL_MODE === "development" ? "HolonsDebug" : "Holons";
    console.log("Environment:", environmentName)
	// Create holosphere instance at the root level
	const holosphere = new HoloSphere(environmentName);
	
	// Set the context here, before any child components
	setContext('holosphere', holosphere);
</script>

<Layout>
<slot />
</Layout>
