<script lang="ts">
    import { onMount, onDestroy, getContext } from "svelte";
    import { fade, slide } from "svelte/transition";
    import { ID } from "../dashboard/store";
    import HoloSphere from "holosphere";
    import { fetchHolonName } from "../utils/holonNames";

    // Props
    export let isVisible = false;
    
    // Initialize holosphere
    const holosphere = getContext("holosphere") as HoloSphere;
    
    // Current time state
    let currentTime = new Date();
    let timeInterval: ReturnType<typeof setInterval>;
    
    // Holon data state
    $: holonID = $ID;
    let holonName = "Loading...";
    let holonStats = {
        totalTasks: 0,
        completedTasks: 0,
        activeTasks: 0,
        totalRoles: 0,
        roles: [] as Array<{
            title: string;
            participants: Array<{
                id: string;
                username: string;
            }>;
        }>
    };
    let isLoadingStats = true;

    // Time formatting
    function formatTime(date: Date) {
        return date.toLocaleTimeString('en-US', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }

    function formatDate(date: Date) {
        return date.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }

    // Load holon statistics
    async function loadHolonStats() {
        if (!holosphere || !holonID) {
            console.warn("ClockOverlay: holosphere or holonID not available");
            return;
        }

        isLoadingStats = true;
        
        try {
            // Fetch holon name
            holonName = await fetchHolonName(holosphere, holonID);
            
            // Fetch tasks
            const tasksData = await holosphere.getAll(holonID, "quests");
            let totalTasks = 0;
            let completedTasks = 0;
            
            if (Array.isArray(tasksData)) {
                totalTasks = tasksData.length;
                completedTasks = tasksData.filter(task => task.status === 'completed').length;
            } else if (tasksData && typeof tasksData === 'object') {
                const taskEntries = Object.values(tasksData);
                totalTasks = taskEntries.length;
                completedTasks = taskEntries.filter((task: any) => task.status === 'completed').length;
            }

            // Fetch roles
            const rolesData = await holosphere.getAll(holonID, "roles");
            let roles: any[] = [];
            
            if (Array.isArray(rolesData)) {
                roles = rolesData;
            } else if (rolesData && typeof rolesData === 'object') {
                roles = Object.values(rolesData);
            }

            holonStats = {
                totalTasks,
                completedTasks,
                activeTasks: totalTasks - completedTasks,
                totalRoles: roles.length,
                roles: roles.map(role => ({
                    title: role.title || 'Untitled Role',
                    participants: role.participants || []
                }))
            };

            console.log("ClockOverlay: Loaded holon stats", holonStats);
        } catch (error) {
            console.error("ClockOverlay: Error loading holon stats:", error);
        } finally {
            isLoadingStats = false;
        }
    }

    // Watch for holon ID changes
    $: if (holonID && isVisible) {
        loadHolonStats();
    }

    onMount(() => {
        // Update time every second
        timeInterval = setInterval(() => {
            currentTime = new Date();
        }, 1000);

        // Load initial stats if visible
        if (isVisible && holonID) {
            loadHolonStats();
        }
    });

    onDestroy(() => {
        if (timeInterval) {
            clearInterval(timeInterval);
        }
    });

    // Close overlay on escape key
    function handleKeydown(event: KeyboardEvent) {
        if (event.key === 'Escape') {
            isVisible = false;
        }
    }

    // Calculate completion percentage
    $: completionPercentage = holonStats.totalTasks > 0 ? 
        Math.round((holonStats.completedTasks / holonStats.totalTasks) * 100) : 0;
</script>

<svelte:window on:keydown={handleKeydown} />

{#if isVisible}
    <div 
        class="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-8"
        on:click|self={() => isVisible = false}
        on:keydown={handleKeydown}
        transition:fade={{ duration: 300 }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="clock-overlay-title"
        tabindex="0"
    >
        <div 
            class="bg-gray-900/95 backdrop-blur-md rounded-3xl border border-gray-700/50 shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden"
            transition:slide={{ duration: 400, axis: 'y' }}
        >
            <!-- Header -->
            <div class="relative p-6 border-b border-gray-700/50">
                <button 
                    class="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-gray-800/50"
                    on:click={() => isVisible = false}
                    aria-label="Close overlay"
                >
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
                
                <h1 id="clock-overlay-title" class="text-2xl font-bold text-white mb-2">
                    System Overview
                </h1>
                <p class="text-gray-400">
                    {formatDate(currentTime)}
                </p>
            </div>

            <!-- Main Content -->
            <div class="p-8 space-y-8">
                <!-- Digital Clock -->
                <div class="text-center">
                    <div class="text-8xl font-mono font-bold text-white tracking-wider mb-4 drop-shadow-lg">
                        {formatTime(currentTime)}
                    </div>
                    <div class="text-xl text-gray-300">
                        Current Time
                    </div>
                </div>

                <!-- Holon Statistics -->
                <div class="border-t border-gray-700/50 pt-8">
                    <h2 class="text-2xl font-bold text-white mb-6 text-center">
                        Current Holon: {holonName}
                    </h2>

                    {#if isLoadingStats}
                        <div class="flex justify-center items-center py-12">
                            <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                            <span class="ml-4 text-gray-400">Loading statistics...</span>
                        </div>
                    {:else}
                        <div class="grid md:grid-cols-2 gap-8">
                            <!-- Task Statistics -->
                            <div class="bg-gray-800/50 rounded-2xl p-6 border border-gray-700/30">
                                <h3 class="text-xl font-semibold text-white mb-4 flex items-center">
                                    <svg class="w-6 h-6 mr-3 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                                    </svg>
                                    Task Overview
                                </h3>
                                
                                <div class="space-y-4">
                                    <div class="flex justify-between items-center">
                                        <span class="text-gray-300">Total Tasks</span>
                                        <span class="text-2xl font-bold text-white">{holonStats.totalTasks}</span>
                                    </div>
                                    
                                    <div class="flex justify-between items-center">
                                        <span class="text-gray-300">Completed</span>
                                        <span class="text-2xl font-bold text-green-400">{holonStats.completedTasks}</span>
                                    </div>
                                    
                                    <div class="flex justify-between items-center">
                                        <span class="text-gray-300">Active</span>
                                        <span class="text-2xl font-bold text-yellow-400">{holonStats.activeTasks}</span>
                                    </div>

                                    <!-- Progress Bar -->
                                    <div class="mt-6">
                                        <div class="flex justify-between text-sm text-gray-400 mb-2">
                                            <span>Completion Rate</span>
                                            <span>{completionPercentage}%</span>
                                        </div>
                                        <div class="w-full bg-gray-700 rounded-full h-3">
                                            <div 
                                                class="bg-gradient-to-r from-green-500 to-blue-500 h-3 rounded-full transition-all duration-500"
                                                style="width: {completionPercentage}%"
                                            ></div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- Role Statistics -->
                            <div class="bg-gray-800/50 rounded-2xl p-6 border border-gray-700/30">
                                <h3 class="text-xl font-semibold text-white mb-4 flex items-center">
                                    <svg class="w-6 h-6 mr-3 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                    </svg>
                                    Active Roles
                                </h3>
                                
                                <div class="space-y-3 max-h-64 overflow-y-auto">
                                    {#if holonStats.totalRoles === 0}
                                        <div class="text-center py-8">
                                            <svg class="w-12 h-12 text-gray-600 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                            </svg>
                                            <p class="text-gray-400">No roles defined yet</p>
                                        </div>
                                    {:else}
                                        {#each holonStats.roles as role}
                                            <div class="bg-gray-700/50 rounded-lg p-3">
                                                <div class="flex justify-between items-start mb-2">
                                                    <h4 class="font-medium text-white text-sm truncate flex-1">
                                                        {role.title}
                                                    </h4>
                                                    <span class="text-xs text-gray-400 ml-2">
                                                        {role.participants.length} member{role.participants.length !== 1 ? 's' : ''}
                                                    </span>
                                                </div>
                                                
                                                {#if role.participants.length > 0}
                                                    <div class="flex flex-wrap gap-1">
                                                        {#each role.participants.slice(0, 3) as participant}
                                                            <span class="text-xs bg-purple-500/20 text-purple-300 px-2 py-1 rounded-full">
                                                                {participant.username}
                                                            </span>
                                                        {/each}
                                                        {#if role.participants.length > 3}
                                                            <span class="text-xs text-gray-400 px-2 py-1">
                                                                +{role.participants.length - 3} more
                                                            </span>
                                                        {/if}
                                                    </div>
                                                {:else}
                                                    <p class="text-xs text-gray-500 italic">No members assigned</p>
                                                {/if}
                                            </div>
                                        {/each}
                                    {/if}
                                </div>
                            </div>
                        </div>
                    {/if}
                </div>
            </div>

            <!-- Footer -->
            <div class="px-8 py-4 border-t border-gray-700/50 text-center">
                <p class="text-gray-400 text-sm">
                    Press <kbd class="px-2 py-1 bg-gray-700 rounded text-xs">Esc</kbd> to close
                </p>
            </div>
        </div>
    </div>
{/if}

<style>
    kbd {
        box-shadow: inset 0 -1px 0 rgba(255, 255, 255, 0.1);
    }
</style>
