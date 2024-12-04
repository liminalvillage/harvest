<script lang="ts">
    import { setContext } from 'svelte';
    import HoloSphere from 'holosphere';


    console.log("Logging the environment variables", import.meta.env.MODE);
    let environmentName: string =
        import.meta.env.MODE === "development" ? "HolonsDebug" : "Holons";

    const holosphere = new HoloSphere(environmentName);
    setContext('holosphere', holosphere);
</script>

<slot /> 