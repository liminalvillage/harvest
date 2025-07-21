<script lang="ts">
    import { createEventDispatcher, onMount, onDestroy, getContext } from "svelte";
    import { fade, slide, fly } from "svelte/transition";
    import { flip } from "svelte/animate";
    import { goto } from "$app/navigation";
    import HoloSphere from "holosphere";
    import { ID, walletAddress } from "../dashboard/store";
    import { fetchHolonName } from "../utils/holonNames";

    const dispatch = createEventDispatcher();
    const holosphere = getContext("holosphere") as HoloSphere;

    // Default small set of commonly federated lenses
    const DEFAULT_AVAILABLE_LENSES = ['quests', 'offers', 'announcements'];
    
    // All possible lenses that could be federated
    const ALL_POSSIBLE_LENSES = [
        'quests', 'offers', 'tags', 'expenses', 
        'announcements', 'users', 'shopping', 'recurring'
    ];
    
    // User-configurable available lenses (starts with all possible lenses)
    let availableLenses: string[] = [...ALL_POSSIBLE_LENSES];
    let customLenses: string[] = [];
    let showAddCustomLens = false;
    let newCustomLens = '';
    
    // Helper function to normalize lens names for comparison
    function normalizeLensName(lensName: string): string {
        return lensName.toLowerCase();
    }
    
    // Helper function to check if a lens is in a lens array (case-insensitive)
    function isLensInArray(lens: string, lensArray: string[]): boolean {
        const normalizedLens = normalizeLensName(lens);
        return lensArray.some(l => normalizeLensName(l) === normalizedLens);
    }

    // Helper function to get canonical lens name (always lowercase)
    function getCanonicalLensName(lensName: string): string {
        return lensName.toLowerCase();
    }

    interface FederationInfo {
        id: string;
        name: string;
        federation: string[];
        notify: string[];
        lensConfig?: Record<string, {
            federate: string[];
            notify: string[];
            timestamp: number;
        }>;
        timestamp: number;
    }

    interface FederatedHolon {
        id: string;
        name: string;
        status: 'connected' | 'pending' | 'error';
        bidirectional: boolean;
        lensConfig: {
            federate: string[];
            notify: string[];
        };
    }

    let currentHolonId: string = '';
    let federationInfo: FederationInfo | null = null;
    let federatedHolons: FederatedHolon[] = [];
    let loading = true;
    let saving = false;
    let showAddDialog = false;
    let newHolonId = '';
    let newHolonName = '';
    let selectedHolon: FederatedHolon | null = null;
    let error = '';
    let success = '';
    let showNetworkView = false;

    // Subscribe to current holon ID
    let idStoreUnsubscribe: (() => void) | undefined;

    onMount(() => {
        idStoreUnsubscribe = ID.subscribe(async (newId) => {
            if (newId !== currentHolonId) {
                currentHolonId = newId || '';
                if (currentHolonId) {
                    await loadFederationData();
                } else {
                    federationInfo = null;
                    federatedHolons = [];
                    loading = false;
                }
            }
        });
    });

    onDestroy(() => {
        if (idStoreUnsubscribe) {
            idStoreUnsubscribe();
        }
    });

    async function loadFederationData() {
        if (!holosphere || !currentHolonId) return;
        
        loading = true;
        error = '';
        
        try {
            // Get federation info
            federationInfo = await holosphere.getFederation(currentHolonId);
            console.log('Federation info loaded:', federationInfo);
            
            if (federationInfo) {
                // Build federated holons list
                federatedHolons = [];
                
                // Process federation list (holons we federate to)
                for (const holonId of federationInfo.federation || []) {
                    const lensConfig = federationInfo.lensConfig?.[holonId] || {
                        federate: [],
                        notify: []
                    };
                    
                    console.log(`Lens config for ${holonId}:`, lensConfig);
                    
                    // Get actual holon name from settings
                    const holonName = await getHolonName(holonId);
                    
                    federatedHolons.push({
                        id: holonId,
                        name: holonName,
                        status: 'connected',
                        bidirectional: federationInfo.notify?.includes(holonId) || false,
                        lensConfig
                    });
                }
                
                // Process notify list (holons that notify us)
                for (const holonId of federationInfo.notify || []) {
                    if (!federatedHolons.find(h => h.id === holonId)) {
                        // Try to get the lens config for this holon too
                        const lensConfig = federationInfo.lensConfig?.[holonId] || {
                            federate: [],
                            notify: []
                        };
                        
                        console.log(`Lens config for notify-only holon ${holonId}:`, lensConfig);
                        
                        // Get actual holon name from settings
                        const holonName = await getHolonName(holonId);
                        
                        federatedHolons.push({
                            id: holonId,
                            name: holonName,
                            status: 'connected',
                            bidirectional: false,
                            lensConfig
                        });
                    }
                }
                
                console.log('Final federated holons:', federatedHolons);
                
                // Attempt to repair any missing lens configurations
                setTimeout(() => repairLensConfigs(), 100);
            } else {
                federatedHolons = [];
                console.log('No federation info found');
            }
        } catch (err) {
            error = err instanceof Error ? err.message : 'Failed to load federation data';
            console.error('Federation load error:', err);
        } finally {
            loading = false;
        }
    }

    async function addFederation() {
        if (!newHolonId.trim() || !holosphere || !currentHolonId) return;
        
        saving = true;
        error = '';
        
        try {
            // Create federation with default lens config (empty arrays)
            const success = await holosphere.federate(
                currentHolonId, 
                newHolonId.trim(),
                null, // password1
                null, // password2
                true, // bidirectional
                { federate: [], notify: [] } // empty lens config initially
            );
            
            if (success) {
                showAddDialog = false;
                newHolonId = '';
                newHolonName = '';
                await loadFederationData();
                showSuccess('Federation created successfully');
            } else {
                error = 'Failed to create federation';
            }
        } catch (err) {
            error = err instanceof Error ? err.message : 'Failed to create federation';
            console.error('Federation creation error:', err);
        } finally {
            saving = false;
        }
    }

    async function removeFederation(holonId: string) {
        console.log('removeFederation called with holonId:', holonId);
        
        if (!holosphere || !currentHolonId) {
            console.log('Early return: missing holosphere or currentHolonId', { holosphere: !!holosphere, currentHolonId });
            return;
        }
        
        saving = true;
        error = '';
        
        try {
            console.log('Calling holosphere.unfederate...', { currentHolonId, holonId });
            const success = await holosphere.unfederate(currentHolonId, holonId);
            console.log('unfederate result:', success);
            
            if (success) {
                console.log('Federation removed successfully, reloading data...');
                await loadFederationData();
                showSuccess('Federation removed successfully');
            } else {
                console.error('unfederate returned false');
                error = 'Failed to remove federation';
            }
        } catch (err) {
            console.error('Federation removal error:', err);
            error = err instanceof Error ? err.message : 'Failed to remove federation';
        } finally {
            saving = false;
        }
    }

    async function updateLensConfig(holonId: string, federateLenses: string[], notifyLenses: string[]) {
        if (!holosphere || !currentHolonId) return;
        
        saving = true;
        error = '';
        
        try {
            // Re-federate with updated lens config
            const success = await holosphere.federate(
                currentHolonId,
                holonId,
                null, // password1
                null, // password2
                true, // bidirectional
                { federate: federateLenses, notify: notifyLenses }
            );
            
            if (success) {
                await loadFederationData();
                showSuccess('Lens configuration updated');
            } else {
                error = 'Failed to update lens configuration';
            }
        } catch (err) {
            error = err instanceof Error ? err.message : 'Failed to update lens configuration';
            console.error('Lens config update error:', err);
        } finally {
            saving = false;
        }
    }

    async function refreshLensConfig(holonId: string) {
        if (!holosphere || !currentHolonId) return null;
        
        try {
            // Use the dedicated getFederatedConfig function as backup
            const config = await holosphere.getFederatedConfig(currentHolonId, holonId);
            console.log(`Refreshed lens config for ${holonId}:`, config);
            return config;
        } catch (err) {
            console.error(`Failed to refresh lens config for ${holonId}:`, err);
            return null;
        }
    }

    async function getHolonName(holonId: string): Promise<string> {
        if (!holonId || !holosphere) return 'Unknown';
        
        try {
            // Get settings for this holon
            const settings = await holosphere.get(holonId, 'settings', holonId);
            if (settings && settings.name) {
                return settings.name;
            }
        } catch (error) {
            console.warn(`Could not fetch settings name for holon ${holonId}:`, error);
        }
        
        // Fallback to holon ID
        return holonId;
    }

    async function repairLensConfigs() {
        if (!federatedHolons.length) return;
        
        console.log('Attempting to repair lens configurations and holon names...');
        
        for (let i = 0; i < federatedHolons.length; i++) {
            const holon = federatedHolons[i];
            let updated = false;
            
            // If lens config is empty, try to refresh it
            if (!holon.lensConfig.federate.length && !holon.lensConfig.notify.length) {
                const refreshedConfig = await refreshLensConfig(holon.id);
                if (refreshedConfig) {
                    federatedHolons[i].lensConfig = refreshedConfig;
                    console.log(`Repaired lens config for ${holon.id}:`, refreshedConfig);
                    updated = true;
                }
            }
            
            // If holon name is same as ID, try to get the actual name
            if (holon.name === holon.id) {
                const actualName = await getHolonName(holon.id);
                if (actualName !== holon.id) {
                    federatedHolons[i].name = actualName;
                    console.log(`Updated holon name for ${holon.id}: ${actualName}`);
                    updated = true;
                }
            }
        }
        
        // Trigger reactivity
        federatedHolons = [...federatedHolons];
    }

    function showSuccess(message: string) {
        success = message;
        setTimeout(() => {
            success = '';
        }, 3000);
    }

    function getLensIcon(lens: string): string {
        const normalizedLens = normalizeLensName(lens);
        const icons: Record<string, string> = {
            'quests': '🎯',
            'offers': '🤝',
            'tags': '🏷️',
            'expenses': '💰',
            'announcements': '📢',
            'users': '👥',
            'shopping': '🛒',
            'recurring': '🔄'
        };
        return icons[normalizedLens] || '📦';
    }

    function getStatusColor(status: string): string {
        switch (status) {
            case 'connected': return 'text-green-400';
            case 'pending': return 'text-yellow-400';
            case 'error': return 'text-red-400';
            default: return 'text-gray-400';
        }
    }

    function closeDialog() {
        showAddDialog = false;
        newHolonId = '';
        newHolonName = '';
        error = '';
    }

    function navigateToHolon(holonId: string) {
        ID.set(holonId);
        
        // Track this visit if wallet is connected
        if ($walletAddress) {
            addVisitedHolonToSeparateList(holonId);
        }
        
        goto(`/${holonId}/dashboard`);
    }

    async function addVisitedHolonToSeparateList(holonId: string) {
        if (!$walletAddress) return;
        
        try {
            const holonName = await fetchHolonName(holosphere, holonId);
            const now = Date.now();
            
            // Load existing visited holons from localStorage first
            const localStorageKey = `visitedHolons_${$walletAddress}`;
            const localData = localStorage.getItem(localStorageKey);
            let visitedHolons: any[] = [];
            
            if (localData) {
                try {
                    const parsed = JSON.parse(localData);
                    if (Array.isArray(parsed)) {
                        visitedHolons = parsed;
                    }
                } catch (e) {
                    console.warn('Failed to parse localStorage visited holons:', e);
                }
            }
            
            // Try to load from holosphere and merge with localStorage data
            try {
                const visitedData = await holosphere.get($walletAddress, 'visitedHolons', $walletAddress);
                if (visitedData && Array.isArray(visitedData)) {
                    visitedHolons = visitedData;
                } else if (visitedData && visitedData.data && Array.isArray(visitedData.data)) {
                    visitedHolons = visitedData.data;
                }
            } catch (err) {
                console.warn('Failed to load from holosphere, using localStorage data:', err);
            }
            
            // Check if already in visited list
            const existingIndex = visitedHolons.findIndex((h: any) => h.id === holonId);
            
            if (existingIndex >= 0) {
                // Update existing entry
                visitedHolons[existingIndex] = {
                    ...visitedHolons[existingIndex],
                    lastVisited: now,
                    visitCount: visitedHolons[existingIndex].visitCount + 1
                };
            } else {
                // Add new entry
                visitedHolons.push({
                    id: holonId,
                    name: holonName,
                    lastVisited: now,
                    visitCount: 1
                });
            }
            
            // Save to both holosphere and localStorage
            try {
                await holosphere.put($walletAddress, 'visitedHolons', visitedHolons);
                localStorage.setItem(localStorageKey, JSON.stringify(visitedHolons));
                console.log('Saved visited holon to both holosphere and localStorage');
            } catch (err) {
                console.warn('Failed to save to holosphere, saving to localStorage only:', err);
                localStorage.setItem(localStorageKey, JSON.stringify(visitedHolons));
            }
            
        } catch (err) {
            console.warn('Failed to add visited holon:', err);
        }
    }

    function addCustomLens() {
        const lensName = newCustomLens.trim().toLowerCase();
        if (lensName && !availableLenses.includes(lensName) && !customLenses.includes(lensName)) {
            customLenses = [...customLenses, lensName];
            availableLenses = [...availableLenses, lensName];
            newCustomLens = '';
            showAddCustomLens = false;
        }
    }

    function removeCustomLens(lens: string) {
        customLenses = customLenses.filter(l => l !== lens);
        availableLenses = availableLenses.filter(l => l !== lens);
    }



    $: totalFederations = federatedHolons.length;
    $: activeLenses = federatedHolons.reduce((acc, holon) => {
        if (holon && holon.lensConfig && holon.lensConfig.federate) {
            holon.lensConfig.federate.forEach(lens => acc.add(lens));
        }
        return acc;
    }, new Set<string>()).size;
