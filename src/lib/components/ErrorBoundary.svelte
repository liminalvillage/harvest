<script lang="ts">
    import { onError } from 'svelte';
    
    let error: Error | null = null;
    
    onError((e) => {
        console.error('Detailed error:', e);
        error = e;
    });
</script>

{#if error}
    <div class="error-boundary p-4 bg-red-100 border border-red-400 text-red-700 rounded">
        <h2 class="font-bold mb-2">Something went wrong</h2>
        <pre class="text-sm overflow-auto">{error.message}</pre>
        <button 
            class="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            on:click={() => window.location.reload()}
        >
            Reload page
        </button>
    </div>
{:else}
    <slot />
{/if} 