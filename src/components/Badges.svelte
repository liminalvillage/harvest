<script lang="ts">
    import { onMount, getContext } from "svelte";
    import { fade, slide } from "svelte/transition";
    import { ID } from "../dashboard/store";
    import HoloSphere from "holosphere";

    // Props
    export let isVisible = false;
    
    // Initialize holosphere
    const holosphere = getContext("holosphere") as HoloSphere;
    
    // Holon data state
    $: holonID = $ID;
    
    // Badge data state
    let badges: Array<{
        title: string;
        description: string;
        icon: string;
        rarity: string;
        created_at: string;
        created_by: string;
        awarded_to: Array<{
            id: string;
            username: string;
            first_name: string;
            last_name: string;
            awarded_at: string;
            awarded_via: string;
        }>;
    }> = [];
    
    let isLoading = false;
    let selectedBadge: typeof badges[0] | null = null;
    let showBadgeModal = false;

    // Load badges data
    async function loadBadges() {
        if (!holosphere || !holonID) return;
        
        isLoading = true;
        try {
            const badgesData = await holosphere.getAll(holonID, "badges");
            let badgesArray: any[] = [];
            
            if (Array.isArray(badgesData)) {
                badgesArray = badgesData;
            } else if (badgesData && typeof badgesData === 'object') {
                badgesArray = Object.values(badgesData);
            }
            
            // Sort badges by creation date (newest first)
            badges = badgesArray
                .filter(badge => badge && badge.title)
                .sort((a, b) => {
                    const dateA = new Date(a.created_at || 0).getTime();
                    const dateB = new Date(b.created_at || 0).getTime();
                    return dateB - dateA;
                });
                
        } catch (error) {
            console.error("Badges: Error loading badges:", error);
        } finally {
            isLoading = false;
        }
    }

    // Get rarity color
    function getRarityColor(rarity: string) {
        switch (rarity?.toLowerCase()) {
            case 'legendary':
                return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
            case 'epic':
                return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
            case 'rare':
                return 'bg-green-500/20 text-green-300 border-green-500/30';
            case 'uncommon':
                return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';
            case 'common':
            default:
                return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
        }
    }

    // Get rarity icon
    function getRarityIcon(rarity: string) {
        switch (rarity?.toLowerCase()) {
            case 'legendary':
                return '⭐';
            case 'epic':
                return '💎';
            case 'rare':
                return '🔮';
            case 'uncommon':
                return '✨';
            case 'common':
            default:
                return '🔰';
        }
    }

    // Format date
    function formatDate(dateString: string) {
        if (!dateString) return 'Unknown';
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch {
            return 'Invalid date';
        }
    }

    // Show badge details modal
    function showBadgeDetails(badge: typeof badges[0]) {
        selectedBadge = badge;
        showBadgeModal = true;
    }

    // Close badge modal
    function closeBadgeModal() {
        showBadgeModal = false;
        selectedBadge = null;
    }

    // Watch for holon ID changes
    $: if (holonID && isVisible) {
        loadBadges();
    }

    onMount(() => {
        if (isVisible && holonID) {
            loadBadges();
        }
    });
</script>

