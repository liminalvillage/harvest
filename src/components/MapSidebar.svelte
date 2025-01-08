<script lang="ts">
    import { onDestroy, getContext } from "svelte";
    import { formatDate, formatTime } from "../utils/date";
    import type { Writable } from "svelte/store";
    import { ID } from "../dashboard/store";
    import SchemaForm from './SchemaForm.svelte';
    import { schemas, type SchemaName } from '../lib/schemas';
    import HoloSphere from "holosphere";
    import { createEventDispatcher } from 'svelte';
    const dispatch = createEventDispatcher();

    // Update schema options to use imported schemas
    const schemaOptions = [
        { 
            value: 'quests', 
            label: 'Tasks', 
            schema: 'quests_schema_v0.0.1' as SchemaName
        },
        { 
            value: 'needs', 
            label: 'Local Needs', 
            schema: 'offers_wants_prototype-v0.0.2' as SchemaName
        },
        { 
            value: 'offers', 
            label: 'Offers', 
            schema: 'offers_wants_prototype-v0.0.2' as SchemaName
        },
        { 
            value: 'communities', 
            label: 'Communities', 
            schema: 'communities_schema-v0.1.0' as SchemaName
        },
        { 
            value: 'organizations', 
            label: 'Organizations', 
            schema: 'organizations_schema-v1.0.0' as SchemaName
        },
        { 
            value: 'projects', 
            label: 'Projects', 
            schema: 'projects_schema-v0.1.0' as SchemaName
        },
        { 
            value: 'currencies', 
            label: 'Currencies', 
            schema: 'complementary_currencies-v2.0.0' as SchemaName
        },
        { 
            value: 'people', 
            label: 'People', 
            schema: 'person_schema-v0.2.0' as SchemaName
        },
        { 
            value: 'holons', 
            label: 'Holons', 
            schema: 'holons_schema-v0.0.1' as SchemaName
        }
    ];
 

    export let selectedLens: string;
    export let hexId: string | null;
    let holosphere = getContext('holosphere') as HoloSphere;
    let content: Record<string, any> | null = null;
    let subscription: { off: () => void } | null = null;
    let showForm = false;
    let formData: Record<string, any> = {};
    let viewingItem: Record<string, any> | null = null;

    // Add statistics interface
    interface HolonStats {
        total: number;
        completed?: number;
    }

    let stats: Record<string, HolonStats> | null = null;

    async function loadData(holonId: string, lens: string) {
        if (!holonId || !lens) return;
        
        try {
            // Get all items for this lens
            const items = await holosphere.getAll(holonId, lens);
            content = items;
            
            // Calculate statistics
            if (items) {
                stats = {
                    [lens]: {
                        total: Object.keys(items).length,
                        completed: lens === 'quests' ? 
                            Object.values(items).filter((q: any) => q.status === 'completed').length : 
                            undefined
                    }
                };
            } else {
                stats = { [lens]: { total: 0 } };
            }
        } catch (error) {
            console.error('Error loading data:', error);
            content = null;
            stats = null;
        }
    }

    // Reset and load data when hexId or lens changes
    $: if (hexId) {
        console.log('ID or lens changed:', hexId, selectedLens);
        showForm = false;
        formData = {};
        viewingItem = null;
        loadData(hexId, selectedLens);
    }

    $: if (selectedLens && hexId) {
        loadData(hexId, selectedLens);
    }

    function subscribe() {
        if (!hexId || !selectedLens) return;
        
        try {
            const off = holosphere.subscribe(hexId, selectedLens, async (data: any) => {
                if (data) {
                    console.log('Data received:', data);
                    // Get all items for this lens
                    const allData = await holosphere.getAll(hexId, selectedLens);
                    content = allData;
                } else {
                    content = null;
                }
            });
            
            // Initial data load
            holosphere.getAll(hexId, selectedLens).then((data) => {
                content = data;
            });
            
            if (typeof off === 'function') {
                subscription = { off };
            }
        } catch (error) {
            console.error('Error subscribing:', error);
            content = null;
        }
    }

    function unsubscribe() {
        try {
            if (subscription?.off) {
                subscription.off();
                subscription = null;
                content = null;
            }
        } catch (error) {
            console.error('Error unsubscribing:', error);
        }
    }

    function toggleForm() {
        console.log('Toggling form, current state:', showForm);
        showForm = !showForm;
        if (!showForm) {
            formData = {};
            viewingItem = null;
        }
    }

    async function handleFormSubmit(event: CustomEvent) {
        const newFormData = event.detail;
        
        if (!hexId) {
            console.error('No hexagon selected');
            return;
        }

        try {
            const updatedContent = { ...newFormData };
            await holosphere.put(hexId, selectedLens, updatedContent);
            
            showForm = false;
            formData = {};
            
            console.log('Successfully stored new entry:', updatedContent);
        } catch (error) {
            console.error('Failed to store entry:', error);
        }
    }

    // Add color function from Tasks component
    function getColorFromCategory(category: string | undefined): string {
        if (!category) return "#E5E7EB"; // Light gray (gray-200) for items without category

        // Simple string hash function
        let hash = 0;
        for (let i = 0; i < category.length; i++) {
            hash = (hash << 5) - hash + category.charCodeAt(i);
            hash = hash & hash;
        }

        // Generate HSL color with consistent saturation and lightness
        const hue = Math.abs(hash % 360);
        return `hsl(${hue}, 70%, 85%)`; // Pastel colors with good contrast for text
    }

  

    function getSchemaForLens(lens: string): Record<string, any> | null {
        const schemaName = schemaOptions.find(opt => opt.value === lens)?.schema;
        return schemaName ? schemas[schemaName] : null;
    }

    function viewItem(item: Record<string, any> | null) {
        if (item) {
            viewingItem = item;
            showForm = true;
        }
    }

    function closeView() {
        viewingItem = null;
        showForm = false;
    }

    onDestroy(() => {
        unsubscribe();
    });

