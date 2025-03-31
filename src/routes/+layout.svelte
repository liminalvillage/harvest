<script lang="ts">
	import { setContext } from 'svelte';
	import HoloSphere from "holosphere"
	import Layout from '../dashboard/Layout.svelte';

	let error: Error | null = null;

	try {
		let environmentName: string =
			import.meta.env.NODE_ENV === "development" ? "HolonsDebug" : "Holons";
		
		const holosphere = new HoloSphere(environmentName);
		setContext('holosphere', holosphere);
	} catch (e) {
		error = e as Error;
		console.error("Failed to initialize HoloSphere:", e);
	}
</script>

<svelte:head>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
</svelte:head>

{#if error}
	<div class="p-4 bg-red-100 border border-red-400 text-red-700 rounded">
		<h2 class="font-bold">Failed to initialize application</h2>
		<pre class="text-sm">{error.message}</pre>
	</div>
{:else}
	<Layout>
		<slot />
	</Layout>
{/if}