{#if isVisible}
    <div 
        class="fixed inset-0 z-50 bg-gradient-to-br from-gray-800 via-gray-700 to-indigo-900 flex items-center justify-center p-4"
        on:click|self={() => isVisible = false}
        transition:fade={{ duration: 300 }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="badges-title"
        tabindex="0"
    >
        <div 
            class="w-full max-w-6xl h-full max-h-[95vh] bg-black/30 backdrop-blur-lg rounded-3xl border border-white/10 shadow-2xl overflow-hidden"
            transition:slide={{ duration: 400, axis: 'y' }}
        >
            <!-- Close Button -->
            <button 
                class="absolute top-6 right-6 z-10 text-white/60 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/10"
                on:click={() => isVisible = false}
                aria-label="Close badges"
            >
                <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>

            <!-- Main Content -->
            <div class="h-full p-8 pb-16 flex flex-col">
                <!-- Header -->
                <div class="text-center mb-8">
                    <h1 id="badges-title" class="text-4xl font-bold text-white mb-2">
                        🏆 Community Badges
                    </h1>
                    <p class="text-white/60 text-lg">
                        Celebrate achievements and contributions
                    </p>
                </div>

                <!-- Badges Grid -->
                <div class="flex-1 overflow-hidden">
                    {#if isLoading}
                        <div class="flex items-center justify-center h-full">
                            <div class="text-center">
                                <div class="animate-spin rounded-full h-16 w-16 border-b-2 border-white/50 mx-auto mb-4"></div>
                                <p class="text-white/60 text-lg">Loading badges...</p>
                            </div>
                        </div>
                    {:else if badges.length === 0}
                        <div class="text-center py-12">
                            <div class="text-8xl mb-6">🏆</div>
                            <h3 class="text-2xl font-semibold text-white mb-3">No Badges Yet</h3>
                            <p class="text-white/60 text-lg max-w-md mx-auto">
                                Badges will appear here as community members earn them through their contributions and achievements.
                            </p>
                        </div>
                    {:else}
                        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-h-full overflow-y-auto pr-2 custom-scrollbar">
                            {#each badges as badge}
                                <div 
                                    class="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20 hover:border-white/30 transition-all duration-200 hover:bg-white/15 cursor-pointer group"
                                    on:click={() => showBadgeDetails(badge)}
                                    on:keydown={(e) => e.key === 'Enter' && showBadgeDetails(badge)}
                                    tabindex="0"
                                    role="button"
                                    aria-label="View {badge.title} badge details"
                                >
                                    <!-- Badge Header -->
                                    <div class="text-center mb-4">
                                        <div class="text-6xl mb-3 group-hover:scale-110 transition-transform duration-200">
                                            {badge.icon || '🏆'}
                                        </div>
                                        <h3 class="text-xl font-semibold text-white mb-2 group-hover:text-indigo-300 transition-colors">
                                            {badge.title}
                                        </h3>
                                        <div class="flex items-center justify-center space-x-2 mb-3">
                                            <span class="text-sm {getRarityColor(badge.rarity)} px-3 py-1 rounded-full border">
                                                {getRarityIcon(badge.rarity)} {badge.rarity || 'common'}
                                            </span>
                                        </div>
                                    </div>

                                    <!-- Badge Description -->
                                    <p class="text-white/70 text-sm text-center mb-4 line-clamp-3">
                                        {badge.description || 'No description available'}
                                    </p>

                                    <!-- Badge Stats -->
                                    <div class="text-center">
                                        <div class="text-2xl font-bold text-indigo-300 mb-1">
                                            {badge.awarded_to?.length || 0}
                                        </div>
                                        <div class="text-xs text-white/50">
                                            {badge.awarded_to?.length === 1 ? 'recipient' : 'recipients'}
                                        </div>
                                    </div>

                                    <!-- Hover Effect -->
                                    <div class="absolute inset-0 rounded-2xl border-2 border-transparent group-hover:border-indigo-400/30 transition-all duration-200 pointer-events-none"></div>
                                </div>
                            {/each}
                        </div>
                    {/if}
                </div>

                <!-- Footer -->
                <div class="text-center mt-8">
                    <p class="text-white/40 text-sm">
                        Click on any badge to see who has earned it and when
                    </p>
                </div>
            </div>
        </div>
    </div>
{/if}

<!-- Badge Details Modal -->
{#if showBadgeModal && selectedBadge}
    <div 
        class="fixed inset-0 z-60 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
        on:click|self={closeBadgeModal}
        transition:fade={{ duration: 200 }}
    >
        <div 
            class="w-full max-w-2xl bg-gray-800/95 backdrop-blur-lg rounded-2xl border border-white/20 shadow-2xl overflow-hidden"
            transition:slide={{ duration: 300, axis: 'y' }}
        >
            <!-- Modal Header -->
            <div class="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 text-center">
                <div class="text-6xl mb-4">{selectedBadge.icon || '🏆'}</div>
                <h2 class="text-2xl font-bold text-white mb-2">{selectedBadge.title}</h2>
                <div class="flex items-center justify-center space-x-2">
                    <span class="text-sm {getRarityColor(selectedBadge.rarity)} px-3 py-1 rounded-full border">
                        {getRarityIcon(selectedBadge.rarity)} {selectedBadge.rarity || 'common'}
                    </span>
                </div>
            </div>

            <!-- Modal Content -->
            <div class="p-6">
                <p class="text-white/80 text-center mb-6">
                    {selectedBadge.description || 'No description available'}
                </p>

                <!-- Recipients Section -->
                <div class="mb-6">
                    <h3 class="text-lg font-semibold text-white mb-4 text-center">
                        Awarded to {selectedBadge.awarded_to?.length || 0} {selectedBadge.awarded_to?.length === 1 ? 'person' : 'people'}
                    </h3>
                    
                    {#if selectedBadge.awarded_to && selectedBadge.awarded_to.length > 0}
                        <div class="space-y-3 max-h-64 overflow-y-auto custom-scrollbar">
                            {#each selectedBadge.awarded_to as recipient}
                                <div class="bg-white/10 rounded-lg p-4 border border-white/20">
                                    <div class="flex items-center justify-between">
                                        <div class="flex items-center space-x-3">
                                            <div class="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold">
                                                {(recipient.first_name?.[0] || recipient.username?.[0] || '?').toUpperCase()}
                                            </div>
                                            <div>
                                                <div class="font-medium text-white">
                                                    {recipient.first_name} {recipient.last_name}
                                                </div>
                                                <div class="text-sm text-white/60">
                                                    @{recipient.username}
                                                </div>
                                            </div>
                                        </div>
                                        <div class="text-right">
                                            <div class="text-sm text-indigo-300 font-medium">
                                                {formatDate(recipient.awarded_at)}
                                            </div>
                                            <div class="text-xs text-white/50">
                                                via {recipient.awarded_via || 'unknown'}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            {/each}
                        </div>
                    {:else}
                        <div class="text-center py-8">
                            <div class="text-4xl mb-3">🎯</div>
                            <p class="text-white/60">No one has earned this badge yet. Be the first!</p>
                        </div>
                    {/if}
                </div>

                <!-- Badge Info -->
                <div class="bg-white/5 rounded-lg p-4 border border-white/10">
                    <div class="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <span class="text-white/60">Created:</span>
                            <div class="text-white font-medium">{formatDate(selectedBadge.created_at)}</div>
                        </div>
                        <div>
                            <span class="text-white/60">Created by:</span>
                            <div class="text-white font-medium">{selectedBadge.created_by || 'Unknown'}</div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Modal Footer -->
            <div class="bg-gray-700/50 p-4 flex justify-end">
                <button 
                    class="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
                    on:click={closeBadgeModal}
                >
                    Close
                </button>
            </div>
        </div>
    </div>
{/if}

<style>
    /* Custom scrollbar styles */
    .custom-scrollbar::-webkit-scrollbar {
        width: 6px;
    }
    
    .custom-scrollbar::-webkit-scrollbar-track {
        background: rgba(255, 255, 255, 0.1);
        border-radius: 3px;
    }
    
    .custom-scrollbar::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.3);
        border-radius: 3px;
    }
    
    .custom-scrollbar::-webkit-scrollbar-thumb:hover {
        background: rgba(255, 255, 255, 0.5);
    }

    /* Line clamp utility */
    .line-clamp-3 {
        display: -webkit-box;
        -webkit-line-clamp: 3;
        -webkit-box-orient: vertical;
        overflow: hidden;
    }
</style>
