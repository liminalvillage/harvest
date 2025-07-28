<script lang="ts">
  import MyHolons from '../components/MyHolons.svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import 'tailwindcss/tailwind.css';

  onMount(() => {
    // Only redirect if we have a holon ID in the URL path (not from store)
    // The root page should always show MyHolons, regardless of store state
    // Individual holon pages will handle their own redirects
  });
</script>

<svelte:head>
  <title>My Holons</title>
</svelte:head>

<MyHolons />

