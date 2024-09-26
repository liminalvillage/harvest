<script>
	import Roles from '../../../components/Roles.svelte';

	let ID;

  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    ID = localStorage.getItem('ID');
  } else {
    ID = null; // or some default value
  }
</script>

<svelte:head>
	<title>Roles</title>
</svelte:head>

<Roles holonID={ID}/>
