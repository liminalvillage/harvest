<script lang="ts">
  import { page } from '$app/stores';
  import Settings from '../../../components/Settings.svelte';
  let holonId = $page.params.id;
</script>

<svelte:head>
  <title>Settings - Holon {holonId}</title>
  <meta name="description" content="Configure settings for Holon {holonId}" />
</svelte:head>

<Settings holonId={holonId} /> 