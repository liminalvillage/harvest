<script lang="ts">
    import { createEventDispatcher, onMount, onDestroy, getContext } from "svelte";
    import { fade, slide } from "svelte/transition";
    import HoloSphere from "holosphere";
    import { ID } from "../dashboard/store";

    // Initialize holosphere
    const holosphere = getContext("holosphere") as HoloSphere;
    const dispatch = createEventDispatcher();

    let unsubscribe: (() => void) | undefined;
    let isLoading = true;
    let connectionReady = false;
    let holons: any[] = [];
    let filteredHolons: any[] = [];
    let searchQuery = "";
    let sortBy = "name";
    let sortDirection = "asc";
    let refreshing = false;

    interface HolonStats {
        id: string;
        name: string;
        users: number;
        activeUsers: number;
        totalTasks: number;
        completedTasks: number;
        openTasks: number;
        shoppingItems: number;
        offers: number;
        needs: number;
        checklists: number;
        completedChecklists: number;
        announcements: number;
        expenses: number;
        federationCount: number;
        federatedWith: string[];
        notifyList: string[];
        purpose: string;
        lastActivity: number;
        status: "active" | "inactive" | "unknown";
    }

    // Helper function to ensure we get arrays from API calls
    function ensureArray(data: any): any[] {
        if (!data) return [];
        if (Array.isArray(data)) return data;
        if (typeof data === 'object' && Object.keys(data).length === 0) return [];
        // If it's an object with properties, convert to array of values
        if (typeof data === 'object') return Object.values(data);
        return [];
    }

    onMount(() => {
        // Wait for holosphere to be ready before proceeding
        const checkConnection = async () => {
            if (!holosphere) {
                setTimeout(checkConnection, 100);
                return;
            }
            
            // Add a small delay to ensure the connection is stable
            await new Promise(resolve => setTimeout(resolve, 200));
            connectionReady = true;
            
            // Initial fetch
            await fetchAllHolons();
        };
        
        checkConnection();

        // Cleanup subscription on unmount
        return () => {
            if (unsubscribe) unsubscribe();
        };
    });

    // Watch search query
    $: {
        if (searchQuery) {
            filteredHolons = holons.filter(holon => 
                holon.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                holon.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                holon.purpose.toLowerCase().includes(searchQuery.toLowerCase())
            );
        } else {
            filteredHolons = [...holons];
        }
        
        // Apply sorting
        filteredHolons.sort((a, b) => {
            let aVal = a[sortBy];
            let bVal = b[sortBy];
            
            if (typeof aVal === 'string') {
                aVal = aVal.toLowerCase();
                bVal = bVal.toLowerCase();
            }
            
            if (sortDirection === 'asc') {
                return aVal > bVal ? 1 : -1;
            } else {
                return aVal < bVal ? 1 : -1;
            }
        });
    }

    async function fetchAllHolons() {
        if (!holosphere || !connectionReady) return;
        
        isLoading = true;
        holons = [];
        
        try {
            console.log("Fetching all federation data...");
            
            // Get all federation data to discover holons
            const federationData = await holosphere.getAllGlobal('federation');
            console.log("Federation data:", federationData);
            
            // Create a set of unique holon IDs
            const holonIds = new Set<string>();
            
            // Add all holon IDs from federation data
            const fedArray = ensureArray(federationData);
            if (fedArray.length > 0) {
                fedArray.forEach(fed => {
                    if (fed && fed.id && typeof fed.id === 'string' && fed.id.trim() !== '') {
                        holonIds.add(fed.id);
                    }
                    // Also add federated spaces
                    if (fed && fed.federation && Array.isArray(fed.federation)) {
                        fed.federation.forEach(id => {
                            if (typeof id === 'string' && id.trim() !== '') {
                                holonIds.add(id);
                            }
                        });
                    }
                    // Also add notify spaces  
                    if (fed && fed.notify && Array.isArray(fed.notify)) {
                        fed.notify.forEach(id => {
                            if (typeof id === 'string' && id.trim() !== '') {
                                holonIds.add(id);
                            }
                        });
                    }
                });
            }
            
            // If no federation data found, add current holon at least
            if (holonIds.size === 0 && $ID) {
                holonIds.add($ID);
            }
            
            // Filter out invalid IDs
            const validHolonIds = Array.from(holonIds).filter(id => {
                if (!id || typeof id !== 'string') return false;
                const trimmed = id.trim();
                if (trimmed === '' || trimmed.includes('\n') || trimmed.includes('fedInfo2')) return false;
                return true;
            });
            
            console.log(`Found ${validHolonIds.length} unique holons:`, validHolonIds);
            
            // Fetch stats for each holon with error handling
            const holonStatsPromises = validHolonIds.map(async (holonId) => {
                try {
                    return await fetchHolonStats(holonId);
                } catch (error) {
                    console.warn(`Failed to fetch stats for holon ${holonId}:`, error);
                    return null;
                }
            });
            
            const stats = await Promise.all(holonStatsPromises);
            holons = stats.filter(stat => stat !== null);
            
            console.log(`Successfully fetched stats for ${holons.length} holons`);
            
        } catch (error) {
            console.error('Error fetching all holons:', error);
        } finally {
            isLoading = false;
        }
    }

    async function fetchHolonStats(holonId: string): Promise<HolonStats | null> {
        try {
            console.log(`Fetching stats for holon: ${holonId}`);
            
            // Get federation info for this holon
            const fedInfo = await holosphere.getFederation(holonId).catch(() => null);
            
            // Fetch data from each lens with small delays and proper error handling
            const [usersData, questsData, shoppingData, offersData, checklistsData, announcementsData, expensesData, settings] = await Promise.all([
                holosphere.getAll(holonId, "users").catch(() => null),
                new Promise(resolve => setTimeout(() => holosphere.getAll(holonId, "quests").then(resolve).catch(() => resolve(null)), 50)),
                new Promise(resolve => setTimeout(() => holosphere.getAll(holonId, "shopping").then(resolve).catch(() => resolve(null)), 100)),
                new Promise(resolve => setTimeout(() => holosphere.getAll(holonId, "offers").then(resolve).catch(() => resolve(null)), 150)),
                new Promise(resolve => setTimeout(() => holosphere.getAll(holonId, "checklists").then(resolve).catch(() => resolve(null)), 200)),
                new Promise(resolve => setTimeout(() => holosphere.getAll(holonId, "announcements").then(resolve).catch(() => resolve(null)), 250)),
                new Promise(resolve => setTimeout(() => holosphere.getAll(holonId, "expenses").then(resolve).catch(() => resolve(null)), 300)),
                holosphere.get(holonId, "settings", holonId).catch(() => null)
            ]);
            
            // Convert to arrays safely
            const users = ensureArray(usersData);
            const quests = ensureArray(questsData);
            const shopping = ensureArray(shoppingData);
            const offers = ensureArray(offersData);
            const checklists = ensureArray(checklistsData);
            const announcements = ensureArray(announcementsData);
            const expenses = ensureArray(expensesData);
            
            console.log(`Stats for ${holonId}:`, { users: users.length, quests: quests.length, shopping: shopping.length });
            
            // Calculate statistics
            const userCount = users.length;
            const activeUsers = users.filter((user: any) => {
                // Consider user active if they have recent activity (last 30 days)
                const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
                return user && user.lastSeen && user.lastSeen > thirtyDaysAgo;
            }).length;
            
            // Process quests to separate tasks, proposals, and events
            const actualTasks = quests.filter((item: any) => item && (!item.type || item.type === "task"));
            const completedTasks = actualTasks.filter((task: any) => task && task.status === "completed").length;
            const openTasks = actualTasks.filter((task: any) => task && task.status !== "completed").length;
            
            // Calculate needs from quests with type "need" or "want"
            const needs = quests.filter((item: any) => item && (item.type === "need" || item.type === "want")).length;
            
            const shoppingCount = shopping.length;
            const offerCount = offers.length;
            const checklistCount = checklists.length;
            const completedChecklistCount = checklists.filter((checklist: any) => checklist && checklist.completed === true).length;
            const announcementCount = announcements.length;
            const expenseCount = expenses.length;
            
            // Get holon name and purpose from settings
            const holonName = (settings && settings.name) ? settings.name : holonId;
            const purpose = (settings && settings.purpose) ? settings.purpose : "";
            
            // Calculate last activity (most recent timestamp from any data)
            let lastActivity = 0;
            const allData = [...users, ...quests, ...shopping, ...offers];
            allData.forEach((item: any) => {
                if (!item) return;
                if (item.timestamp && item.timestamp > lastActivity) {
                    lastActivity = item.timestamp;
                }
                if (item.updated && item.updated > lastActivity) {
                    lastActivity = item.updated;
                }
                if (item.created && item.created > lastActivity) {
                    lastActivity = item.created;
                }
            });
            
            // Determine status based on recent activity
            const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
            const status = lastActivity > sevenDaysAgo ? "active" : (lastActivity > 0 ? "inactive" : "unknown");
            
            return {
                id: holonId,
                name: holonName,
                users: userCount,
                activeUsers: activeUsers,
                totalTasks: actualTasks.length,
                completedTasks: completedTasks,
                openTasks: openTasks,
                shoppingItems: shoppingCount,
                offers: offerCount,
                needs: needs,
                checklists: checklistCount,
                completedChecklists: completedChecklistCount,
                announcements: announcementCount,
                expenses: expenseCount,
                federationCount: ((fedInfo?.federation?.length || 0) + (fedInfo?.notify?.length || 0)),
                federatedWith: fedInfo?.federation || [],
                notifyList: fedInfo?.notify || [],
                purpose: purpose,
                lastActivity: lastActivity,
                status: status
            };
            
        } catch (error) {
            console.error(`Error fetching stats for holon ${holonId}:`, error);
            return null;
        }
    }

    function navigateToHolon(holonId: string) {
        // Navigate to the holon
        dispatch('navigate', { holonId });
        
        // Also update the ID store
        ID.set(holonId);
        
        // Navigate using browser
        window.location.href = `/${holonId}/dashboard`;
    }

    function handleSort(field: string) {
        if (sortBy === field) {
            sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            sortBy = field;
            sortDirection = 'asc';
        }
    }

    async function refreshData() {
        refreshing = true;
        await fetchAllHolons();
        refreshing = false;
    }

    function formatDate(timestamp: number) {
        if (!timestamp) return "Never";
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) return "Today";
        if (diffDays === 1) return "Yesterday";
        if (diffDays < 7) return `${diffDays} days ago`;
        if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
        if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
        return `${Math.floor(diffDays / 365)} years ago`;
    }

    function getStatusColor(status: string) {
        switch (status) {
            case 'active': return 'text-green-400';
            case 'inactive': return 'text-yellow-400';
            default: return 'text-gray-400';
        }
    }

    function getStatusIcon(status: string) {
        switch (status) {
            case 'active': return '🟢';
            case 'inactive': return '🟡';
            default: return '⚪';
        }
    }