</script>

<div class="space-y-8">
    <!-- Header Section -->
    <div class="bg-gradient-to-r from-gray-800 to-gray-700 py-8 px-8 rounded-3xl shadow-2xl">
        <div class="flex flex-col md:flex-row justify-between items-center">
            <div class="text-center md:text-left mb-4 md:mb-0">
                <h1 class="text-4xl font-bold text-white mb-2">Federation Configuration</h1>
                <p class="text-gray-300 text-lg">Manage data sharing between holons</p>
            </div>
            <div class="flex flex-wrap items-center gap-3">
                <button 
                    on:click={() => showNetworkView = !showNetworkView}
                    class="bg-green-600 hover:bg-green-700 px-3 py-2 rounded-lg transition-colors flex items-center space-x-2 text-sm"
                    title="Toggle network view"
                >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zM13 12a1 1 0 11-2 0 1 1 0 012 0zM20 12a1 1 0 11-2 0 1 1 0 012 0z"></path>
                    </svg>
                    <span>{showNetworkView ? 'List View' : 'Network View'}</span>
                </button>
                <button 
                    on:click={() => showAddCustomLens = true}
                    class="bg-purple-600 hover:bg-purple-700 px-3 py-2 rounded-lg transition-colors flex items-center space-x-2 text-sm"
                    title="Add custom lens"
                >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                    </svg>
                    <span>Add Lens</span>
                </button>
                <button 
                    on:click={() => showAddDialog = true}
                    class="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg transition-colors flex items-center space-x-2"
                    disabled={!currentHolonId || saving}
                >
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                    </svg>
                    <span>Add Federation</span>
                </button>
            </div>
        </div>
    </div>

    <!-- Main Content Container -->
    <div class="bg-gray-800 rounded-3xl shadow-xl min-h-[600px]">
        <div class="p-8">

            <!-- Status Messages -->
            {#if error}
                <div class="bg-red-900/50 border border-red-700 rounded-lg p-4 mb-6" transition:slide>
                    <div class="flex items-center space-x-2">
                        <svg class="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                        <span class="text-red-300">{error}</span>
                    </div>
                </div>
            {/if}

            {#if success}
                <div class="bg-green-900/50 border border-green-700 rounded-lg p-4 mb-6" transition:slide>
                    <div class="flex items-center space-x-2">
                        <svg class="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                        <span class="text-green-300">{success}</span>
                    </div>
                </div>
            {/if}

            <!-- Stats Section -->
            {#if !loading && currentHolonId && federatedHolons.length > 0}
                <div class="grid grid-cols-2 gap-4 mb-8">
                    <div class="bg-gray-700/50 rounded-2xl p-4 text-center">
                        <div class="text-2xl font-bold text-white mb-1">{totalFederations}</div>
                        <div class="text-sm text-gray-400">Federations</div>
                    </div>
                    <div class="bg-gray-700/50 rounded-2xl p-4 text-center">
                        <div class="text-2xl font-bold text-white mb-1">{activeLenses}</div>
                        <div class="text-sm text-gray-400">Active Lenses</div>
                    </div>
                </div>
            {/if}

        {#if loading}
            <!-- Loading State -->
            <div class="flex items-center justify-center py-20">
                <div class="text-center">
                    <svg class="animate-spin h-8 w-8 text-blue-400 mx-auto mb-4" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"/>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                    </svg>
                    <p class="text-gray-400">Loading federation data...</p>
                </div>
            </div>
        {:else if !currentHolonId}
            <!-- No Holon Selected -->
            <div class="text-center py-20">
                <svg class="w-16 h-16 text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
                </svg>
                <h3 class="text-xl font-semibold text-gray-300 mb-2">No Holon Selected</h3>
                <p class="text-gray-500">Please select a holon to configure federation settings.</p>
            </div>
        {:else if federatedHolons.length === 0}
            <!-- Empty State -->
            <div class="text-center py-20">
                <svg class="w-16 h-16 text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path>
                </svg>
                <h3 class="text-xl font-semibold text-gray-300 mb-2">No Federations Configured</h3>
                <p class="text-gray-500 mb-6">Start by creating your first federation to share data with other holons.</p>
                <button 
                    on:click={() => showAddDialog = true}
                    class="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg transition-colors inline-flex items-center space-x-2"
                >
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                    </svg>
                    <span>Create Federation</span>
                </button>
            </div>
        {:else}
            {#if !showNetworkView}
                <!-- Federation List -->
                <div class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                    {#each federatedHolons as holon (holon.id)}
                        <div 
                            class="bg-gray-800 rounded-xl p-6 border border-gray-700 hover:border-gray-600 transition-all duration-200 hover:shadow-lg"
                            animate:flip={{ duration: 300 }}
                            in:fly={{ y: 20, duration: 300 }}
                            out:fly={{ y: -20, duration: 200 }}
                        >
                        <!-- Holon Header -->
                        <div class="flex items-center justify-between mb-4">
                            <div class="flex items-center space-x-3">
                                <div class="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold">
                                    {(holon.name && typeof holon.name === 'string') ? holon.name.charAt(0).toUpperCase() : '?'}
                                </div>
                                <div>
                                    <button 
                                        on:click={() => navigateToHolon(holon.id)}
                                        class="font-semibold text-white truncate hover:text-blue-400 transition-colors text-left"
                                        title="Navigate to {holon.name || holon.id}"
                                    >
                                        {holon.name || holon.id}
                                    </button>
                                    <div class="flex items-center space-x-2">
                                        <div class={`w-2 h-2 rounded-full ${getStatusColor(holon.status).replace('text-', 'bg-')}`}></div>
                                        <span class="text-sm text-gray-400 capitalize">{holon.status}</span>
                                        {#if holon.bidirectional}
                                            <span class="text-xs bg-blue-900 text-blue-300 px-2 py-1 rounded-full">Bidirectional</span>
                                        {/if}
                                    </div>
                                </div>
                            </div>
                            <div class="flex items-center space-x-2">
                                <button 
                                    on:click={() => { selectedHolon = holon; }}
                                    class="text-gray-400 hover:text-white transition-colors p-2"
                                    title="Configure Lenses"
                                    aria-label="Configure lenses for {holon.name || holon.id}"
                                >
                                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                                    </svg>
                                </button>
                                <button 
                                    on:click={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        removeFederation(holon.id);
                                    }}
                                    class="text-gray-400 hover:text-red-400 transition-colors p-2"
                                    title="Remove Federation"
                                    aria-label="Remove federation with {holon.name || holon.id}"
                                    disabled={saving}
                                >
                                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                                    </svg>
                                </button>
                            </div>
                        </div>

                        <!-- Lens Preview -->
                        <div class="space-y-3">
                            <div>
                                <h4 class="text-sm font-medium text-gray-300 mb-2">Federated Lenses</h4>
                                {#if holon.lensConfig.federate.length > 0}
                                    <div class="flex flex-wrap gap-1">
                                        {#each holon.lensConfig.federate as lens}
                                            <span class="text-xs bg-blue-900 text-blue-300 px-2 py-1 rounded-full flex items-center space-x-1">
                                                <span>{getLensIcon(lens)}</span>
                                                <span>{lens}</span>
                                            </span>
                                        {/each}
                                    </div>
                                {:else}
                                    <span class="text-xs text-gray-500">No lenses configured</span>
                                {/if}
                            </div>
                            
                            <div>
                                <h4 class="text-sm font-medium text-gray-300 mb-2">Notification Lenses</h4>
                                {#if holon.lensConfig.notify.length > 0}
                                    <div class="flex flex-wrap gap-1">
                                        {#each holon.lensConfig.notify as lens}
                                            <span class="text-xs bg-green-900 text-green-300 px-2 py-1 rounded-full flex items-center space-x-1">
                                                <span>{getLensIcon(lens)}</span>
                                                <span>{lens}</span>
                                            </span>
                                        {/each}
                                    </div>
                                {:else}
                                    <span class="text-xs text-gray-500">No notifications configured</span>
                                {/if}
                            </div>
                        </div>

                        <!-- Quick Actions -->
                        <div class="mt-4 pt-4 border-t border-gray-700">
                            <button 
                                on:click={() => { selectedHolon = holon; }}
                                class="w-full bg-gray-700 hover:bg-gray-600 text-gray-300 py-2 rounded-lg transition-colors text-sm"
                            >
                                Configure Lenses
                            </button>
                        </div>
                        </div>
                    {/each}
                </div>
            {:else}
                <!-- Network View -->
                <div class="bg-gray-800 rounded-xl p-6 border border-gray-700">
                    <div class="text-center mb-6">
                        <h3 class="text-lg font-semibold text-white mb-2">Federation Network</h3>
                        <p class="text-gray-400 text-sm">Interactive visualization of holon connections</p>
                    </div>
                    
                    <div class="flex justify-center">
                        <svg width="800" height="600" class="rounded-lg bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-600">
                            <!-- Background Grid -->
                            <defs>
                                <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                                    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#374151" stroke-width="0.5" opacity="0.3"/>
                                </pattern>
                                <filter id="glow">
                                    <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                                    <feMerge> 
                                        <feMergeNode in="coloredBlur"/>
                                        <feMergeNode in="SourceGraphic"/>
                                    </feMerge>
                                </filter>
                            </defs>
                            
                            <rect width="100%" height="100%" fill="url(#grid)"/>
                            
                            <!-- Connection Lines -->
                            {#each federatedHolons as holon, index}
                                {@const angle = (index / federatedHolons.length) * 2 * Math.PI - Math.PI/2}
                                {@const radius = 200}
                                {@const x = 400 + Math.cos(angle) * radius}
                                {@const y = 300 + Math.sin(angle) * radius}
                                
                                <!-- Connection Line -->
                                <line 
                                    x1="400" 
                                    y1="300" 
                                    x2={x} 
                                    y2={y} 
                                    stroke={holon.bidirectional ? '#10B981' : '#6B7280'}
                                    stroke-width={holon.bidirectional ? '3' : '2'}
                                    stroke-dasharray={holon.bidirectional ? 'none' : '5,5'}
                                    opacity="0.7"
                                    class="transition-all duration-300"
                                />
                            {/each}
                            
                            <!-- Current Holon (Center) -->
                            <g class="current-holon">
                                <circle 
                                    cx="400" 
                                    cy="300" 
                                    r="40" 
                                    fill="#3B82F6" 
                                    stroke="#60A5FA" 
                                    stroke-width="3"
                                    class="cursor-pointer hover:fill-blue-500 transition-all duration-300"
                                    on:click={() => navigateToHolon(currentHolonId)}
                                    on:keydown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            navigateToHolon(currentHolonId);
                                        }
                                    }}
                                    role="button"
                                    tabindex="0"
                                    aria-label="Navigate to current holon"
                                    style="filter: url(#glow)"
                                />
                                <text 
                                    x="400" 
                                    y="300" 
                                    text-anchor="middle" 
                                    dy="0.35em" 
                                    fill="white" 
                                    font-size="18" 
                                    font-weight="bold"
                                    class="pointer-events-none"
                                >
                                    ⬢
                                </text>
                                <text 
                                    x="400" 
                                    y="350" 
                                    text-anchor="middle" 
                                    fill="white" 
                                    font-size="12" 
                                    font-weight="600"
                                    class="pointer-events-none"
                                >
                                    Current
                                </text>
                            </g>
                            
                            <!-- Federated Holons -->
                            {#each federatedHolons as holon, index}
                                {@const angle = (index / federatedHolons.length) * 2 * Math.PI - Math.PI/2}
                                {@const radius = 200}
                                {@const x = 400 + Math.cos(angle) * radius}
                                {@const y = 300 + Math.sin(angle) * radius}
                                {@const nodeColor = holon.bidirectional ? '#10B981' : '#6B7280'}
                                
                                <g class="federated-holon">
                                    <!-- Main Node -->
                                    <circle 
                                        cx={x} 
                                        cy={y} 
                                        r="30" 
                                        fill={nodeColor}
                                        stroke="white"
                                        stroke-width="2"
                                        class="cursor-pointer hover:r-35 transition-all duration-300"
                                        on:click={() => navigateToHolon(holon.id)}
                                        on:keydown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                navigateToHolon(holon.id);
                                            }
                                        }}
                                        role="button"
                                        tabindex="0"
                                        aria-label="Navigate to {holon.name || holon.id}"
                                        style="filter: url(#glow)"
                                    />
                                    
                                    <!-- Avatar Letter -->
                                    <text 
                                        x={x} 
                                        y={y} 
                                        text-anchor="middle" 
                                        dy="0.35em" 
                                        fill="white" 
                                        font-size="16" 
                                        font-weight="bold"
                                        class="pointer-events-none"
                                    >
                                        {(holon.name && typeof holon.name === 'string') ? holon.name.charAt(0).toUpperCase() : '?'}
                                    </text>
                                    
                                    <!-- Status Indicator -->
                                    <circle 
                                        cx={x + 20} 
                                        cy={y - 20} 
                                        r="6" 
                                        fill={holon.status === 'connected' ? '#10B981' : holon.status === 'pending' ? '#F59E0B' : '#EF4444'}
                                        stroke="white"
                                        stroke-width="2"
                                        class="pointer-events-none"
                                    />
                                    
                                    <!-- Lens Count Badge -->
                                    {#if holon.lensConfig.federate.length > 0}
                                        <circle 
                                            cx={x - 20} 
                                            cy={y + 20} 
                                            r="8" 
                                            fill="#3B82F6" 
                                            stroke="white"
                                            stroke-width="1"
                                            class="pointer-events-none"
                                        />
                                        <text 
                                            x={x - 20} 
                                            y={y + 20} 
                                            text-anchor="middle" 
                                            dy="0.35em" 
                                            fill="white" 
                                            font-size="10"
                                            font-weight="bold"
                                            class="pointer-events-none"
                                        >
                                            {holon.lensConfig.federate.length}
                                        </text>
                                    {/if}
                                </g>
                                
                                <!-- Holon Name Label -->
                                <text 
                                    x={x} 
                                    y={y + 50} 
                                    text-anchor="middle" 
                                    fill="white" 
                                    font-size="11" 
                                    font-weight="500"
                                    class="pointer-events-none"
                                >
                                    {holon.name || holon.id}
                                </text>
                            {/each}
                            
                            <!-- Legend -->
                            <g class="legend" transform="translate(20, 20)">
                                <rect x="0" y="0" width="180" height="120" fill="rgba(0,0,0,0.8)" stroke="#374151" stroke-width="1" rx="8"/>
                                <text x="10" y="20" fill="white" font-size="12" font-weight="bold">Network Legend</text>
                                
                                <circle cx="15" cy="40" r="4" fill="#10B981"/>
                                <text x="25" y="40" dy="0.35em" fill="white" font-size="10">Bidirectional</text>
                                
                                <circle cx="15" cy="60" r="4" fill="#6B7280"/>
                                <text x="25" y="60" dy="0.35em" fill="white" font-size="10">Notify Only</text>
                                
                                <circle cx="15" cy="80" r="4" fill="#10B981"/>
                                <text x="25" y="80" dy="0.35em" fill="white" font-size="10">Connected</text>
                                
                                <circle cx="15" cy="100" r="4" fill="#3B82F6"/>
                                <text x="25" y="100" dy="0.35em" fill="white" font-size="10">Lens Count</text>
                            </g>
                            
                            <!-- Stats -->
                            <g class="stats" transform="translate(600, 20)">
                                <rect x="0" y="0" width="160" height="80" fill="rgba(0,0,0,0.8)" stroke="#374151" stroke-width="1" rx="8"/>
                                <text x="10" y="20" fill="white" font-size="12" font-weight="bold">Network Stats</text>
                                
                                <text x="10" y="40" fill="#60A5FA" font-size="10">Connections:</text>
                                <text x="120" y="40" fill="white" font-size="10" font-weight="bold">{federatedHolons.length}</text>
                                
                                <text x="10" y="60" fill="#10B981" font-size="10">Active Lenses:</text>
                                <text x="120" y="60" fill="white" font-size="10" font-weight="bold">{activeLenses}</text>
                            </g>
                        </svg>
                    </div>
                    
                    {#if federatedHolons.length === 0}
                        <div class="text-center mt-6">
                            <div class="bg-gray-700 rounded-lg p-8 border border-gray-600">
                                <div class="text-6xl mb-4">🌐</div>
                                <h4 class="text-xl font-semibold text-white mb-2">No Network Connections</h4>
                                <p class="text-gray-400">Create your first federation to see the network visualization</p>
                            </div>
                        </div>
                    {/if}
                </div>
            {/if}
        {/if}
        </div>
    </div>
</div>

<!-- Add Federation Dialog -->
{#if showAddDialog}
    <div 
        class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
        on:click={(e) => e.target === e.currentTarget && closeDialog()}
        on:keydown={(e) => {
            if (e.key === 'Escape') {
                closeDialog();
            }
        }}
        role="dialog"
        aria-modal="true"
        tabindex="-1"
        transition:fade={{ duration: 200 }}
    >
        <div 
            class="bg-gray-800 rounded-xl p-6 w-full max-w-md"
            transition:fly={{ y: -50, duration: 300 }}
        >
            <div class="flex items-center justify-between mb-6">
                <h2 class="text-xl font-semibold text-white">Add Federation</h2>
                <button 
                    on:click={closeDialog}
                    class="text-gray-400 hover:text-white transition-colors"
                >
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                </button>
            </div>

            <form on:submit|preventDefault={addFederation} class="space-y-4">
                <div>
                    <label for="holonId" class="block text-sm font-medium text-gray-300 mb-2">
                        Holon ID *
                    </label>
                    <input 
                        id="holonId"
                        type="text" 
                        bind:value={newHolonId}
                        placeholder="Enter holon ID..."
                        class="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        required
                    />
                </div>

                <div>
                    <label for="holonName" class="block text-sm font-medium text-gray-300 mb-2">
                        Display Name (Optional)
                    </label>
                    <input 
                        id="holonName"
                        type="text" 
                        bind:value={newHolonName}
                        placeholder="Enter display name..."
                        class="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                </div>

                <div class="bg-blue-900/30 border border-blue-700 rounded-lg p-3">
                    <div class="flex items-start space-x-2">
                        <svg class="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                        <div class="text-sm text-blue-300">
                            <p class="font-medium mb-1">Federation Setup</p>
                            <p>This will create a bidirectional federation. You can configure lens-specific settings after creation.</p>
                        </div>
                    </div>
                </div>

                <div class="flex space-x-3 pt-4">
                    <button 
                        type="button"
                        on:click={closeDialog}
                        class="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-300 py-2 rounded-lg transition-colors"
                        disabled={saving}
                    >
                        Cancel
                    </button>
                    <button 
                        type="submit"
                        class="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                        disabled={saving || !newHolonId.trim()}
                    >
                        {#if saving}
                            <svg class="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"/>
                                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                            </svg>
                        {/if}
                        <span>{saving ? 'Creating...' : 'Create Federation'}</span>
                    </button>
                </div>
            </form>
        </div>
    </div>
{/if}

<!-- Add Custom Lens Dialog -->
{#if showAddCustomLens}
    <div 
        class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
        on:click={(e) => e.target === e.currentTarget && (showAddCustomLens = false)}
        on:keydown={(e) => {
            if (e.key === 'Escape') {
                showAddCustomLens = false;
            }
        }}
        role="dialog"
        aria-modal="true"
        tabindex="-1"
        transition:fade={{ duration: 200 }}
    >
        <div 
            class="bg-gray-800 rounded-xl p-6 w-full max-w-sm"
            transition:fly={{ y: -50, duration: 300 }}
        >
            <div class="flex items-center justify-between mb-6">
                <h2 class="text-xl font-semibold text-white">Add Custom Lens</h2>
                <button 
                    on:click={() => showAddCustomLens = false}
                    class="text-gray-400 hover:text-white transition-colors"
                >
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                </button>
            </div>

            <form on:submit|preventDefault={addCustomLens} class="space-y-4">
                <div>
                    <label for="customLensName" class="block text-sm font-medium text-gray-300 mb-2">
                        Lens Name *
                    </label>
                    <input 
                        id="customLensName"
                        type="text" 
                        bind:value={newCustomLens}
                        placeholder="Enter lens name..."
                        class="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        required
                        autofocus={false}
                    />
                </div>

                <div class="bg-purple-900/30 border border-purple-700 rounded-lg p-3">
                    <div class="flex items-start space-x-2">
                        <svg class="w-5 h-5 text-purple-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                        <div class="text-sm text-purple-300">
                            <p class="font-medium mb-1">Custom Lens</p>
                            <p>Add a custom lens type for federation. Use descriptive names like "Events", "Projects", etc.</p>
                        </div>
                    </div>
                </div>

                {#if customLenses.length > 0}
                    <div>
                        <h3 class="text-sm font-medium text-gray-300 mb-2">Custom Lenses</h3>
                        <div class="space-y-1">
                            {#each customLenses as lens}
                                <div class="flex items-center justify-between p-2 bg-gray-700 rounded text-sm">
                                    <span class="text-gray-300">{lens}</span>
                                    <button 
                                        type="button"
                                        on:click={() => removeCustomLens(lens)}
                                        class="text-red-400 hover:text-red-300 transition-colors"
                                        title="Remove custom lens"
                                        aria-label="Remove custom lens {lens}"
                                    >
                                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                                        </svg>
                                    </button>
                                </div>
                            {/each}
                        </div>
                    </div>
                {/if}

                <div class="flex space-x-3 pt-4">
                    <button 
                        type="button"
                        on:click={() => showAddCustomLens = false}
                        class="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-300 py-2 rounded-lg transition-colors"
                    >
                        Cancel
                    </button>
                    <button 
                        type="submit"
                        class="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={!newCustomLens.trim()}
                    >
                        Add Lens
                    </button>
                </div>
            </form>
        </div>
    </div>
{/if}

<!-- Lens Configuration Modal -->
{#if selectedHolon}
    <div 
        class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
        on:click={(e) => e.target === e.currentTarget && (selectedHolon = null)}
        on:keydown={(e) => {
            if (e.key === 'Escape') {
                selectedHolon = null;
            }
        }}
        role="dialog"
        aria-modal="true"
        tabindex="-1"
        transition:fade={{ duration: 200 }}
    >
        <div 
            class="bg-gray-800 rounded-xl w-full max-w-2xl max-h-[80vh] overflow-hidden"
            transition:fly={{ y: -50, duration: 300 }}
        >
            <!-- Modal Header -->
            <div class="flex items-center justify-between p-6 border-b border-gray-700">
                <div>
                    <h2 class="text-xl font-semibold text-white">Configure Lenses</h2>
                    <p class="text-sm text-gray-400">Federation with {selectedHolon.name || selectedHolon.id}</p>
                </div>
                <button 
                    on:click={() => selectedHolon = null}
                    class="text-gray-400 hover:text-white transition-colors"
                    aria-label="Close lens configuration dialog"
                >
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                </button>
            </div>

            <!-- Modal Content -->
            <div class="p-6 overflow-y-auto max-h-[60vh]">
                <div class="space-y-6">
                    <!-- Federate Section -->
                    <div>
                        <h3 class="text-lg font-medium text-white mb-3">Data Federation</h3>
                        <p class="text-sm text-gray-400 mb-4">Select which lenses to share data from this holon.</p>
                        
                        <div class="grid grid-cols-2 gap-3">
                            {#each availableLenses as lens}
                                {@const isSelected = isLensInArray(lens, selectedHolon.lensConfig.federate)}
                                <label class="flex items-center space-x-3 p-3 rounded-lg border border-gray-600 hover:border-gray-500 transition-colors cursor-pointer {isSelected ? 'bg-blue-900/30 border-blue-600' : ''}">
                                    <input 
                                        type="checkbox" 
                                        checked={isSelected}
                                        on:change={(e) => {
                                            if (selectedHolon && e.currentTarget.checked) {
                                                // Remove any existing case variants first
                                                selectedHolon.lensConfig.federate = selectedHolon.lensConfig.federate.filter(l => normalizeLensName(l) !== normalizeLensName(lens));
                                                // Add the canonical version (lowercase)
                                                selectedHolon.lensConfig.federate = [...selectedHolon.lensConfig.federate, getCanonicalLensName(lens)];
                                            } else if (selectedHolon) {
                                                selectedHolon.lensConfig.federate = selectedHolon.lensConfig.federate.filter(l => normalizeLensName(l) !== normalizeLensName(lens));
                                            }
                                        }}
                                        class="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                                    />
                                    <div class="flex items-center space-x-2">
                                        <span class="text-lg">{getLensIcon(lens)}</span>
                                        <span class="text-sm font-medium text-gray-300">{lens}</span>
                                    </div>
                                </label>
                            {/each}
                        </div>
                    </div>

                    <!-- Notify Section -->
                    <div>
                        <h3 class="text-lg font-medium text-white mb-3">Notifications</h3>
                        <p class="text-sm text-gray-400 mb-4">Select which lenses to receive notifications about.</p>
                        
                        <div class="grid grid-cols-2 gap-3">
                            {#each availableLenses as lens}
                                {@const isSelected = isLensInArray(lens, selectedHolon.lensConfig.notify)}
                                <label class="flex items-center space-x-3 p-3 rounded-lg border border-gray-600 hover:border-gray-500 transition-colors cursor-pointer {isSelected ? 'bg-green-900/30 border-green-600' : ''}">
                                    <input 
                                        type="checkbox" 
                                        checked={isSelected}
                                        on:change={(e) => {
                                            if (selectedHolon && e.currentTarget.checked) {
                                                // Remove any existing case variants first
                                                selectedHolon.lensConfig.notify = selectedHolon.lensConfig.notify.filter(l => normalizeLensName(l) !== normalizeLensName(lens));
                                                // Add the canonical version (lowercase)
                                                selectedHolon.lensConfig.notify = [...selectedHolon.lensConfig.notify, getCanonicalLensName(lens)];
                                            } else if (selectedHolon) {
                                                selectedHolon.lensConfig.notify = selectedHolon.lensConfig.notify.filter(l => normalizeLensName(l) !== normalizeLensName(lens));
                                            }
                                        }}
                                        class="w-4 h-4 text-green-600 bg-gray-700 border-gray-600 rounded focus:ring-green-500"
                                    />
                                    <div class="flex items-center space-x-2">
                                        <span class="text-lg">{getLensIcon(lens)}</span>
                                        <span class="text-sm font-medium text-gray-300">{lens}</span>
                                    </div>
                                </label>
                            {/each}
                        </div>
                    </div>
                </div>
            </div>

            <!-- Modal Footer -->
            <div class="flex justify-end space-x-3 p-6 border-t border-gray-700">
                <button 
                    on:click={() => selectedHolon = null}
                    class="bg-gray-700 hover:bg-gray-600 text-gray-300 px-4 py-2 rounded-lg transition-colors"
                    disabled={saving}
                >
                    Cancel
                </button>
                <button 
                    on:click={() => {
                        if (selectedHolon) {
                            updateLensConfig(
                                selectedHolon.id, 
                                selectedHolon.lensConfig.federate, 
                                selectedHolon.lensConfig.notify
                            );
                            selectedHolon = null;
                        }
                    }}
                    class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                    disabled={saving}
                >
                    {#if saving}
                        <svg class="animate-spin h-4 w-4" viewBox="0 0 24 24">
                            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"/>
                            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                        </svg>
                    {/if}
                    <span>{saving ? 'Saving...' : 'Save Changes'}</span>
                </button>
            </div>
        </div>
    </div>
{/if}