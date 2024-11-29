<script lang="ts">
    import { setContext } from 'svelte';
    import HoloSphere from 'holosphere';

    const holosphere = new HoloSphere('Holons');
    setContext('holosphere', holosphere);
</script>

<slot /> 