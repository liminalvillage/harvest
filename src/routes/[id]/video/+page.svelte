<script lang="ts">
  import VideoChat from '../../../components/VideoChat.svelte';// Adjust path if VideoChat.svelte is elsewhere
  import { page } from '$app/stores';
  import { ID } from '../../../dashboard/store'; // Assuming ID store is used to pass the holonId
  import { onMount } from 'svelte';

  // Ensure the ID store is updated when the page parameters change
  // This might already be handled in a layout file or TopBar, but good to be explicit for a page component
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

<div>
  <h1>Video Chat for Holon: {$ID}</h1>
  <VideoChat roomId={$ID} />
</div>

<style>
  div {
    padding: 20px;
    width: 100%;
    max-width: 100%;
    box-sizing: border-box;
    min-height: fit-content; /* Allow natural height */
  }
  h1 {
    margin-bottom: 20px;
    color: #333;
    word-wrap: break-word;
  }
</style> 