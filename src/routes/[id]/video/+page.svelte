<script lang="ts">
  import SimpleVideoCall from '../../../components/SimpleVideoCall.svelte';
  import { page } from '$app/stores';
  import { ID } from '../../../dashboard/store';
  import { onMount } from 'svelte';

  // Ensure the ID store is updated when the page parameters change
  $: if ($page.params.id) {
    ID.set($page.params.id);
  }

  onMount(() => {
    // If ID wasn't set from the reactive statement initially (e.g. direct navigation)
    if ($page.params.id && $ID !== $page.params.id) {
      ID.set($page.params.id);
    }
  });
</script>

<SimpleVideoCall roomId={$ID} /> 