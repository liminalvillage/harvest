<script>
	import Map from '../../../components/Map.svelte';
</script>

<svelte:head>
	<title>Map</title>
</svelte:head>

<Map holonID={typeof window !== 'undefined'?localStorage.getItem('ID'):''}/>
