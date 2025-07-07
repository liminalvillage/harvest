<script lang="ts">
    import { createEventDispatcher, onMount, onDestroy, getContext } from "svelte";
    import { fade, slide, scale } from "svelte/transition";
    import { flip } from "svelte/animate";
    import { page } from "$app/stores";
    import { goto } from "$app/navigation";
    import HoloSphere from "holosphere";
    import { ID } from "../dashboard/store";
    import { fetchHolonName } from "../utils/holonNames";

    // Initialize holosphere
    const holosphere = getContext("holosphere") as HoloSphere;
    const dispatch = createEventDispatcher();

    interface MyHolon {
        id: string;
        name: string;
        lastVisited: number;
        isPinned: boolean;
        isPersonal: boolean; // true for manually added, false for federated
        order: number;
        color?: string;
        description?: string;
        stats?: {
            users: number;
            tasks: number;
            offers: number;
            lastActivity: number;
        };
    }

    interface FederatedHolon {
        id: string;
        name: string;
        bidirectional: boolean;
        lensConfig: {
            federate: string[];
            notify: string[];
        };
    }

    // State
    let isLoading = true;
    let connectionReady = false;
    let myHolons: MyHolon[] = [];
    let federatedHolons: FederatedHolon[] = [];
    let showAddDialog = false;
    let newHolonId = '';
    let newHolonName = '';
    let error = '';
    let success = '';
    let draggedHolon: MyHolon | null = null;
    let dragOverIndex = -1;
    let searchQuery = '';
    let sortBy: 'name' | 'lastVisited' | 'order' = 'order';
    let sortDirection: 'asc' | 'desc' = 'asc';
    let currentHolonId: string = '';

    // Filtered holons
    $: filteredHolons = myHolons.filter(holon => 
        holon.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        holon.id.toLowerCase().includes(searchQuery.toLowerCase())
    ).sort((a, b) => {
        let aVal = a[sortBy];
        let bVal = b[sortBy];
        
        if (typeof aVal === 'string') {
            aVal = aVal.toLowerCase();
            bVal = bVal.toLowerCase();
        }
        
        const multiplier = sortDirection === 'asc' ? 1 : -1;
        return aVal > bVal ? multiplier : -multiplier;
    });

    // Subscribe to current holon ID
    let idStoreUnsubscribe: (() => void) | undefined;

    onMount(async () => {
        // Wait for holosphere to be ready
        const checkConnection = async () => {
            if (!holosphere) {
                setTimeout(checkConnection, 100);
                return;
            }
            
            await new Promise(resolve => setTimeout(resolve, 200));
            connectionReady = true;
            
            // Subscribe to ID store
            idStoreUnsubscribe = ID.subscribe(async (newId) => {
                if (newId && newId !== currentHolonId) {
                    currentHolonId = newId;
                    await loadData();
                }
            });

            // Load initial data
            await loadData();
        };
        
        checkConnection();
    });

    onDestroy(() => {
        if (idStoreUnsubscribe) {
            idStoreUnsubscribe();
        }
    });

    async function loadData() {
        if (!holosphere || !connectionReady) return;
        
        isLoading = true;
        error = '';
        
        try {
            // Load personal holons from localStorage
            await loadPersonalHolons();
            
            // Load federated holons
            await loadFederatedHolons();
            
            // Update holon names and stats
            await updateHolonDetails();
            
            // Add current holon to visited list
            if (currentHolonId) {
                await addVisitedHolon(currentHolonId);
            }
            
        } catch (err) {
            error = err instanceof Error ? err.message : 'Failed to load holons';
            console.error('Error loading holons:', err);
        } finally {
            isLoading = false;
        }
    }

    function loadPersonalHolons() {
        try {
            const stored = localStorage.getItem('myHolons');
            if (stored) {
                const parsedHolons = JSON.parse(stored);
                myHolons = parsedHolons.map((holon: any, index: number) => ({
                    ...holon,
                    order: holon.order ?? index,
                    isPersonal: true
                }));
            }
        } catch (err) {
            console.warn('Failed to load personal holons from localStorage:', err);
        }
    }

    async function loadFederatedHolons() {
        if (!currentHolonId) return;
        
        try {
            const federationInfo = await holosphere.getFederation(currentHolonId);
            federatedHolons = [];
            
            if (federationInfo) {
                // Process federation list
                for (const holonId of federationInfo.federation || []) {
                    const lensConfig = federationInfo.lensConfig?.[holonId] || {
                        federate: [],
                        notify: []
                    };
                    
                    const holonName = await fetchHolonName(holosphere, holonId);
                    
                    federatedHolons.push({
                        id: holonId,
                        name: holonName,
                        bidirectional: federationInfo.notify?.includes(holonId) || false,
                        lensConfig
                    });
                }
                
                // Add federated holons to my holons if not already there
                for (const fedHolon of federatedHolons) {
                    if (!myHolons.find(h => h.id === fedHolon.id)) {
                        myHolons.push({
                            id: fedHolon.id,
                            name: fedHolon.name,
                            lastVisited: 0,
                            isPinned: false,
                            isPersonal: false,
                            order: myHolons.length,
                            color: '#4F46E5'
                        });
                    }
                }
            }
        } catch (err) {
            console.warn('Failed to load federated holons:', err);
        }
    }

    async function updateHolonDetails() {
        const updates = await Promise.all(
            myHolons.map(async (holon) => {
                try {
                    // Get updated name
                    const name = await fetchHolonName(holosphere, holon.id);
                    
                    // Get basic stats
                    const [users, tasks, offers] = await Promise.all([
                        holosphere.getAll(holon.id, "users").catch(() => ({})),
                        holosphere.getAll(holon.id, "quests").catch(() => ({})),
                        holosphere.getAll(holon.id, "offers").catch(() => ({}))
                    ]);
                    
                    return {
                        ...holon,
                        name,
                        stats: {
                            users: Object.keys(users || {}).length,
                            tasks: Object.keys(tasks || {}).length,
                            offers: Object.keys(offers || {}).length,
                            lastActivity: Date.now()
                        }
                    };
                } catch (err) {
                    console.warn(`Failed to update details for holon ${holon.id}:`, err);
                    return holon;
                }
            })
        );
        
        myHolons = updates;
        savePersonalHolons();
    }

    async function addVisitedHolon(holonId: string) {
        if (!holonId) return;
        
        const existingIndex = myHolons.findIndex(h => h.id === holonId);
        
        if (existingIndex >= 0) {
            // Update last visited
            myHolons[existingIndex].lastVisited = Date.now();
        } else {
            // Add new holon
            const name = await fetchHolonName(holosphere, holonId);
            myHolons.push({
                id: holonId,
                name,
                lastVisited: Date.now(),
                isPinned: false,
                isPersonal: true,
                order: myHolons.length,
                color: '#10B981'
            });
        }
        
        savePersonalHolons();
    }

    function savePersonalHolons() {
        try {
            const personalHolons = myHolons.filter(h => h.isPersonal);
            localStorage.setItem('myHolons', JSON.stringify(personalHolons));
        } catch (err) {
            console.warn('Failed to save personal holons:', err);
        }
    }

    async function addNewHolon() {
        if (!newHolonId.trim()) {
            error = 'Please enter a holon ID';
            return;
        }
        
        if (myHolons.find(h => h.id === newHolonId)) {
            error = 'Holon already exists in your list';
            return;
        }
        
        try {
            const name = newHolonName.trim() || await fetchHolonName(holosphere, newHolonId);
            
            myHolons.push({
                id: newHolonId,
                name,
                lastVisited: Date.now(),
                isPinned: false,
                isPersonal: true,
                order: myHolons.length,
                color: '#3B82F6'
            });
            
            savePersonalHolons();
            showAddDialog = false;
            newHolonId = '';
            newHolonName = '';
            success = 'Holon added successfully';
            setTimeout(() => success = '', 3000);
        } catch (err) {
            error = err instanceof Error ? err.message : 'Failed to add holon';
        }
    }

    function removeHolon(holonId: string) {
        if (confirm('Are you sure you want to remove this holon from your list?')) {
            myHolons = myHolons.filter(h => h.id !== holonId);
            savePersonalHolons();
            success = 'Holon removed successfully';
            setTimeout(() => success = '', 3000);
        }
    }

    function togglePin(holonId: string) {
        const holon = myHolons.find(h => h.id === holonId);
        if (holon) {
            holon.isPinned = !holon.isPinned;
            savePersonalHolons();
        }
    }

    function navigateToHolon(holonId: string) {
        ID.set(holonId);
        goto(`/${holonId}/dashboard`);
    }

    // Drag and drop functionality
    function handleDragStart(event: DragEvent, holon: MyHolon) {
        if (!event.dataTransfer) return;
        
        draggedHolon = holon;
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', holon.id);
    }

    function handleDragOver(event: DragEvent, index: number) {
        event.preventDefault();
        dragOverIndex = index;
    }

    function handleDragLeave() {
        dragOverIndex = -1;
    }

    function handleDrop(event: DragEvent, targetIndex: number) {
        event.preventDefault();
        
        if (!draggedHolon) return;
        
        const draggedIndex = myHolons.findIndex(h => h.id === draggedHolon!.id);
        if (draggedIndex === targetIndex) return;
        
        // Reorder holons
        const newHolons = [...myHolons];
        const [draggedItem] = newHolons.splice(draggedIndex, 1);
        newHolons.splice(targetIndex, 0, draggedItem);
        
        // Update order values
        newHolons.forEach((holon, index) => {
            holon.order = index;
        });
        
        myHolons = newHolons;
        savePersonalHolons();
        
        // Reset drag state
        draggedHolon = null;
        dragOverIndex = -1;
    }

    function handleDragEnd() {
        draggedHolon = null;
        dragOverIndex = -1;
    }

    function formatLastVisited(timestamp: number) {
        if (!timestamp) return 'Never';
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays} days ago`;
        return date.toLocaleDateString();
    }

    function getHolonTypeIcon(holon: MyHolon) {
        if (holon.isPinned) return '📌';
        if (!holon.isPersonal) return '🔗';
        return '🏠';
    }

    function getHolonTypeLabel(holon: MyHolon) {
        if (holon.isPinned) return 'Pinned';
        if (!holon.isPersonal) return 'Federated';
        return 'Personal';
    }
</script>

<div class="p-6 max-w-7xl mx-auto">
    <!-- Header -->
    <div class="flex justify-between items-center mb-6">
        <div>
            <h1 class="text-3xl font-bold text-white">My Holons</h1>
            <p class="text-gray-400 mt-1">Manage your visited and federated holons</p>
        </div>
        <button
            on:click={() => showAddDialog = true}
            class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
        >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
            Add Holon
        </button>
    </div>

    <!-- Search and Sort Controls -->
    <div class="flex flex-col md:flex-row gap-4 mb-6">
        <div class="flex-1">
            <input
                type="text"
                placeholder="Search holons..."
                bind:value={searchQuery}
                class="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
        </div>
        <div class="flex gap-2">
            <select
                bind:value={sortBy}
                class="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
            >
                <option value="order">Order</option>
                <option value="name">Name</option>
                <option value="lastVisited">Last Visited</option>
            </select>
            <button
                on:click={() => sortDirection = sortDirection === 'asc' ? 'desc' : 'asc'}
                class="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white hover:bg-gray-700 transition-colors"
            >
                {sortDirection === 'asc' ? '↑' : '↓'}
            </button>
        </div>
    </div>

    <!-- Status Messages -->
    {#if error}
        <div class="mb-4 p-4 bg-red-900/20 border border-red-700 rounded-lg text-red-400" transition:slide>
            {error}
        </div>
    {/if}

    {#if success}
        <div class="mb-4 p-4 bg-green-900/20 border border-green-700 rounded-lg text-green-400" transition:slide>
            {success}
        </div>
    {/if}

    <!-- Loading State -->
    {#if isLoading}
        <div class="flex items-center justify-center py-12">
            <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
    {:else}
        <!-- Holons Grid -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {#each filteredHolons as holon, index (holon.id)}
                <div
                    class="bg-gray-800 rounded-lg p-4 border border-gray-700 hover:border-gray-600 transition-all cursor-pointer relative group"
                    class:border-blue-500={dragOverIndex === index}
                    class:opacity-50={draggedHolon?.id === holon.id}
                    draggable="true"
                    on:dragstart={(e) => handleDragStart(e, holon)}
                    on:dragover={(e) => handleDragOver(e, index)}
                    on:dragleave={handleDragLeave}
                    on:drop={(e) => handleDrop(e, index)}
                    on:dragend={handleDragEnd}
                    on:click={() => navigateToHolon(holon.id)}
                    animate:flip={{ duration: 200 }}
                    in:scale={{ duration: 200 }}
                >
                    <!-- Holon Header -->
                    <div class="flex items-start justify-between mb-3">
                        <div class="flex items-center gap-2">
                            <span class="text-lg">{getHolonTypeIcon(holon)}</span>
                            <div>
                                <h3 class="font-semibold text-white truncate">{holon.name}</h3>
                                <p class="text-xs text-gray-400">{holon.id}</p>
                            </div>
                        </div>
                        <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                                on:click|stopPropagation={() => togglePin(holon.id)}
                                class="p-1 hover:bg-gray-700 rounded transition-colors"
                                class:text-yellow-400={holon.isPinned}
                                class:text-gray-400={!holon.isPinned}
                                title={holon.isPinned ? 'Unpin' : 'Pin'}
                            >
                                <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M3 3v14l3-3h11V3H3z" />
                                </svg>
                            </button>
                            {#if holon.isPersonal}
                                <button
                                    on:click|stopPropagation={() => removeHolon(holon.id)}
                                    class="p-1 hover:bg-red-700 rounded transition-colors text-red-400"
                                    title="Remove"
                                >
                                    <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                        <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
                                    </svg>
                                </button>
                            {/if}
                        </div>
                    </div>

                    <!-- Holon Stats -->
                    {#if holon.stats}
                        <div class="flex justify-between text-sm text-gray-400 mb-3">
                            <span>👥 {holon.stats.users}</span>
                            <span>📋 {holon.stats.tasks}</span>
                            <span>🤝 {holon.stats.offers}</span>
                        </div>
                    {/if}

                    <!-- Holon Info -->
                    <div class="flex items-center justify-between">
                        <span class="text-xs px-2 py-1 bg-gray-700 rounded-full text-gray-300">
                            {getHolonTypeLabel(holon)}
                        </span>
                        <span class="text-xs text-gray-500">
                            {formatLastVisited(holon.lastVisited)}
                        </span>
                    </div>

                    <!-- Federation Info -->
                    {#if !holon.isPersonal}
                        <div class="mt-2 pt-2 border-t border-gray-700">
                            <div class="flex items-center gap-2 text-xs">
                                <span class="text-blue-400">🔗</span>
                                <span class="text-gray-400">Federated</span>
                                {#if federatedHolons.find(f => f.id === holon.id)?.bidirectional}
                                    <span class="text-green-400">↔️</span>
                                {/if}
                            </div>
                        </div>
                    {/if}
                </div>
            {/each}
        </div>

        <!-- Empty State -->
        {#if filteredHolons.length === 0}
            <div class="text-center py-12">
                <svg class="w-16 h-16 text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                <h3 class="text-xl font-semibold text-gray-400 mb-2">No holons found</h3>
                <p class="text-gray-500">Add your first holon to get started</p>
            </div>
        {/if}
    {/if}

    <!-- Add Holon Dialog -->
    {#if showAddDialog}
        <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" transition:fade>
            <div class="bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4" transition:scale>
                <h3 class="text-xl font-bold text-white mb-4">Add New Holon</h3>
                
                <div class="space-y-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-300 mb-2">Holon ID *</label>
                        <input
                            type="text"
                            bind:value={newHolonId}
                            placeholder="Enter holon ID"
                            class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-300 mb-2">Display Name (optional)</label>
                        <input
                            type="text"
                            bind:value={newHolonName}
                            placeholder="Custom name for display"
                            class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>
                </div>
                
                <div class="flex gap-3 mt-6">
                    <button
                        on:click={addNewHolon}
                        class="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg transition-colors"
                    >
                        Add Holon
                    </button>
                    <button
                        on:click={() => { showAddDialog = false; newHolonId = ''; newHolonName = ''; error = ''; }}
                        class="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-2 px-4 rounded-lg transition-colors"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    {/if}
</div>