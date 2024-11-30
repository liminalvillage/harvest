<script lang="ts">
	import { setContext } from 'svelte';
	import HoloSphere from 'holosphere';
	import Layout from '../dashboard/Layout.svelte';

	// Create holosphere instance at the root level
	const holosphere = new HoloSphere('Holons');
	
	// Set the context here, before any child components
	setContext('holosphere', holosphere);
</script>

<Layout>
<slot />
</Layout>
