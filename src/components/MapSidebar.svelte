<script lang="ts">
    // @ts-nocheck -- Disabling TypeScript checking for this file due to Svelte 5 JSX compatibility issues
    import { onDestroy, onMount, getContext } from "svelte";
    import { formatDate, formatTime } from "../utils/date";
    import type { Writable } from "svelte/store";
    import { ID } from "../dashboard/store";
    import SchemaForm from './SchemaForm.svelte';
    import { schemas, type SchemaName } from '../lib/schemas';
    import HoloSphere from "holosphere";
    import { createEventDispatcher } from 'svelte';
    import type { LensType, HexagonStats } from '../types/Map';
    const dispatch = createEventDispatcher();

    // Update schema options to use imported schemas
    const schemaOptions = [
        { 
            value: 'quests' as LensType, 
            label: 'Tasks', 
            schema: 'quests_schema_v0.0.1' as SchemaName
        },
        { 
            value: 'needs' as LensType, 
            label: 'Local Needs', 
            schema: 'offers_wants_prototype-v0.0.2' as SchemaName
        },
        { 
            value: 'offers' as LensType, 
            label: 'Offers', 
            schema: 'offers_wants_prototype-v0.0.2' as SchemaName
        },
        { 
            value: 'communities' as LensType, 
            label: 'Communities', 
            schema: 'communities_schema-v0.1.0' as SchemaName
        },
        { 
            value: 'organizations' as LensType, 
            label: 'Organizations', 
            schema: 'organizations_schema-v1.0.0' as SchemaName
        },
        { 
            value: 'projects' as LensType, 
            label: 'Projects', 
            schema: 'projects_schema-v0.1.0' as SchemaName
        },
        { 
            value: 'currencies' as LensType, 
            label: 'Currencies', 
            schema: 'complementary_currencies-v2.0.0' as SchemaName
        },
        { 
            value: 'people' as LensType, 
            label: 'People', 
            schema: 'person_schema-v0.2.0' as SchemaName
        },
        { 
            value: 'holons' as LensType, 
            label: 'Holons', 
            schema: 'holons_schema-v0.0.1' as SchemaName
        }
    ];
 

    export let selectedLens: LensType;
    export let hexId: string | undefined;
    export let isOverlay: boolean = false; // Flag to indicate if shown as overlay
    
    let holosphere = getContext('holosphere') as HoloSphere;
    let content: Record<string, any> | null = null;
    let showForm = false;
    let formData: Record<string, any> = {};
    let viewingItem: Record<string, any> | null = null;
    let store: Record<string, any> = {};
    let lastLens: string | null = null;
    
    // Track if we have already fetched data for this ID and lens
    let activeFetchKey: string | null = null;
    let isFetching = false;

    // Add loading state indicator
    let isLoading = false;

    // Add statistics
    let stats: Record<string, HexagonStats> | null = null;

    // Create a unique key for this combination of ID and lens
    function getFetchKey(id: string | null, lens: string | null): string | null {
        if (!id || !lens) return null;
        return `${id}-${lens}`;
    }

    // Add a safety timeout for loading state
    function ensureLoadingReset() {
        isFetching = false;
        isLoading = false;
    }

    // Reset all state and ensure proper cleanup
    function resetUIState() {
        console.log('[MapSidebar] Resetting UI state');
        // Clear content and stats
        store = {};
        content = null;
        stats = null;
        
        // Reset UI elements
        showForm = false;
        formData = {};
        viewingItem = null;
        
        // Clear any active fetch key
        activeFetchKey = null;
        
        // Reset loading states
        isFetching = false;
        isLoading = false;
    }

    // Comprehensive cleanup function to ensure all resources are released
    function performFinalCleanup() {
        console.log('[MapSidebar] Performing final cleanup...');
        
        // Reset all UI state
        resetUIState();
        
        // Ensure large data structures are properly cleared
        store = {};
        content = null;
        stats = null;
        
        console.log('[MapSidebar] Final cleanup complete');
    }

    async function fetchData(holonId: string, lens: string) {
        if (!holonId || !lens) return;
        
        // Skip if we're already fetching this data
        const fetchKey = getFetchKey(holonId, lens);
        if (fetchKey === activeFetchKey && isFetching) {
            console.log('[MapSidebar] Already fetching data for', holonId, lens);
            return;
        }
        
        // Store the current fetch key to track if lens/ID changes during fetch
        const currentFetchKey = fetchKey;
        
        try {
            console.log('[MapSidebar] Fetching data for:', holonId, lens);
            isFetching = true;
            isLoading = true;
            activeFetchKey = currentFetchKey;
            
            // First make sure we're starting with a clean state
            store = {};
            content = null;
            showForm = false;
            formData = {};
            viewingItem = null;
            
            // Set a safety timeout to reset loading state
            const safetyTimeout = setTimeout(ensureLoadingReset, 10000); // 10 seconds timeout
            
            // Get all items for this lens - use non-blocking promise
            holosphere.getAll(holonId, lens)
                .then(async items => {
                    // Check if lens/ID changed during fetch
                    if (activeFetchKey !== currentFetchKey) {
                        console.log('[MapSidebar] Lens or ID changed during fetch, discarding results');
                        clearTimeout(safetyTimeout);
                        isFetching = false;
                        isLoading = false;
                        return;
                    }
                    
                    console.log('[MapSidebar] Data received:', items?.length || 0, 'items');
                    
                    if (items && items.length > 0) {
                        // Process items to handle references/soul links
                        const processedItems = await Promise.all(items.map(async (item) => {
                            // Check if this is a reference/soul link
                            if (item.soul) {
                                console.log('[MapSidebar] Found soul link:', item.soul);
                                try {
                                    // Try to resolve the soul link
                                    const resolvedItem = await holosphere.getNodeBySoul(item.soul);
                                    if (resolvedItem) {
                                        // Parse if needed
                                        const parsedItem = typeof resolvedItem === 'string' ? 
                                            JSON.parse(resolvedItem) : resolvedItem;
                                        
                                        console.log('[MapSidebar] Resolved soul link:', parsedItem);
                                        return {
                                            ...parsedItem,
                                            _federation: {
                                                isReference: true,
                                                resolved: true, 
                                                soul: item.soul,
                                                timestamp: Date.now()
                                            }
                                        };
                                    }
                                } catch (error) {
                                    console.error('[MapSidebar] Error resolving soul link:', error);
                                }
                            }
                            
                            // Handle federation references
                            if (item._federation && item._federation.isReference && !item._federation.resolved) {
                                console.log('[MapSidebar] Found federation reference to resolve');
                                try {
                                    // Try to resolve federation reference
                                    const resolvedItem = await holosphere.get(
                                        item._federation.origin,
                                        item._federation.lens || lens,
                                        item.id,
                                        null,
                                        { resolveReferences: false }
                                    );
                                    
                                    if (resolvedItem) {
                                        console.log('[MapSidebar] Resolved federation reference:', resolvedItem);
                                        return {
                                            ...resolvedItem,
                                            _federation: {
                                                ...item._federation,
                                                resolved: true,
                                                timestamp: Date.now()
                                            }
                                        };
                                    }
                                } catch (error) {
                                    console.error('[MapSidebar] Error resolving federation reference:', error);
                                }
                            }
                            
                            // Return original item if it's not a reference or couldn't be resolved
                            return item;
                        }));
                        
                        // Check again if lens/ID changed during fetch - especially important after
                        // resolving references which can take time
                        if (activeFetchKey !== currentFetchKey) {
                            console.log('[MapSidebar] Lens or ID changed during reference resolution, discarding results');
                            clearTimeout(safetyTimeout);
                            isFetching = false;
                            isLoading = false;
                            return;
                        }
                        
                        // Convert array to object with ID as key
                        const itemsMap = processedItems.reduce((acc: Record<string, any>, item: any) => {
                            if (item && item.id) {
                                acc[item.id] = item;
                            }
                            return acc;
                        }, {});
                        
                        store = itemsMap;
                        content = store;
                        
                        // Update statistics
                        stats = {
                            [lens]: {
                                total: Object.keys(store).length,
                                completed: lens === 'quests' 
                                    ? Object.values(store).filter((q: any) => q.status === 'completed').length 
                                    : undefined
                            }
                        };
                    } else {
                        // No data found
                        store = {};
                        content = null;
                        
                        // Empty statistics
                        stats = {
                            [lens]: {
                                total: 0,
                                completed: undefined
                            }
                        };
                    }
                    
                    console.log('[MapSidebar] Data processed, found', Object.keys(store).length, 'items');
                })
                .catch(error => {
                    console.error('[MapSidebar] Error fetching data:', error);
                    // Only reset if this is still the active fetch
                    if (activeFetchKey === currentFetchKey) {
                        resetUIState();
                    }
                })
                .finally(() => {
                    clearTimeout(safetyTimeout);
                    // Only reset loading state if this is still the active fetch
                    if (activeFetchKey === currentFetchKey) {
                        isFetching = false;
                        isLoading = false;
                    }
                });
        } catch (error) {
            console.error('[MapSidebar] Error in fetch setup:', error);
            resetUIState();
            isFetching = false;
            isLoading = false;
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
        
        if (!$ID) {
            console.error('No holon selected');
            return;
        }

        try {
            const updatedContent = { ...newFormData };
            
            // Use non-blocking promise approach
            holosphere.put($ID, selectedLens, updatedContent)
                .then(() => {
                    showForm = false;
                    formData = {};
                    
                    console.log('Successfully stored new entry:', updatedContent);
                    
                    // Refresh the data
                    fetchData($ID, selectedLens);
                })
                .catch(error => {
                    console.error('Failed to store entry:', error);
                });
        } catch (error) {
            console.error('Error preparing to store entry:', error);
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

    // Set up initial data fetch on mount
    onMount(() => {
        if ($ID && selectedLens) {
            fetchData($ID, selectedLens);
        }
    });

    // Make sure to clean up on destroy
    onDestroy(() => {
        console.log('[MapSidebar] Component being destroyed, cleaning up resources');
        performFinalCleanup();
    });

    // Also ensure we react to the ID store changes
    $: if ($ID) {
        const newKey = getFetchKey($ID, selectedLens);
        if (newKey !== activeFetchKey) {
            console.log(`[MapSidebar] ID changed to ${$ID}, fetching new data`);
            resetUIState();
            
            if ($ID && selectedLens) {
                fetchData($ID, selectedLens);
            }
        }
    }

    // React to lens changes
    $: if (selectedLens && $ID) {
        const newKey = getFetchKey($ID, selectedLens);
        if (newKey !== activeFetchKey && !isFetching) {
            console.log(`[MapSidebar] Lens changed to ${selectedLens}, fetching new data`);
            resetUIState();
            
            fetchData($ID, selectedLens);
        } else if (isFetching) {
            console.log(`[MapSidebar] Lens changed but fetch already in progress, will retry after current fetch completes`);
            // Store the requested lens and ID for processing after current fetch completes
            setTimeout(() => {
                const latestKey = getFetchKey($ID, selectedLens);
                if (latestKey !== activeFetchKey && !isFetching) {
                    console.log(`[MapSidebar] Retrying fetch for ${selectedLens} after prior fetch completed`);
                    resetUIState();
                    fetchData($ID, selectedLens);
                }
            }, 500);
        }
    }

</script>

<div class={isOverlay ? "overlay-sidebar" : "w-full lg:w-4/12 pl-4"}>
    <div class={isOverlay ? "overlay-container" : "bg-gray-800 rounded-3xl p-6 sidebar-container"}>
        <!-- Header (only show when not in overlay mode) -->
        {#if !isOverlay}
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
        {/if}

        <!-- Statistics -->
        {#if stats && stats[selectedLens]}
            <div class="bg-gray-700 p-4 rounded-lg mb-6">
                <div class="flex justify-between items-center">
                    <h3 class="text-gray-400 text-sm">Statistics</h3>
                    <p class="text-white text-sm">
                        {#if selectedLens === 'quests' && stats[selectedLens].total > 0}
                            {stats[selectedLens].total - (stats[selectedLens].completed || 0)} active / {stats[selectedLens].total} total
                        {:else}
                            {stats[selectedLens].total}
                            <span class="text-gray-400 text-xs ml-1">Total</span>
                        {/if}
                    </p>
                </div>
            </div>
        {/if}

        <!-- "Add New" button when in overlay mode -->
        {#if isOverlay && selectedLens && !showForm}
            <div class="mb-4">
                <button
                    class="w-full px-3 py-2 bg-gray-700 text-gray-200 rounded-lg hover:bg-gray-600 border border-gray-600 transition-colors flex items-center justify-center gap-2"
                    on:click={toggleForm}
                >
                    <span class="text-lg">+</span> Add New {schemaOptions.find(opt => opt.value === selectedLens)?.label}
                </button>
            </div>
        {/if}

        <!-- Loading Indicator -->
        {#if isLoading}
            <div class="loading-container">
                <div class="spinner"></div>
                <p class="text-gray-300 mt-2">Loading data...</p>
            </div>
        {/if}

        <!-- Scrollable Content -->
        <div class={isOverlay ? "overlay-scrollable-content" : "scrollable-content"}>
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
                                {ID}
                                initialData={viewingItem || formData}
                                viewOnly={!!viewingItem}
                                on:submit={handleFormSubmit}
                            />
                        {/if}
                    {/key}
                </div>
            {:else if content}
                <div class="space-y-4">
                    {#if typeof content === 'object' && content !== null}
                        {#each Object.entries(content)
                            .filter(([key, item]) => 
                                // Filter out null items
                                item !== null && 
                                // Filter out completed tasks if it's the quests lens
                                !(selectedLens === 'quests' && item.status === 'completed')
                            )
                            .sort((a, b) => {
                                // Sort by date if available (newest first)
                                if (a[1].date && b[1].date) {
                                    return new Date(b[1].date).getTime() - new Date(a[1].date).getTime();
                                }
                                // Sort by name/title if no date
                                const aName = a[1].name || a[1].title || '';
                                const bName = b[1].name || b[1].title || '';
                                return aName.localeCompare(bName);
                            })
                            as [key, item]}
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
            {:else if !isLoading}
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

    /* Overlay specific styles */
    .overlay-sidebar {
        width: 100%;
        height: 100%;
    }

    .overlay-container {
        height: 100%;
        padding: 1rem;
        display: flex;
        flex-direction: column;
        background-color: transparent;
    }

    .overlay-scrollable-content {
        flex: 1;
        overflow-y: auto;
        scrollbar-width: thin;
        scrollbar-color: rgba(255, 255, 255, 0.2) transparent;
        padding-right: 0.5rem;
        margin-right: -0.5rem;
        max-height: 60vh;
    }

    .overlay-scrollable-content::-webkit-scrollbar {
        width: 6px;
    }

    .overlay-scrollable-content::-webkit-scrollbar-track {
        background: transparent;
    }

    .overlay-scrollable-content::-webkit-scrollbar-thumb {
        background-color: rgba(255, 255, 255, 0.2);
        border-radius: 3px;
    }

    /* Loading indicator styles */
    .loading-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 2rem 0;
    }

    .spinner {
        width: 40px;
        height: 40px;
        border: 3px solid rgba(255, 255, 255, 0.2);
        border-radius: 50%;
        border-top-color: #fff;
        animation: spin 1s ease-in-out infinite;
    }

    @keyframes spin {
        to { transform: rotate(360deg); }
    }
</style>
  