</script>

<div class="w-full lg:w-4/12 pl-4">
    <div class="bg-gray-800 rounded-3xl p-6 sidebar-container">
        <!-- Header -->
        <div class="flex justify-between text-white items-center mb-8">
            <div>
                <p class="text-2xl font-bold">Details</p>
                <p class="text-lg mt-1">View and edit content</p>
            </div>
            <div>
                {#if selectedLens}
                    <button
                        class="px-3 py-2 bg-gray-700 text-gray-200 rounded-lg hover:bg-gray-600 border border-gray-600 transition-colors flex items-center gap-2"
                        on:click={toggleForm}
                    >
                        {#if showForm}
                            <span class="text-lg">×</span> Cancel
                        {:else}
                            <span class="text-lg">+</span> Add New
                        {/if}
                    </button>
                {/if}
            </div>
        </div>

        <!-- Statistics -->
        {#if stats && stats[selectedLens]}
            <div class="bg-gray-700 p-4 rounded-lg mb-6">
                <div class="flex justify-between items-center">
                    <h3 class="text-gray-400 text-sm">Statistics</h3>
                    <p class="text-white text-sm">
                        {#if stats[selectedLens].completed !== undefined}
                            {stats[selectedLens].completed} / {stats[selectedLens].total}
                            <span class="text-gray-400 text-xs ml-1">Completed</span>
                        {:else}
                            {stats[selectedLens].total}
                            <span class="text-gray-400 text-xs ml-1">Total</span>
                        {/if}
                    </p>
                </div>
            </div>
        {/if}

        <!-- Scrollable Content -->
        <div class="scrollable-content">
            {#if showForm}
                <div class="p-4 bg-gray-700 rounded-lg transition-all">
                    {#key selectedLens}
                        <div class="flex justify-between items-center mb-4">
                            <h3 class="text-white font-medium">
                                {viewingItem ? 'View' : 'Add New'} {schemaOptions.find(opt => opt.value === selectedLens)?.label.split(' ').slice(1).join(' ')}
                            </h3>
                            <button 
                                class="text-gray-400 hover:text-white"
                                on:click={viewingItem ? closeView : toggleForm}
                            >
                                ×
                            </button>
                        </div>
                        {#if selectedLens}
                            <SchemaForm 
                                schema={schemaOptions.find(opt => opt.value === selectedLens)?.schema || ''} 
                                schemaDefinition={getSchemaForLens(selectedLens)}
                                {hexId}
                                initialData={viewingItem || formData}
                                viewOnly={!!viewingItem}
                                on:submit={handleFormSubmit}
                            />
                        {/if}
                    {/key}
                </div>
            {:else if content}
                <div class="space-y-4">
                    {#if typeof content === 'object'}
                        {#each Object.entries(content) as [key, item]}
                            <button 
                                type="button"
                                class="w-full text-left p-4 bg-gray-700 rounded-lg cursor-pointer hover:bg-gray-600 transition-colors"
                                on:click={() => viewItem(item)}
                            >
                                <h4 class="font-medium text-white">{item.title || item.name}</h4>
                                {#if item.description}
                                    <p class="text-gray-300 text-sm mt-1 line-clamp-2">{item.description}</p>
                                {/if}
                                {#if item.tags?.length}
                                    <div class="flex flex-wrap gap-2 mt-2">
                                        {#each item.tags as tag}
                                            <span class="text-xs bg-gray-600 text-white px-2 py-0.5 rounded-full">
                                                {tag}
                                            </span>
                                        {/each}
                                    </div>
                                {/if}
                            </button>
                        {/each}
                    {/if}
                </div>
            {:else}
                <div class="text-white text-center py-8">
                    <p class="text-lg opacity-70">Select a location to view details</p>
                </div>
            {/if}
        </div>
    </div>
</div>

<style>
    .sidebar-container {
        height: calc(100vh - 64px - 2rem);
        display: flex;
        flex-direction: column;
    }

    .scrollable-content {
        flex: 1;
        overflow-y: auto;
        scrollbar-width: thin;
        scrollbar-color: rgba(255, 255, 255, 0.2) transparent;
        padding-right: 0.5rem;
        margin-right: -0.5rem;
    }

    .scrollable-content::-webkit-scrollbar {
        width: 6px;
    }

    .scrollable-content::-webkit-scrollbar-track {
        background: transparent;
    }

    .scrollable-content::-webkit-scrollbar-thumb {
        background-color: rgba(255, 255, 255, 0.2);
        border-radius: 3px;
    }
</style>
  