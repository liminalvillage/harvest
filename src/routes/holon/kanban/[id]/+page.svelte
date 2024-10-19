<script>
	import { page } from '$app/stores';
    import { ID } from '../../../../dashboard/store';
    import { getContext } from 'svelte';
    import Kanban from '../../../../components/Kanban.svelte';

	const id = $page.url.pathname.split('/').pop(); // or use $page.params
    

</script>


<svelte:head>
	<title>Kanban {$page.params.id}</title>
</svelte:head>
<Kanban id={$page.params.id}/>
