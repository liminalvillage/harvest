<script lang="ts">
  import Dashboard from '../../components/Dashboard.svelte';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';

  onMount(() => {
    // Check if the holon ID is valid
    const holonId = $page.params.id;
    // Only redirect if the ID is truly invalid (undefined, null, empty, or string 'undefined'/'null')
    if (!holonId || holonId === 'undefined' || holonId === 'null' || holonId.trim() === '') {
      // Redirect to root if no valid holon ID, but only if not already there
      if (typeof window !== 'undefined' && window.location.pathname !== '/') {
        goto('/');
      }
    }
  });
</script>

<svelte:head>
  <title>Dashboard</title>
</svelte:head>
 
<Dashboard />
