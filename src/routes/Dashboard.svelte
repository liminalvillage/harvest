<script lang="ts">
    import Map from '../components/Map.svelte';
    import TopBar from '../dashboard/TopBar.svelte';
    
    function toggleMyHolons() {
        // This route doesn't have MyHolons functionality, so we'll do nothing
        console.log('MyHolons toggle requested from Dashboard route');
    }
</script>

<TopBar {toggleMyHolons} />
<Map />
<!-- Other dashboard components -->
