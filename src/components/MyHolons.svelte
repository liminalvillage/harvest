<script lang="ts">
    import { createEventDispatcher, onMount, onDestroy, getContext } from "svelte";
    import { fade, slide, scale } from "svelte/transition";
    import { flip } from "svelte/animate";
    import { page } from "$app/stores";
    import { goto } from "$app/navigation";
    import HoloSphere from "holosphere";
    import { ID, walletAddress } from "../dashboard/store";
    import { fetchHolonName } from "../utils/holonNames";
    import MyHolonsIcon from "../dashboard/sidebar/icons/MyHolonsIcon.svelte";
    import { 
        savePersonalHolons, 
        loadPersonalHolons, 
        loadVisitedHolons, 
        saveVisitedHolons, 
        addVisitedHolon,
        mergeHolonLists,
        type PersonalHolon,
        type VisitedHolon
    } from "../utils/localStorage";
    import QRScanner from "./QRScanner.svelte";

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

    interface VisitedHolon {
        id: string;
        name: string;
        lastVisited: number;
        visitCount: number;
    }

    // State
    let isLoading = true;
    let loadingMessage = 'Loading holons...';
    let connectionReady = false;
    let myHolons: MyHolon[] = [];
    let visitedHolons: VisitedHolon[] = [];
    let federatedHolons: FederatedHolon[] = [];
    let showAddDialog = false;
    let showQRScanner = false;
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
    let activeTab: 'personal' | 'visited' = 'personal';
    let showSplashScreen = false;
    let showHolonIdInfo = false;

    // Filtered holons
    $: filteredHolons = myHolons.filter(holon => 
        holon.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        holon.id.toLowerCase().includes(searchQuery.toLowerCase())
    ).sort((a, b) => {
        let aVal: any = a[sortBy];
        let bVal: any = b[sortBy];
        
        if (typeof aVal === 'string') {
            aVal = aVal.toLowerCase();
            bVal = bVal.toLowerCase();
        }
        
        const multiplier = sortDirection === 'asc' ? 1 : -1;
        return aVal > bVal ? multiplier : -multiplier;
    });

    // Check if we should show splash screen
    // Show splash screen when:
    // 1. Not loading AND
    // 2. No personal holons exist AND
    // 3. No visited holons exist
    $: {
        const personalHolonsCount = myHolons.filter(h => h.isPersonal).length;
        const visitedHolonsCount = visitedHolons.length;
        showSplashScreen = !isLoading && personalHolonsCount === 0 && visitedHolonsCount === 0;
        console.log('Splash screen logic:', {
            isLoading,
            personalHolonsCount,
            visitedHolonsCount,
            myHolonsLength: myHolons.length,
            showSplashScreen
        });
    }

    // Subscribe to current holon ID
    let idStoreUnsubscribe: (() => void) | undefined;

    onMount(async () => {
        // Wait for holosphere to be ready with timeout
        const checkConnection = async () => {
            if (!holosphere) {
                setTimeout(checkConnection, 100);
                return;
            }
            
            await new Promise(resolve => setTimeout(resolve, 200));
            connectionReady = true;
            
            // Subscribe to ID store
            idStoreUnsubscribe = ID.subscribe(async (newId) => {
                // Update current holon ID even if it's undefined/null
                if (newId !== currentHolonId) {
                    currentHolonId = newId || '';
                    await loadData();
                }
            });

            // Load initial data with timeout
            try {
                const loadPromise = loadData();
                const loadTimeout = new Promise((_, reject) => {
                    setTimeout(() => reject(new Error('Initial load timeout')), 20000);
                });
                await Promise.race([loadPromise, loadTimeout]);
            } catch (err) {
                console.error('Initial load failed:', err);
                error = 'Failed to load initial data. Please retry.';
                isLoading = false;
            }
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
        loadingMessage = 'Loading holons...';
        error = '';
        
        try {
            // Load personal holons from localStorage
            loadingMessage = 'Loading personal holons...';
            loadPersonalHolonsFromStorage();
            
            // Load visited holons from localStorage (with or without wallet)
            loadingMessage = 'Loading visited holons...';
            const visitedHolonsData = loadVisitedHolons($walletAddress);
            visitedHolons = visitedHolonsData;
            
            // Load federated holons with timeout
            loadingMessage = 'Loading federated holons...';
            const federatedPromise = loadFederatedHolons();
            const federatedTimeout = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Federated holons timeout')), 5000);
            });
            await Promise.race([federatedPromise, federatedTimeout]);
            
            // Update holon names and stats with timeout
            loadingMessage = 'Updating holon names...';
            const updatePromise = updateHolonDetails();
            const updateVisitedPromise = updateVisitedHolonDetails();
            const updateTimeout = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Update details timeout')), 10000);
            });
            await Promise.race([Promise.all([updatePromise, updateVisitedPromise]), updateTimeout]);
            
            // Add current holon to visited list (only if we have a valid holon ID)
            if (currentHolonId && currentHolonId !== '' && $walletAddress) {
                await addVisitedHolonToSeparateList(currentHolonId);
            }
            
        } catch (err) {
            error = err instanceof Error ? err.message : 'Failed to load holons';
            console.error('Error loading holons:', err);
            
            // Ensure we have at least the basic data loaded
            if (myHolons.length === 0) {
                loadPersonalHolonsFromStorage();
            }
        } finally {
            isLoading = false;
            loadingMessage = 'Loading holons...';
        }
    }

    function loadPersonalHolonsFromStorage() {
        try {
            const loadedHolons = loadPersonalHolons();
            myHolons = loadedHolons;
            console.log('myHolons after loading:', myHolons);
        } catch (err) {
            console.warn('Failed to load personal holons from localStorage:', err);
        }
    }

    async function loadFederatedHolons() {
        // Skip federated holons loading if no current holon ID
        if (!currentHolonId || currentHolonId === '') {
            federatedHolons = [];
            return;
        }
        
        try {
            const federationInfo = await holosphere.getFederation(currentHolonId);
            federatedHolons = [];
            
            if (federationInfo) {
                // Process federation list
                for (const holonId of (federationInfo as any).federation || []) {
                    const lensConfig = (federationInfo as any).lensConfig?.[holonId] || {
                        federate: [],
                        notify: []
                    };
                    
                    const holonName = await fetchHolonName(holosphere, holonId);
                    
                    federatedHolons.push({
                        id: holonId,
                        name: holonName,
                        bidirectional: (federationInfo as any).notify?.includes(holonId) || false,
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
        // Create a backup before updating
        const backup = [...myHolons];
        
        try {
            // First, update names quickly without stats
            const nameUpdates = await Promise.allSettled(
                myHolons.map(async (holon) => {
                    try {
                        const name = await fetchHolonName(holosphere, holon.id);
                        return {
                            ...holon,
                            name
                        };
                    } catch (err) {
                        console.warn(`Failed to update name for holon ${holon.id}:`, err);
                        return holon; // Return original holon if name update fails
                    }
                })
            );
            
            // Process name updates
            const holonsWithNames = nameUpdates
                .map((result, index) => {
                    if (result.status === 'fulfilled') {
                        return result.value;
                    } else {
                        console.warn(`Name update failed for holon ${myHolons[index].id}:`, result.reason);
                        return myHolons[index]; // Keep original holon
                    }
                })
                .filter(Boolean);
            
            if (holonsWithNames.length > 0) {
                myHolons = holonsWithNames;
                savePersonalHolonsToStorage();
            }
            
            // Now update stats asynchronously without blocking
            updateStatsAsync();
            
        } catch (err) {
            console.error('Error updating holon details, restoring backup:', err);
            myHolons = backup;
            savePersonalHolonsToStorage();
        }
    }

    async function updateVisitedHolonDetails() {
        if (!visitedHolons || visitedHolons.length === 0) return;

        const backup = [...visitedHolons];

        try {
            const nameUpdates = await Promise.allSettled(
                visitedHolons.map(async (holon) => {
                    try {
                        const name = await fetchHolonName(holosphere, holon.id);
                        return { ...holon, name: name || holon.name };
                    } catch (err) {
                        console.warn(`Failed to update name for visited holon ${holon.id}:`, err);
                        return holon;
                    }
                })
            );

            const updatedHolons = nameUpdates.map((result, index) => {
                if (result.status === 'fulfilled') {
                    return result.value;
                } else {
                    console.warn(`Name update for visited holon ${backup[index].id} failed:`, result.reason);
                    return backup[index]; // Keep original holon from backup
                }
            });

            visitedHolons = updatedHolons;
            
            if ($walletAddress) {
                saveVisitedHolons($walletAddress, visitedHolons);
            }
        } catch (err) {
            console.error('Error updating visited holon details, restoring from backup:', err);
            visitedHolons = backup;
            if ($walletAddress) {
                saveVisitedHolons($walletAddress, visitedHolons);
            }
        }
    }

    async function updateStatsAsync() {
        // Update stats in the background without blocking the UI
        const statsPromises = myHolons.map(async (holon) => {
            try {
                const [users, tasks, offers] = await Promise.allSettled([
                    holosphere.getAll(holon.id, "users").catch(() => ({})),
                    holosphere.getAll(holon.id, "quests").catch(() => ({})),
                    holosphere.getAll(holon.id, "offers").catch(() => ({}))
                ]);
                
                const stats = {
                    users: Object.keys(users.status === 'fulfilled' ? users.value : {}).length,
                    tasks: Object.keys(tasks.status === 'fulfilled' ? tasks.value : {}).length,
                    offers: Object.keys(offers.status === 'fulfilled' ? offers.value : {}).length,
                    lastActivity: Date.now()
                };
                
                // Update the specific holon with new stats
                const updatedHolon = { ...holon, stats };
                const index = myHolons.findIndex(h => h.id === holon.id);
                if (index !== -1) {
                    myHolons[index] = updatedHolon;
                    myHolons = [...myHolons]; // Trigger reactivity
                    savePersonalHolonsToStorage();
                }
                
                console.log(`Updated stats for holon ${holon.id}:`, stats);
            } catch (err) {
                console.warn(`Failed to update stats for holon ${holon.id}:`, err);
            }
        });
        
        // Don't await this - let it run in the background
        Promise.allSettled(statsPromises).then(() => {
            console.log('All stats updates completed');
        }).catch(err => {
            console.error('Some stats updates failed:', err);
        });
    }

    async function addVisitedHolonToPersonalList(holonId: string) {
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
        
        savePersonalHolonsToStorage();
    }

    function savePersonalHolonsToStorage() {
        try {
            const personalHolons = myHolons.filter(h => h.isPersonal);
            console.log('Saving personal holons:', personalHolons);
            savePersonalHolons(personalHolons);
        } catch (err) {
            console.warn('Failed to save personal holons:', err);
        }
    }

    function restoreFromBackup() {
        try {
            const backupData = localStorage.getItem('myHolons_backup');
            if (backupData) {
                const backup = JSON.parse(backupData);
                if (backup.data && Array.isArray(backup.data)) {
                    myHolons = backup.data.map((holon: any, index: number) => ({
                        ...holon,
                        order: holon.order ?? index,
                        isPersonal: true
                    }));
                    savePersonalHolonsToStorage();
                    success = 'Holograms restored from backup successfully';
                    setTimeout(() => success = '', 5000);
                    console.log('Restored holograms from backup:', myHolons);
                    return true;
                }
            }
        } catch (err) {
            console.error('Failed to restore from backup:', err);
        }
        return false;
    }

    async function addVisitedHolonToSeparateList(holonId: string) {
        if (!$walletAddress) return;
        
        try {
            const holonName = await fetchHolonName(holosphere, holonId);
            
            // Use the centralized function to add visited holon
            addVisitedHolon($walletAddress, holonId, holonName, 'personal');
            
        } catch (err) {
            console.warn('Failed to add visited holon:', err);
        }
    }

    async function addNewHolon() {
        console.log('addNewHolon called with:', { newHolonId, newHolonName });
        
        if (!newHolonId.trim()) {
            error = 'Please enter a holon ID';
            console.log('Error: No holon ID provided');
            return;
        }
        
        if (myHolons.find(h => h.id === newHolonId)) {
            error = 'Holon already exists in your list';
            console.log('Error: Holon already exists');
            return;
        }
        
        try {
            console.log('Attempting to add holon:', newHolonId);
            const name = newHolonName.trim() || await fetchHolonName(holosphere, newHolonId);
            console.log('Holon name resolved:', name);
            
            const newHolon = {
                id: newHolonId,
                name,
                lastVisited: Date.now(),
                isPinned: false,
                isPersonal: true,
                order: myHolons.length,
                color: '#3B82F6'
            };
            
            console.log('Adding new holon:', newHolon);
            myHolons = [...myHolons, newHolon];
            console.log('myHolons after adding:', myHolons);
            
            savePersonalHolonsToStorage();
            showAddDialog = false;
            newHolonId = '';
            newHolonName = '';
            error = '';
            success = 'Holon added successfully';
            showHolonIdInfo = false;
            console.log('Holon added successfully');
            setTimeout(() => success = '', 3000);
        } catch (err) {
            console.error('Error adding holon:', err);
            error = err instanceof Error ? err.message : 'Failed to add holon';
        }
    }

    function handleQRScan(event: CustomEvent<{ decodedText: string }>) {
        const { decodedText } = event.detail;
        console.log('QR Code scanned:', decodedText);
        
        // Extract holon ID from the scanned text
        let holonId = decodedText;
        
        try {
            // If it's a URL, try to extract the holon ID from it
            if (decodedText.includes('://') || decodedText.startsWith('http')) {
                // It's a full URL, try to parse it
                const url = new URL(decodedText);
                const pathParts = url.pathname.split('/').filter(part => part.trim() !== '');
                
                // Look for holon ID in the path
                if (pathParts.length > 0) {
                    // Take the last non-empty part of the path
                    holonId = pathParts[pathParts.length - 1];
                }
            } else if (decodedText.includes('/')) {
                // It's a relative path, split by '/' and take the last part
                const pathParts = decodedText.split('/').filter(part => part.trim() !== '');
                if (pathParts.length > 0) {
                    holonId = pathParts[pathParts.length - 1];
                }
            }
            
            // Clean up the holon ID
            holonId = holonId.split('?')[0]; // Remove query parameters
            holonId = holonId.split('#')[0]; // Remove hash fragments
            holonId = holonId.replace(/\.(html|htm|php|asp|aspx|jsp|jspx)$/i, ''); // Remove file extensions
            
            // Validate that it looks like a holon ID (alphanumeric and some special chars)
            const holonIdPattern = /^[a-zA-Z0-9\-_]+$/;
            
            if (holonId && holonId.trim() && holonIdPattern.test(holonId.trim())) {
                newHolonId = holonId.trim();
                success = `QR code scanned successfully! Extracted holon ID: ${holonId.trim()}`;
                setTimeout(() => success = '', 3000);
            } else {
                error = `Invalid holon ID format: "${holonId}". Please scan a valid holon QR code.`;
                setTimeout(() => error = '', 5000);
            }
        } catch (err) {
            console.error('Error parsing QR code:', err);
            error = 'Error parsing QR code. Please try again.';
            setTimeout(() => error = '', 5000);
        }
        
        showQRScanner = false;
    }

    function handleQRScanError(event: CustomEvent<{ message: string }>) {
        const { message } = event.detail;
        console.error('QR scan error:', message);
        error = `QR scan error: ${message}`;
        setTimeout(() => error = '', 5000);
        showQRScanner = false;
    }

    function removeHolon(holonId: string) {
        if (confirm('Are you sure you want to remove this holon from your list?')) {
            myHolons = myHolons.filter(h => h.id !== holonId);
            savePersonalHolonsToStorage();
            success = 'Holon removed successfully';
            setTimeout(() => success = '', 3000);
        }
    }

    function removeVisitedHolon(holonId: string) {
        if (confirm('Are you sure you want to remove this holon from your visited list?')) {
            visitedHolons = visitedHolons.filter(h => h.id !== holonId);
            // Save the updated visited holons list
            const walletAddr = $walletAddress;
            saveVisitedHolons(walletAddr, visitedHolons);
            success = 'Visited holon removed successfully';
            setTimeout(() => success = '', 3000);
        }
    }

    function addToPersonalHolons(visitedHolon: VisitedHolon) {
        // Check if already in personal holons
        const existingHolon = myHolons.find(h => h.id === visitedHolon.id);
        if (existingHolon) {
            success = 'Holon is already in your personal list';
            setTimeout(() => success = '', 3000);
            return;
        }

        // Add to personal holons
        const newPersonalHolon: MyHolon = {
            id: visitedHolon.id,
            name: visitedHolon.name,
            lastVisited: visitedHolon.lastVisited,
            isPinned: false,
            isPersonal: true,
            order: myHolons.length,
            color: undefined,
            description: undefined,
            stats: undefined
        };

        myHolons = [...myHolons, newPersonalHolon];
        savePersonalHolonsToStorage();
        
        success = 'Holon added to personal list successfully';
        setTimeout(() => success = '', 3000);
    }

    function togglePin(holonId: string) {
        const holon = myHolons.find(h => h.id === holonId);
        if (holon) {
            holon.isPinned = !holon.isPinned;
            savePersonalHolonsToStorage();
        }
    }

    function navigateToHolon(holonId: string) {
        ID.set(holonId);
        
        // Track this visit if wallet is connected
        if ($walletAddress) {
            addVisitedHolonToSeparateList(holonId);
        }
        
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
        savePersonalHolonsToStorage();
        
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
        if (holon.isPinned) return 'pinned';
        if (!holon.isPersonal) return 'federated';
        return 'personal';
    }

    function getHolonTypeLabel(holon: MyHolon) {
        if (holon.isPinned) return 'Pinned';
        if (!holon.isPersonal) return 'Federated';
        return 'Personal';
    }
</script>

{#if showSplashScreen}
    <!-- Splash Screen -->
    <div class="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div class="max-w-2xl w-full bg-gray-800/90 rounded-lg shadow-xl p-8 text-gray-100">
            <div class="text-center mb-8">
                <div class="flex items-center justify-center space-x-3 mb-6">
                    <svg class="text-4xl text-white" xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24">
                        <circle cx="9" cy="12" r="6" fill="transparent" stroke="white" stroke-width="2"/>
                        <circle cx="15" cy="12" r="6" fill="transparent" stroke="white" stroke-width="2"/>
                    </svg>
                    <h1 class="text-3xl font-bold">Welcome to the holonic dashboard</h1>
                </div>
                <p class="text-xl text-gray-300 mb-8">
                    Get started by adding your first holon, and begin managing your holonic networks
                </p>
            </div>

            <!-- Add First Holon Button - Moved to top for visibility -->
            <div class="text-center mb-8">
                <button
                    on:click={() => showAddDialog = true}
                    class="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-lg text-xl font-semibold transition-colors flex items-center justify-center space-x-3 mx-auto shadow-lg"
                >
                    <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                    </svg>
                    <span>Add Your First Holon</span>
                </button>
            </div>

            <div class="space-y-8">
                <!-- How to Add a Holon -->
                <div class="bg-gray-700/50 border border-gray-600 rounded-lg p-6">
                    <h2 class="text-2xl font-semibold text-indigo-400 mb-4">How to Add Your First Holon</h2>
                    <div class="space-y-4">
                        <div class="flex items-start space-x-4">
                            <div class="flex-shrink-0 w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center text-white font-bold">1</div>
                            <div>
                                <h3 class="font-semibold text-white mb-2">Start a conversation with HolonsBot</h3>
                                <p class="text-gray-300">Start a conversation with our Telegram bot or add it to your existing group:</p>
                                <ul class="list-disc list-inside text-gray-400 mt-2 space-y-1">
                                    <li>Start a conversation: <a href="https://t.me/HolonsBot" class="text-indigo-400 hover:text-indigo-300">@HolonsBot</a></li>
                                    <li>Or add the bot to your existing Telegram group</li>
                                </ul>
                            </div>
                        </div>
                        
                        <div class="flex items-start space-x-4">
                            <div class="flex-shrink-0 w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center text-white font-bold">2</div>
                            <div>
                                <h3 class="font-semibold text-white mb-2">Get your Holon ID</h3>
                                <p class="text-gray-300">In the chat with HolonsBot, type one of these commands:</p>
                                <ul class="list-disc list-inside text-gray-400 mt-2 space-y-1">
                                    <li><code class="bg-gray-600 px-2 py-1 rounded">/id</code> or <code class="bg-gray-600 px-2 py-1 rounded">/settings</code> to get your holon ID</li>
                                    <li><code class="bg-gray-600 px-2 py-1 rounded">/dashboard</code> to get a direct link to your holon dashboard</li>
                                </ul>
                            </div>
                        </div>
                        
                        <div class="flex items-start space-x-4">
                            <div class="flex-shrink-0 w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center text-white font-bold">3</div>
                            <div>
                                <h3 class="font-semibold text-white mb-2">Add your Holon</h3>
                                <p class="text-gray-300">Copy the holon ID and add it to the dashboard using the button above, or use the direct link from <code class="bg-gray-600 px-2 py-1 rounded">/dashboard</code></p>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Demo Holon -->
                <div class="bg-gray-700/50 border border-gray-600 rounded-lg p-6">
                    <h3 class="text-xl font-semibold text-green-400 mb-3">Try Our Demo</h3>
                    <p class="text-gray-300 mb-4">Want to see how it works? Check out our demo holon to explore the features.</p>
                    <a href="/demo" class="inline-flex items-center space-x-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>View Demo Holon</span>
                    </a>
                </div>
            </div>
        </div>
    </div>
{:else}
    <!-- Main MyHolons Interface -->
    <div class="p-6">
        <!-- Header -->
        <div class="flex justify-end items-center mb-6">
            <button
                on:click={() => showAddDialog = true}
                class="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
            >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                </svg>
                Add Holon
            </button>
        </div>

        <!-- Tab Navigation -->
        <div class="flex space-x-1 mb-6">
            <button
                on:click={() => activeTab = 'personal'}
                class="px-4 py-2 rounded-lg transition-colors {activeTab === 'personal' ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}"
            >
                Personal Holons
            </button>
            <button
                on:click={() => activeTab = 'visited'}
                class="px-4 py-2 rounded-lg transition-colors {activeTab === 'visited' ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}"
            >
                Visited Holons
            </button>
        </div>

        <!-- Search and Sort Controls -->
        <div class="flex flex-col md:flex-row gap-4 mb-6">
            <div class="flex-1">
                <input
                    type="text"
                    placeholder="Search holons..."
                    bind:value={searchQuery}
                    class="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
            </div>
            <div class="flex gap-2">
                <select
                    bind:value={sortBy}
                    class="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-indigo-500"
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
            <div class="flex flex-col items-center justify-center py-12">
                <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mb-4"></div>
                <p class="text-gray-400 text-center">{loadingMessage}</p>
                <button 
                    on:click={loadData}
                    class="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
                >
                    Retry Loading
                </button>
            </div>
        {:else}
            {#if activeTab === 'personal'}
                <!-- Personal Holons Grid -->
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                    {#each filteredHolons.filter(h => h.isPersonal) as holon, index (holon.id)}
                    <div
                        class="h-full"
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
                        <div
                            class="bg-gray-800 hover:bg-gray-750 p-6 rounded-2xl shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-300 cursor-pointer relative group flex flex-col items-center justify-center text-center h-full"
                            class:ring-2={dragOverIndex === index}
                            class:ring-indigo-500={dragOverIndex === index}
                            class:opacity-50={draggedHolon?.id === holon.id}
                        >
                            <div class="flex-grow flex flex-col items-center justify-center">
                                <div class="w-12 h-12 mx-auto mb-4">
                                    <MyHolonsIcon />
                                </div>
                                <div class="max-w-full">
                                    <h3 class="font-semibold text-white text-lg text-center whitespace-normal break-words leading-tight">{holon.name}</h3>
                                    <p class="text-sm text-gray-400 truncate">{holon.id}</p>
                                </div>
                            </div>

                            <div class="mt-4 text-center w-full">
                                {#if holon.stats}
                                    <div class="flex justify-center gap-3 text-sm text-gray-400">
                                        <span><i class="fas fa-users"></i> {holon.stats.users}</span>
                                        <span><i class="fas fa-tasks"></i> {holon.stats.tasks}</span>
                                        <span><i class="fas fa-gift"></i> {holon.stats.offers}</span>
                                    </div>
                                {/if}
                                <div class="mt-3">
                                    <span class="inline-block text-xs px-2 py-1 bg-gray-700 rounded-full text-gray-300">
                                        {getHolonTypeLabel(holon)}
                                    </span>
                                </div>
                                <div class="text-xs text-gray-500 mt-2">
                                    {formatLastVisited(holon.lastVisited)}
                                </div>
                            </div>

                            <!-- Action Buttons -->
                            <div class="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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
                    </div>
                    {/each}
                </div>
    
                <!-- Empty State for Personal Holons -->
                {#if filteredHolons.filter(h => h.isPersonal).length === 0}
                    <div class="text-center py-12">
                        <svg class="w-16 h-16 text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                        <h3 class="text-xl font-semibold text-gray-400 mb-2">No personal holons found</h3>
                        <p class="text-gray-500 mb-4">Add your first holon to get started</p>
                        
                        <!-- Restore from backup button -->
                        <button
                            on:click={restoreFromBackup}
                            class="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2 mx-auto"
                        >
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            Restore from Backup
                        </button>
                    </div>
                {/if}
            {:else if activeTab === 'visited'}
                <!-- Visited Holons Grid -->
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                    {#each visitedHolons.filter(h => 
                        h.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        h.id.toLowerCase().includes(searchQuery.toLowerCase())
                    ).sort((a, b) => {
                        let aVal: any = a[sortBy === 'lastVisited' ? 'lastVisited' : 'name'];
                        let bVal: any = b[sortBy === 'lastVisited' ? 'lastVisited' : 'name'];
                        
                        if (typeof aVal === 'string') {
                            aVal = aVal.toLowerCase();
                            bVal = bVal.toLowerCase();
                        }
                        
                        const multiplier = sortDirection === 'asc' ? 1 : -1;
                        return aVal > bVal ? multiplier : -multiplier;
                    }) as holon, index (holon.id)}
                        <div
                            class="h-full"
                            on:click={() => navigateToHolon(holon.id)}
                            animate:flip={{ duration: 200 }}
                            in:scale={{ duration: 200 }}
                        >
                            <div class="bg-gray-800 hover:bg-gray-750 p-6 rounded-2xl shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-300 cursor-pointer relative group flex flex-col items-center justify-center text-center h-full">
                                <!-- Top part -->
                                <div class="flex-grow flex flex-col items-center justify-center">
                                    <div class="w-12 h-12 mx-auto mb-4">
                                        <MyHolonsIcon />
                                    </div>
                                    <div class="max-w-full">
                                        <h3 class="font-semibold text-white text-lg text-center whitespace-normal break-words leading-tight">{holon.name}</h3>
                                        <p class="text-sm text-gray-400 truncate">{holon.id}</p>
                                    </div>
                                </div>
                                <!-- Bottom part -->
                                <div class="mt-4 text-center w-full">
                                     <div class="mt-3">
                                        <span class="inline-block text-xs px-2 py-1 bg-indigo-600 rounded-full text-white">
                                            {holon.visitCount} visits
                                        </span>
                                    </div>
                                    <div class="text-xs text-gray-500 mt-2">
                                        {formatLastVisited(holon.lastVisited)}
                                    </div>
                                </div>
                                <!-- Action Buttons -->
                                <div class="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        on:click|stopPropagation={() => addToPersonalHolons(holon)}
                                        class="p-1 hover:bg-green-700 rounded transition-colors text-green-400"
                                        title="Add to personal holons"
                                    >
                                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                                        </svg>
                                    </button>
                                    <button
                                        on:click|stopPropagation={() => removeVisitedHolon(holon.id)}
                                        class="p-1 hover:bg-red-700 rounded transition-colors text-red-400"
                                        title="Remove from visited list"
                                    >
                                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        </div>
                    {/each}
                </div>

                <!-- Empty State for Visited Holons -->
                {#if visitedHolons.length === 0}
                    <div class="text-center py-12">
                        <svg class="w-16 h-16 text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <h3 class="text-xl font-semibold text-gray-400 mb-2">No visited holons</h3>
                        <p class="text-gray-500">Holons you visit will appear here</p>
                        {#if !$walletAddress}
                            <p class="text-sm text-gray-600 mt-2">Connect your wallet to track visited holons</p>
                        {/if}
                    </div>
                {/if}
            {/if}
        {/if}
    </div>
{/if}

<!-- QR Scanner Component -->
<QRScanner 
    showScanner={showQRScanner}
    on:scan={handleQRScan}
    on:error={handleQRScanError}
    on:close={() => showQRScanner = false}
/>

<!-- Add Holon Dialog -->
{#if showAddDialog}
    <div 
        class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" 
        transition:fade
        on:click|self={() => { 
            showAddDialog = false; 
            newHolonId = ''; 
            newHolonName = ''; 
            error = ''; 
            success = '';
            showHolonIdInfo = false;
        }}
    >
        <div class="bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4" transition:scale>
            <h3 class="text-xl font-bold text-white mb-4">Add New Holon</h3>
            
            <!-- Error/Success Messages -->
            {#if error}
                <div class="mb-4 p-3 bg-red-900/20 border border-red-700 rounded-lg text-red-400 text-sm">
                    {error}
                </div>
            {/if}
            
            {#if success}
                <div class="mb-4 p-3 bg-green-900/20 border border-green-700 rounded-lg text-green-400 text-sm">
                    {success}
                </div>
            {/if}
            
            <div class="space-y-4">
                <div>
                    <div class="flex items-center gap-2 mb-2">
                        <label class="block text-sm font-medium text-gray-300">Holon ID *</label>
                        <button
                            type="button"
                            class="text-gray-400 hover:text-white transition-colors p-1 rounded-full hover:bg-gray-700"
                            title="How to get your Holon ID"
                            on:click={() => showHolonIdInfo = !showHolonIdInfo}
                        >
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </button>
                    </div>
                    
                    {#if showHolonIdInfo}
                        <div class="mb-3 p-3 bg-indigo-900/20 border border-indigo-700/50 rounded-lg text-sm">
                            <div class="text-indigo-300 font-medium mb-2">How to get your Holon ID:</div>
                            <div class="text-gray-300 space-y-1">
                                <div>1. Open Telegram and find @HolonsBot</div>
                                <div>2. Send one of these commands:</div>
                                <div class="ml-4 space-y-1">
                                    <div>• <code class="bg-gray-700 px-2 py-1 rounded text-indigo-300">/id</code> - Get your holon ID</div>
                                    <div>• <code class="bg-gray-700 px-2 py-1 rounded text-indigo-300">/dashboard</code> - Get a direct link</div>
                                </div>
                                <div>3. Copy the holon ID and paste it here</div>
                            </div>
                        </div>
                    {/if}
                    
                    <div class="flex gap-2">
                        <input
                            type="text"
                            bind:value={newHolonId}
                            placeholder="Enter holon ID"
                            on:keydown={(e) => {
                                if (e.key === 'Enter') {
                                    addNewHolon();
                                }
                            }}
                            class="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            autofocus
                        />
                        <button
                            type="button"
                            on:click={() => {
                                // Check if we're on desktop (no camera available)
                                const isDesktop = !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia;
                                if (isDesktop) {
                                    error = 'QR scanning is best used on mobile devices with cameras. Please manually enter the holon ID or use a mobile device.';
                                    setTimeout(() => error = '', 5000);
                                    return;
                                }
                                showQRScanner = true;
                            }}
                            class="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors flex items-center gap-2"
                            title="Scan QR Code (Best on mobile devices)"
                        >
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h6v6H3V3zm12 0h6v6h-6V3zM3 15h6v6H3v-6zm12 0h6v6h-6v-6zM9 3v6m0 6v6" />
                            </svg>
                            <span class="hidden sm:inline">Scan</span>
                        </button>
                    </div>
                </div>
                
                <div>
                    <label class="block text-sm font-medium text-gray-300 mb-2">Display Name (optional)</label>
                    <input
                        type="text"
                        bind:value={newHolonName}
                        placeholder="Custom name for display"
                        on:keydown={(e) => {
                            if (e.key === 'Enter') {
                                addNewHolon();
                            }
                        }}
                        class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                </div>
            </div>
            
            <div class="flex gap-3 mt-6">
                <button
                    on:click={addNewHolon}
                    class="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2 px-4 rounded-lg transition-colors"
                >
                    Add Holon
                </button>
                <button
                    on:click={() => { 
                        showAddDialog = false; 
                        newHolonId = ''; 
                        newHolonName = ''; 
                        error = ''; 
                        success = '';
                        showHolonIdInfo = false;
                    }}
                    class="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-2 px-4 rounded-lg transition-colors"
                >
                    Cancel
                </button>
            </div>
        </div>
    </div>
{/if}