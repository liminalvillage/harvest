<script lang="ts">
    import Expenses from "../../../components/Expenses.svelte";
    import { page } from '$app/stores';
    import { ID } from '../../../dashboard/store';
    import { onMount } from 'svelte';

    // Set the ID from URL params
    onMount(() => {
        const holonId = $page.params.id;
        if (holonId) {
            ID.set(holonId);
        }
    });
</script>

<Expenses /> 