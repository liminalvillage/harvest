<script lang="ts">
  import Dashboard from '../../components/Dashboard.svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';

  onMount(() => {
    // Check if holonid exists in the page parameters
    if ($page.params.id) {
      goto(`/${$page.params.id}/dashboard`, { replaceState: true });
    }
  });
</script>

<svelte:head>
  <title>Dashboard</title>
</svelte:head>
 
<Dashboard />