</script>

{#if isLoading && !connectionReady}
<div class="flex items-center justify-center min-h-screen">
    <div class="text-center">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
        <p class="text-gray-400">Connecting to holosphere...</p>
    </div>
</div>
{:else}
<div class="space-y-6">
    <!-- Header -->
    <div class="bg-gradient-to-r from-gray-800 to-gray-700 py-6 px-8 rounded-3xl shadow-2xl">
        <div class="flex flex-col md:flex-row justify-between items-center">
            <div class="text-center md:text-left mb-4 md:mb-0">
                <h1 class="text-4xl font-bold text-white mb-2">Global Holons Network</h1>
                <p class="text-gray-300 text-lg">Discover and explore all holons in the network</p>
            </div>
            <div class="flex items-center space-x-4">
                <button 
                    on:click={refreshData}
                    disabled={refreshing}
                    class="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white px-4 py-2 rounded-lg transition-colors flex items-center space-x-2"
                >
                    <i class="fas fa-sync-alt {refreshing ? 'animate-spin' : ''}"></i>
                    <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
                </button>
                <div class="text-white text-right">
                    <p class="text-2xl font-bold">{holons.length}</p>
                    <p class="text-sm text-gray-300">Total Holons</p>
                </div>
            </div>
        </div>
    </div>

    <!-- Search and Filters -->
    <div class="bg-gray-800 p-6 rounded-2xl shadow-xl">
        <div class="flex flex-col md:flex-row gap-4">
            <!-- Search -->
            <div class="flex-1">
                <div class="relative">
                    <i class="fas fa-search absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"></i>
                    <input
                        type="text"
                        bind:value={searchQuery}
                        placeholder="Search holons by name, ID, or purpose..."
                        class="w-full pl-10 pr-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                </div>
            </div>

            <!-- Quick Stats -->
            <div class="flex items-center space-x-6 text-sm">
                <div class="text-center">
                    <div class="text-green-400 font-bold text-lg">{holons.filter(h => h.status === 'active').length}</div>
                    <div class="text-gray-400">Active</div>
                </div>
                <div class="text-center">
                    <div class="text-yellow-400 font-bold text-lg">{holons.filter(h => h.status === 'inactive').length}</div>
                    <div class="text-gray-400">Inactive</div>
                </div>
                <div class="text-center">
                    <div class="text-blue-400 font-bold text-lg">{holons.reduce((sum, h) => sum + h.federationCount, 0)}</div>
                    <div class="text-gray-400">Federations</div>
                </div>
            </div>
        </div>
    </div>

    <!-- Holons Table -->
    <div class="bg-gray-800 rounded-2xl shadow-xl overflow-hidden">
        {#if isLoading}
            <div class="p-8 text-center">
                <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
                <p class="text-gray-400">Loading holons...</p>
            </div>
        {:else if filteredHolons.length === 0}
            <div class="p-8 text-center">
                <i class="fas fa-search text-4xl text-gray-500 mb-4"></i>
                <p class="text-gray-400 text-lg">No holons found</p>
                <p class="text-gray-500 text-sm mt-2">Try adjusting your search criteria</p>
            </div>
        {:else}
            <div class="overflow-x-auto">
                <table class="w-full">
                    <thead class="bg-gray-700">
                        <tr>
                            <th class="px-6 py-4 text-left">
                                <button 
                                    on:click={() => handleSort('name')}
                                    class="flex items-center space-x-1 text-gray-300 hover:text-white transition-colors"
                                >
                                    <span>Holon</span>
                                    <i class="fas fa-sort text-xs"></i>
                                </button>
                            </th>
                            <th class="px-6 py-4 text-left">
                                <button 
                                    on:click={() => handleSort('status')}
                                    class="flex items-center space-x-1 text-gray-300 hover:text-white transition-colors"
                                >
                                    <span>Status</span>
                                    <i class="fas fa-sort text-xs"></i>
                                </button>
                            </th>
                            <th class="px-6 py-4 text-left">
                                <button 
                                    on:click={() => handleSort('users')}
                                    class="flex items-center space-x-1 text-gray-300 hover:text-white transition-colors"
                                >
                                    <span>Users</span>
                                    <i class="fas fa-sort text-xs"></i>
                                </button>
                            </th>
                            <th class="px-6 py-4 text-left">
                                <button 
                                    on:click={() => handleSort('totalTasks')}
                                    class="flex items-center space-x-1 text-gray-300 hover:text-white transition-colors"
                                >
                                    <span>Tasks</span>
                                    <i class="fas fa-sort text-xs"></i>
                                </button>
                            </th>
                            <th class="px-6 py-4 text-left">
                                <button 
                                    on:click={() => handleSort('shoppingItems')}
                                    class="flex items-center space-x-1 text-gray-300 hover:text-white transition-colors"
                                >
                                    <span>Shopping</span>
                                    <i class="fas fa-sort text-xs"></i>
                                </button>
                            </th>
                            <th class="px-6 py-4 text-left">
                                <button 
                                    on:click={() => handleSort('offers')}
                                    class="flex items-center space-x-1 text-gray-300 hover:text-white transition-colors"
                                >
                                    <span>Offers</span>
                                    <i class="fas fa-sort text-xs"></i>
                                </button>
                            </th>
                            <th class="px-6 py-4 text-left">
                                <button 
                                    on:click={() => handleSort('needs')}
                                    class="flex items-center space-x-1 text-gray-300 hover:text-white transition-colors"
                                >
                                    <span>Needs</span>
                                    <i class="fas fa-sort text-xs"></i>
                                </button>
                            </th>
                            <th class="px-6 py-4 text-left">
                                <button 
                                    on:click={() => handleSort('federationCount')}
                                    class="flex items-center space-x-1 text-gray-300 hover:text-white transition-colors"
                                >
                                    <span>Federation</span>
                                    <i class="fas fa-sort text-xs"></i>
                                </button>
                            </th>
                            <th class="px-6 py-4 text-left">
                                <button 
                                    on:click={() => handleSort('lastActivity')}
                                    class="flex items-center space-x-1 text-gray-300 hover:text-white transition-colors"
                                >
                                    <span>Last Activity</span>
                                    <i class="fas fa-sort text-xs"></i>
                                </button>
                            </th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-700">
                        {#each filteredHolons as holon, index (holon.id)}
                            <tr 
                                class="hover:bg-gray-700 transition-colors"
                                in:fade={{ duration: 200, delay: index * 50 }}
                            >
                                <!-- Holon Name (Clickable) -->
                                <td class="px-6 py-4">
                                    <button
                                        on:click={() => navigateToHolon(holon.id)}
                                        class="text-left group"
                                        title="Navigate to {holon.name}"
                                    >
                                        <div class="font-semibold text-blue-400 group-hover:text-blue-300 transition-colors">
                                            {holon.name}
                                        </div>
                                        <div class="text-xs text-gray-500 mt-1">{holon.id}</div>
                                        {#if holon.purpose}
                                            <div class="text-xs text-gray-400 mt-1 italic max-w-xs truncate">
                                                "{holon.purpose}"
                                            </div>
                                        {/if}
                                    </button>
                                </td>

                                <!-- Status -->
                                <td class="px-6 py-4">
                                    <div class="flex items-center space-x-2">
                                        <span class="text-lg">{getStatusIcon(holon.status)}</span>
                                        <span class="{getStatusColor(holon.status)} capitalize font-medium">
                                            {holon.status}
                                        </span>
                                    </div>
                                </td>

                                <!-- Users -->
                                <td class="px-6 py-4">
                                    <div class="text-white font-medium">{holon.users}</div>
                                    {#if holon.activeUsers > 0}
                                        <div class="text-xs text-green-400">{holon.activeUsers} active</div>
                                    {/if}
                                </td>

                                <!-- Tasks -->
                                <td class="px-6 py-4">
                                    <div class="text-white font-medium">{holon.totalTasks}</div>
                                    <div class="text-xs text-gray-400">
                                        {holon.completedTasks} done, {holon.openTasks} open
                                    </div>
                                </td>

                                <!-- Shopping -->
                                <td class="px-6 py-4">
                                    <div class="text-white font-medium">{holon.shoppingItems}</div>
                                    <div class="text-xs text-gray-400">items</div>
                                </td>

                                <!-- Offers -->
                                <td class="px-6 py-4">
                                    <div class="text-white font-medium">{holon.offers}</div>
                                    <div class="text-xs text-gray-400">available</div>
                                </td>

                                <!-- Needs -->
                                <td class="px-6 py-4">
                                    <div class="text-white font-medium">{holon.needs}</div>
                                    <div class="text-xs text-gray-400">requested</div>
                                </td>

                                <!-- Federation -->
                                <td class="px-6 py-4">
                                    <div class="text-white font-medium">{holon.federationCount}</div>
                                    <div class="text-xs text-gray-400">
                                        {holon.federatedWith.length} fed, {holon.notifyList.length} notify
                                    </div>
                                </td>

                                <!-- Last Activity -->
                                <td class="px-6 py-4">
                                    <div class="text-white font-medium">{formatDate(holon.lastActivity)}</div>
                                    {#if holon.lastActivity}
                                        <div class="text-xs text-gray-400">
                                            {new Date(holon.lastActivity).toLocaleDateString()}
                                        </div>
                                    {/if}
                                </td>
                            </tr>
                        {/each}
                    </tbody>
                </table>
            </div>
        {/if}
    </div>

    <!-- Summary Stats -->
    <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <div class="bg-gray-800 p-6 rounded-2xl shadow-xl">
            <div class="flex items-center justify-between">
                <div>
                    <p class="text-3xl font-bold text-white">{holons.reduce((sum, h) => sum + h.users, 0)}</p>
                    <p class="text-gray-400">Total Users</p>
                </div>
                <i class="fas fa-users text-2xl text-blue-400"></i>
            </div>
        </div>

        <div class="bg-gray-800 p-6 rounded-2xl shadow-xl">
            <div class="flex items-center justify-between">
                <div>
                    <p class="text-3xl font-bold text-white">{holons.reduce((sum, h) => sum + h.totalTasks, 0)}</p>
                    <p class="text-gray-400">Total Tasks</p>
                </div>
                <i class="fas fa-tasks text-2xl text-green-400"></i>
            </div>
        </div>

        <div class="bg-gray-800 p-6 rounded-2xl shadow-xl">
            <div class="flex items-center justify-between">
                <div>
                    <p class="text-3xl font-bold text-white">{holons.reduce((sum, h) => sum + h.offers, 0)}</p>
                    <p class="text-gray-400">Total Offers</p>
                </div>
                <i class="fas fa-handshake text-2xl text-yellow-400"></i>
            </div>
        </div>

        <div class="bg-gray-800 p-6 rounded-2xl shadow-xl">
            <div class="flex items-center justify-between">
                <div>
                    <p class="text-3xl font-bold text-white">{holons.reduce((sum, h) => sum + h.federationCount, 0)}</p>
                    <p class="text-gray-400">Federation Links</p>
                </div>
                <i class="fas fa-network-wired text-2xl text-purple-400"></i>
            </div>
        </div>
    </div>
</div>
{/if} 