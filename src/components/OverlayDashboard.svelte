<script lang="ts">
    import { onMount, onDestroy, getContext } from "svelte";
import { fade, slide, scale, fly } from "svelte/transition";
import { elasticOut } from "svelte/easing";
import { ID } from "../dashboard/store";
import HoloSphere from "holosphere";
import MyHolonsIcon from "../dashboard/sidebar/icons/MyHolonsIcon.svelte";
import { goto } from "$app/navigation";
import { fetchHolonName } from "../utils/holonNames";
import RoleModal from "./RoleModal.svelte";
import TaskModal from "./TaskModal.svelte";
import ItemModal from "./ItemModal.svelte";

    // Props
    export let isVisible = false;
    
    // Auto-trigger after inactivity
    let inactivityTimer: ReturnType<typeof setTimeout>;
    let lastActivityTime = Date.now();
    const INACTIVITY_TIMEOUT = 3 * 60 * 1000; // 3 minutes
    
    // Initialize holosphere
    const holosphere = getContext("holosphere") as HoloSphere;
    
    // Current time state
    let currentTime = new Date();
    let timeInterval: ReturnType<typeof setInterval>;
    let dataRefreshInterval: ReturnType<typeof setInterval>;
    
    // Track current date to detect midnight transitions
    let currentDate = new Date().toDateString();
    
    // Holon data state
    $: holonID = $ID;
    
    // Holon name state
    let holonName = '';
    let isLoadingHolonName = false;
    
    // Roles and users data state
    let roles: Array<{
        id: string;
        title: string;
        description?: string;
        participants: Array<{
            id: string;
            username: string;
            first_name?: string;
            last_name?: string;
        }>;
        created_at?: string;
        status?: string;
    }> = [];
    let users: Record<string, any> = {};
    let isLoadingRoles = false;
    let isLoadingUsers = false;

    // Events data state
    let upcomingEvents: Array<{
        id: string;
        title: string;
        time: string;
        date: string;
        sortTime: number;
        type: string;
        icon: string;
        description?: string;
        participants?: Array<{id: string}>;
        priority?: string;
        status?: string;
    }> = [];
    let isLoadingEvents = false;

    // Tasks data state
    let topTasks: Array<{
        id: string;
        title: string;
        priority?: string;
        dueDate?: string;
        status: string;
        participants?: Array<{id: string}>;
    }> = [];
    let isLoadingTasks = false;

    // Badges data state
    let badges: Array<{
        id: string;
        title: string;
        description?: string;
        recipients?: Array<{id: string}>;
    }> = [];
    let isLoadingBadges = false;



    // Subscription cleanup functions
    let rolesUnsubscribe: (() => void) | null = null;
    let usersUnsubscribe: (() => void) | null = null;
    let eventsUnsubscribe: (() => void) | null = null;
    let tasksUnsubscribe: (() => void) | null = null;
    let badgesUnsubscribe: (() => void) | null = null;
    let holonNameUnsubscribe: (() => void) | null = null;

    // Debounce timers for batch updates
    let rolesUpdateTimeout: ReturnType<typeof setTimeout> | null = null;
    let usersUpdateTimeout: ReturnType<typeof setTimeout> | null = null;
    let eventsUpdateTimeout: ReturnType<typeof setTimeout> | null = null;
    let tasksUpdateTimeout: ReturnType<typeof setTimeout> | null = null;
    let badgesUpdateTimeout: ReturnType<typeof setTimeout> | null = null;

    // Modal states
    let showRoleModal = false;
    let showTaskModal = false;
    let showEventModal = false;
    let showBadgeModal = false;
    let selectedItem: any = null;



    // Time formatting
    function formatTime(date: Date) {
        return date.toLocaleTimeString('en-US', {
            hour12: true,
            hour: 'numeric',
            minute: '2-digit'
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

    function formatDay(date: Date) {
        return date.toLocaleDateString('en-US', {
            weekday: 'long'
        });
    }

    function formatDateShort(date: Date) {
        return date.toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric'
        });
    }

    function formatTimeSeconds(date: Date) {
        return date.toLocaleTimeString('en-US', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }

    // Cleanup existing subscriptions
    function cleanupSubscriptions() {
        if (rolesUnsubscribe) {
            rolesUnsubscribe();
            rolesUnsubscribe = null;
        }
        if (usersUnsubscribe) {
            usersUnsubscribe();
            usersUnsubscribe = null;
        }
        if (eventsUnsubscribe) {
            eventsUnsubscribe();
            eventsUnsubscribe = null;
        }
        if (tasksUnsubscribe) {
            tasksUnsubscribe();
            tasksUnsubscribe = null;
        }
        if (badgesUnsubscribe) {
            badgesUnsubscribe();
            badgesUnsubscribe = null;
        }
        if (holonNameUnsubscribe) {
            holonNameUnsubscribe();
            holonNameUnsubscribe = null;
        }
        
        // Clear timeouts
        [rolesUpdateTimeout, usersUpdateTimeout, eventsUpdateTimeout, 
         tasksUpdateTimeout, badgesUpdateTimeout].forEach(timeout => {
            if (timeout) clearTimeout(timeout);
        });
    }

    // Debounced update functions
    function debounceRolesUpdate(updateFn: () => void) {
        if (rolesUpdateTimeout) clearTimeout(rolesUpdateTimeout);
        rolesUpdateTimeout = setTimeout(updateFn, 50);
    }

    function debounceUsersUpdate(updateFn: () => void) {
        if (usersUpdateTimeout) clearTimeout(usersUpdateTimeout);
        usersUpdateTimeout = setTimeout(updateFn, 50);
    }

    function debounceEventsUpdate(updateFn: () => void) {
        if (eventsUpdateTimeout) clearTimeout(eventsUpdateTimeout);
        eventsUpdateTimeout = setTimeout(updateFn, 50);
    }

    function debounceTasksUpdate(updateFn: () => void) {
        if (tasksUpdateTimeout) clearTimeout(tasksUpdateTimeout);
        tasksUpdateTimeout = setTimeout(updateFn, 50);
    }

    function debounceBadgesUpdate(updateFn: () => void) {
        if (badgesUpdateTimeout) clearTimeout(badgesUpdateTimeout);
        badgesUpdateTimeout = setTimeout(updateFn, 50);
    }

    // Subscribe to roles data with real-time updates
    async function subscribeToRoles() {
        if (!holosphere || !holonID) return;
        
        // Cleanup existing subscription
        if (rolesUnsubscribe) {
            rolesUnsubscribe();
            rolesUnsubscribe = null;
        }
        
        isLoadingRoles = true;
        try {
            // Load initial data
            const rolesData = await holosphere.getAll(holonID, "roles");
            let rolesStore: Record<string, any> = {};
            
            if (Array.isArray(rolesData)) {
                rolesData.forEach((role, index) => {
                    const key = role.id || role.title || index.toString();
                    rolesStore[key] = role;
                });
            } else if (rolesData && typeof rolesData === 'object') {
                rolesStore = rolesData;
            }
            
            // Process and normalize roles from store
            const updateRolesFromStore = () => {
                roles = Object.values(rolesStore).map((role: any) => ({
                    id: role.id || role.title || Math.random().toString(),
                    title: role.title || 'Untitled Role',
                    description: role.description,
                    participants: role.participants || [],
                    created_at: role.created_at,
                    status: role.status || 'active'
                }));
            };
            
            updateRolesFromStore();
            
            // Set up real-time subscription
            const subscription = await holosphere.subscribe(holonID, "roles", (newRole: any, key?: string) => {
                debounceRolesUpdate(() => {
                    if (newRole && key) {
                        rolesStore[key] = newRole;
                    } else if (key) {
                        delete rolesStore[key];
                    }
                    updateRolesFromStore();
                });
            });
            
            if (typeof subscription === 'function') {
                rolesUnsubscribe = subscription;
            } else if (subscription && typeof subscription.unsubscribe === 'function') {
                rolesUnsubscribe = subscription.unsubscribe;
            }
            
        } catch (error) {
            console.error("OverlayDashboard: Error subscribing to roles:", error);
        } finally {
            isLoadingRoles = false;
        }
    }

    // Subscribe to users data with real-time updates
    async function subscribeToUsers() {
        if (!holosphere || !holonID) return;
        
        // Cleanup existing subscription
        if (usersUnsubscribe) {
            usersUnsubscribe();
            usersUnsubscribe = null;
        }
        
        isLoadingUsers = true;
        try {
            // Load initial data
            const usersData = await holosphere.getAll(holonID, "users");
            let usersStore: Record<string, any> = {};
            
            if (Array.isArray(usersData)) {
                // Convert array to object with user ID as key
                usersData.forEach(user => {
                    if (user && user.id) {
                        usersStore[user.id] = user;
                    }
                });
            } else if (usersData && typeof usersData === 'object') {
                usersStore = usersData;
            }
            
            users = usersStore;
            
            // Set up real-time subscription
            const subscription = await holosphere.subscribe(holonID, "users", (newUser: any, key?: string) => {
                debounceUsersUpdate(() => {
                    if (newUser && key) {
                        // Use user.id as canonical key if available
                        const canonicalKey = newUser.id || key;
                        if (newUser.id && key !== newUser.id) {
                            // Remove old key if different
                            delete usersStore[key];
                        }
                        usersStore[canonicalKey] = newUser;
                    } else if (key) {
                        delete usersStore[key];
                    }
                    users = { ...usersStore };
                });
            });
            
            if (typeof subscription === 'function') {
                usersUnsubscribe = subscription;
            } else if (subscription && typeof subscription.unsubscribe === 'function') {
                usersUnsubscribe = subscription.unsubscribe;
            }
            
        } catch (error) {
            console.error("OverlayDashboard: Error subscribing to users:", error);
        } finally {
            isLoadingUsers = false;
        }
    }

    // Shared quest store for both events and tasks
    let questsStore: Record<string, any> = {};

    // Subscribe to quests data with real-time updates (handles both events and tasks)
    async function subscribeToQuests() {
        if (!holosphere || !holonID) return;
        
        // Cleanup existing subscription
        if (eventsUnsubscribe) {
            eventsUnsubscribe();
            eventsUnsubscribe = null;
        }
        
        isLoadingEvents = true;
        isLoadingTasks = true;
        try {
            // Load initial data
            const questsData = await holosphere.getAll(holonID, "quests");
            questsStore = {};
            
            if (Array.isArray(questsData)) {
                questsData.forEach((quest, index) => {
                    const key = quest.id || index.toString();
                    questsStore[key] = quest;
                });
            } else if (questsData && typeof questsData === 'object') {
                questsStore = questsData;
            }
            
            // Process events to filter for upcoming scheduled items (from today onwards)
            const updateEventsFromStore = () => {
                const quests = Object.values(questsStore);
                const today = new Date();
                const todayStr = today.toISOString().split('T')[0];
                
                upcomingEvents = quests.filter((quest: any) => {
                    // Include any item that has a 'when' field (is scheduled), regardless of type
                    if (!quest.when || quest.status === 'completed' || quest.status === 'cancelled') return false;
                    const whenDate = new Date(quest.when);
                    const eventDateStr = whenDate.toISOString().split('T')[0];
                    // Include events from today onwards (not just today)
                    return eventDateStr >= todayStr;
                }).map((quest: any) => {
                    const whenDate = new Date(quest.when);
                    return {
                        id: quest.id || Math.random().toString(),
                        title: quest.title || quest.name || 'Untitled Event',
                        time: whenDate.toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true
                        }),
                        date: whenDate.toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric'
                        }),
                        sortTime: whenDate.getTime(),
                        type: quest.type || 'event',
                        icon: quest.type === 'task' ? '✓' : quest.type === 'quest' ? '⚔️' : quest.type === 'recurring' ? '🔄' : '📅',
                        participants: quest.participants || [],
                        priority: quest.priority,
                        status: quest.status
                    };
                }).sort((a, b) => a.sortTime - b.sortTime);
            };
            
            // Process tasks to filter active ones
            const updateTasksFromStore = () => {
                const quests = Object.values(questsStore);
                
                topTasks = quests.filter((quest: any) => 
                    quest.status !== 'completed' && quest.status !== 'cancelled'
                ).map((quest: any) => ({
                    id: quest.id || Math.random().toString(),
                    title: quest.title || quest.name || 'Untitled Task',
                    priority: quest.priority,
                    dueDate: quest.dueDate,
                    status: quest.status || 'pending',
                    participants: quest.participants || []
                }));
            };
            
            // Combined update function for both events and tasks
            const updateFromStore = () => {
                updateEventsFromStore();
                updateTasksFromStore();
            };
            
            updateFromStore();
            
            // Set up real-time subscription
            const subscription = await holosphere.subscribe(holonID, "quests", (newQuest: any, key?: string) => {
                // Debounce both events and tasks updates together
                if (eventsUpdateTimeout) clearTimeout(eventsUpdateTimeout);
                if (tasksUpdateTimeout) clearTimeout(tasksUpdateTimeout);
                
                eventsUpdateTimeout = setTimeout(() => {
                    if (newQuest && key) {
                        questsStore[key] = newQuest;
                    } else if (key) {
                        delete questsStore[key];
                    }
                    updateFromStore();
                }, 50);
            });
            
            if (typeof subscription === 'function') {
                eventsUnsubscribe = subscription;
            } else if (subscription && typeof subscription.unsubscribe === 'function') {
                eventsUnsubscribe = subscription.unsubscribe;
            }
            
        } catch (error) {
            console.error("OverlayDashboard: Error subscribing to quests:", error);
        } finally {
            isLoadingEvents = false;
            isLoadingTasks = false;
        }
    }

    // Subscribe to holon name with real-time updates
    async function subscribeToHolonName() {
        if (!holosphere || !holonID) return;
        
        // Cleanup existing subscription
        if (holonNameUnsubscribe) {
            holonNameUnsubscribe();
            holonNameUnsubscribe = null;
        }
        
        isLoadingHolonName = true;
        try {
            holonName = await fetchHolonName(holosphere, holonID);
            
            // Note: Holon metadata subscriptions may not be available in all holosphere implementations
            // This is kept for future compatibility
            
        } catch (error) {
            console.error("OverlayDashboard: Error loading holon name:", error);
            holonName = `Holon ${holonID}`;
        } finally {
            isLoadingHolonName = false;
        }
    }

    // Subscribe to badges data with real-time updates
    async function subscribeToBadges() {
        if (!holosphere || !holonID) return;
        
        // Cleanup existing subscription
        if (badgesUnsubscribe) {
            badgesUnsubscribe();
            badgesUnsubscribe = null;
        }
        
        isLoadingBadges = true;
        try {
            // Load initial data
            const badgesData = await holosphere.getAll(holonID, "badges");
            let badgesStore: Record<string, any> = {};
            
            if (Array.isArray(badgesData)) {
                badgesData.forEach((badge, index) => {
                    const key = badge.id || index.toString();
                    badgesStore[key] = badge;
                });
            } else if (badgesData && typeof badgesData === 'object') {
                badgesStore = badgesData;
            }
            
            // Process badges from store
            const updateBadgesFromStore = () => {
                badges = Object.values(badgesStore).map((badge: any) => ({
                    id: badge.id || Math.random().toString(),
                    title: badge.title || badge.name || 'Untitled Badge',
                    description: badge.description || badge.details,
                    recipients: badge.recipients || badge.owners || []
                }));
            };
            
            updateBadgesFromStore();
            
            // Set up real-time subscription
            const subscription = await holosphere.subscribe(holonID, "badges", (newBadge: any, key?: string) => {
                debounceBadgesUpdate(() => {
                    if (newBadge && key) {
                        badgesStore[key] = newBadge;
                    } else if (key) {
                        delete badgesStore[key];
                    }
                    updateBadgesFromStore();
                });
            });
            
            if (typeof subscription === 'function') {
                badgesUnsubscribe = subscription;
            } else if (subscription && typeof subscription.unsubscribe === 'function') {
                badgesUnsubscribe = subscription.unsubscribe;
            }
            
        } catch (error) {
            console.error("OverlayDashboard: Error subscribing to badges:", error);
        } finally {
            isLoadingBadges = false;
        }
    }

    // Navigate to roles component
    function navigateToRoles() {
        if (holonID) {
            goto(`/${holonID}/roles`);
            // Close the Zeitcamp Dashboard
            isVisible = false;
        }
    }

    // Handle item clicks to show modals
    function handleRoleClick(role: any, event?: MouseEvent) {
        selectedItem = role;
        showRoleModal = true;
    }

    function handleTaskClick(task: any, event?: MouseEvent) {
        selectedItem = task;
        showTaskModal = true;
    }

    function handleEventClick(eventItem: any, event?: MouseEvent) {
        selectedItem = eventItem;
        showEventModal = true;
    }

    function handleBadgeClick(badge: any, event?: MouseEvent) {
        selectedItem = badge;
        showBadgeModal = true;
    }

    // Close all modals
    function closeAllModals() {
        showRoleModal = false;
        showTaskModal = false;
        showEventModal = false;
        showBadgeModal = false;
        selectedItem = null;
    }

    // Get user display name
    function getUserDisplayName(userId: string): string {
        const user = users[userId];
        if (!user) return 'Unknown User';
        
        if (user.first_name && user.last_name) {
            return `${user.first_name} ${user.last_name}`;
        } else if (user.first_name) {
            return user.first_name;
        } else if (user.username) {
            return user.username;
        }
        
        return 'Unknown User';
    }

    // Dynamic content visibility
    $: hasRoles = roles.length > 0;
    $: hasEvents = upcomingEvents.length > 0;
    $: hasTasks = topTasks.length > 0;
    $: hasBadges = badges.length > 0;

    // Count visible sections for layout decisions
    $: visibleSections = [hasRoles, hasEvents, hasTasks, hasBadges].filter(Boolean).length;



    // Inactivity detection functions
    function resetInactivityTimer() {
        lastActivityTime = Date.now();
        if (inactivityTimer) {
            clearTimeout(inactivityTimer);
        }
        
        if (!isVisible) {
            inactivityTimer = setTimeout(() => {
                const timeSinceActivity = Date.now() - lastActivityTime;
                if (timeSinceActivity >= INACTIVITY_TIMEOUT) {
                    isVisible = true;
                }
            }, INACTIVITY_TIMEOUT);
        }
    }

    function handleActivity() {
        resetInactivityTimer();
    }

    // Watch for holon ID changes and set up real-time subscriptions
    $: if (holonID && isVisible) {
        // Cleanup previous subscriptions for this holon
        cleanupSubscriptions();
        
        // Set up new subscriptions
        subscribeToHolonName();
        subscribeToRoles();
        subscribeToUsers();
        subscribeToQuests(); // Handles both events and tasks
        subscribeToBadges();
    }

    onMount(() => {
        // Update time every second and check for date changes
        timeInterval = setInterval(() => {
            const newTime = new Date();
            const newDate = newTime.toDateString();
            
            // Check if date changed (midnight transition)
            if (newDate !== currentDate) {
                currentDate = newDate;
                // Refresh events for the new day if we have quest data
                if (questsStore && Object.keys(questsStore).length > 0) {
                    const updateEventsFromStore = () => {
                        const quests = Object.values(questsStore);
                        const today = new Date();
                        const todayStr = today.toISOString().split('T')[0];
                        
                        upcomingEvents = quests.filter((quest: any) => {
                            if (!quest.when || quest.status === 'completed' || quest.status === 'cancelled') return false;
                            const whenDate = new Date(quest.when);
                            const eventDateStr = whenDate.toISOString().split('T')[0];
                            // Include events from today onwards (not just today)
                            return eventDateStr >= todayStr;
                        }).map((quest: any) => {
                            const whenDate = new Date(quest.when);
                            return {
                                id: quest.id || Math.random().toString(),
                                title: quest.title || quest.name || 'Untitled Event',
                                time: whenDate.toLocaleTimeString('en-US', {
                                    hour: 'numeric',
                                    minute: '2-digit',
                                    hour12: true
                                }),
                                date: whenDate.toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric'
                                }),
                                sortTime: whenDate.getTime(),
                                type: quest.type || 'event',
                                icon: quest.type === 'task' ? '✓' : quest.type === 'quest' ? '⚔️' : quest.type === 'recurring' ? '🔄' : '📅',
                                participants: quest.participants || [],
                                priority: quest.priority,
                                status: quest.status
                            };
                        }).sort((a, b) => a.sortTime - b.sortTime);
                    };
                    updateEventsFromStore();
                }
            }
            
            currentTime = newTime;
        }, 1000);

        // Set up periodic data refresh (every 30 seconds) 
        dataRefreshInterval = setInterval(() => {
            if (isVisible && holonID) {
                // Refresh all data periodically
                subscribeToRoles();
                subscribeToUsers();
                subscribeToQuests();
                subscribeToBadges();
            }
        }, 30000); // 30 seconds

        // Set up initial subscriptions if visible and holon is available
        if (isVisible && holonID) {
            subscribeToHolonName();
            subscribeToRoles();
            subscribeToUsers();
            subscribeToQuests(); // Handles both events and tasks
            subscribeToBadges();
        }

        // Set up inactivity detection
        resetInactivityTimer();
        
        // Add event listeners for user activity
        const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
        events.forEach(event => {
            document.addEventListener(event, handleActivity, true);
        });

        return () => {
            events.forEach(event => {
                document.removeEventListener(event, handleActivity, true);
            });
        };
    });

    onDestroy(() => {
        // Clean up timers
        if (timeInterval) {
            clearInterval(timeInterval);
        }
        if (dataRefreshInterval) {
            clearInterval(dataRefreshInterval);
        }
        if (inactivityTimer) {
            clearTimeout(inactivityTimer);
        }

        // Clean up all subscriptions
        cleanupSubscriptions();
    });

    // Close overlay on escape key
    function handleKeydown(event: KeyboardEvent) {
        if (event.key === 'Escape') {
            isVisible = false;
            resetInactivityTimer(); // Reset timer when closing
        }
    }

    // Handle visibility changes
    $: if (!isVisible) {
        // When dashboard is closed, restart inactivity timer
        resetInactivityTimer();
    }
</script>

<svelte:window on:keydown={handleKeydown} />

{#if isVisible}
    <div 
        class="fixed inset-0 z-50 bg-gradient-to-br from-gray-800 via-gray-700 to-indigo-900 flex items-center justify-center p-4"
        on:click|self={() => isVisible = false}
        on:keydown={handleKeydown}
        transition:fade={{ duration: 300 }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="zeitcamp-title"
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
                aria-label="Close dashboard"
            >
                <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>

            <!-- Main Dashboard Content -->
            <div class="h-full p-8 pb-16 flex flex-col">
                <!-- Top Section: Date, Holons Logo -->
                <div class="flex justify-between items-start mb-8">
                    <!-- Date Section -->
                    <div class="text-left">
                        <div class="text-6xl font-light text-white mb-2">
                            {formatDay(currentTime)}
                        </div>
                        <div class="text-2xl text-white/80 font-light">
                            {formatDateShort(currentTime)}
                        </div>
                    </div>

                    <!-- Holons Logo (same as ClockOverlay) -->
                    <div class="flex items-center justify-center">
                        <div class="w-16 h-16 sm:w-20 sm:h-20">
                            <MyHolonsIcon />
                        </div>
                    </div>

                    <!-- Holon Name Section -->
                    <div class="text-right">
                        {#if isLoadingHolonName}
                            <div class="flex items-center justify-end">
                                <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-white/50 mr-3"></div>
                                <span class="text-white/60">Loading...</span>
                            </div>
                        {:else if holonName}
                            <div class="text-right">
                                <div class="text-4xl font-light text-white">
                                    {holonName}
                                </div>
                            </div>
                        {:else}
                            <div class="text-white/40 text-lg">Unknown Holon</div>
                        {/if}
                    </div>
                </div>

                <!-- Center Section: Dynamic Layout -->
                <div class="flex-1 flex flex-col">
                    {#if visibleSections === 0}
                        <!-- No content - show large clock centered -->
                        <div class="flex-1 flex items-center justify-center">
                            <div class="text-center">
                                <div class="text-8xl md:text-9xl lg:text-[10rem] font-light text-white tracking-wider mb-4 drop-shadow-2xl">
                                    {formatTime(currentTime)}
                                </div>
                                <div class="text-lg text-white/50 font-mono tracking-wider mb-8">
                                    {formatTimeSeconds(currentTime)}
                                </div>
                                <div class="text-white/40 text-lg">
                                    No content available
                                </div>
                            </div>
                        </div>
                    {:else}
                        <!-- Content available - show dynamic grid -->
                        <div class="flex-1 px-4">
                            <div class="w-full h-full max-w-6xl mx-auto
                                {visibleSections === 1 ? 'grid grid-cols-1 gap-6' :
                                visibleSections === 2 ? 'grid grid-cols-1 lg:grid-cols-2 gap-6' :
                                visibleSections === 3 ? 'grid grid-cols-1 lg:grid-cols-3 gap-4' :
                                'grid grid-cols-1 lg:grid-cols-2 gap-4'}">

                                <!-- Clock positioned based on layout -->
                                {#if visibleSections <= 3}
                                    <div class="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/15 flex items-center justify-center shadow-lg hidden lg:block">
                                        <div class="text-center">
                                            <div class="text-5xl xl:text-7xl font-light text-white tracking-wider mb-2">
                                                {formatTime(currentTime)}
                                            </div>
                                            <div class="text-sm text-white/60">
                                                {formatDay(currentTime)}
                                            </div>
                                        </div>
                                    </div>
                                {/if}
                                <!-- Roles Section -->
                                {#if hasRoles}
                                <div class="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20 overflow-hidden"
                                    in:fly="{{ x: -100, duration: 600, delay: 100, easing: elasticOut }}">

                                    <h3 class="text-xl font-semibold text-white mb-4 flex items-center">
                                        <svg class="w-6 h-6 mr-3 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                        </svg>
                                        Active Roles
                                    </h3>
                            
                                    {#if isLoadingRoles}
                                        <div class="flex items-center py-4">
                                            <div class="animate-spin rounded-full h-5 w-5 border-b-2 border-white/50 mr-3"></div>
                                            <span class="text-white/60 text-sm">Loading roles...</span>
                                        </div>
                                    {:else}
                                        <div class="space-y-3 max-h-40 overflow-y-auto overflow-x-hidden pr-2 custom-scrollbar min-h-0 flex flex-col">
                                            {#each roles as role}
                                                <div 
                                                    class="bg-white/5 rounded-lg p-3 border border-white/10 cursor-pointer hover:bg-white/10 transition-colors"
                                                    on:click={() => handleRoleClick(role)}
                                                    on:keydown={(e) => e.key === 'Enter' && handleRoleClick(role)}
                                                    role="button"
                                                    tabindex="0"
                                                >
                                                    <div class="flex justify-between items-start mb-1">
                                                        <h4 class="font-medium text-white text-sm truncate flex-1 pr-2">
                                                            {role.title}
                                                        </h4>
                                                        {#if role.participants && role.participants.length > 0}
                                                            <span class="text-xs text-indigo-300 whitespace-nowrap">
                                                                {role.participants.length} members
                                                            </span>
                                                        {/if}
                                                    </div>
                                                    {#if role.description}
                                                        <p class="text-xs text-white/60 truncate">
                                                            {role.description}
                                                        </p>
                                                    {/if}
                                                </div>
                                            {/each}
                                        </div>
                                    {/if}
                                </div>
                            {/if}

                                <!-- Events Section -->
                                {#if hasEvents}
                                <div class="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20 overflow-hidden"
                                    in:fly="{{ x: 100, duration: 600, delay: 200, easing: elasticOut }}">

                                    <h3 class="text-xl font-semibold text-white mb-4 flex items-center">
                                        <svg class="w-6 h-6 mr-3 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                        Upcoming Events
                                    </h3>
                            
                                    {#if isLoadingEvents}
                                        <div class="flex items-center py-4">
                                            <div class="animate-spin rounded-full h-5 w-5 border-b-2 border-white/50 mr-3"></div>
                                            <span class="text-white/60 text-sm">Loading events...</span>
                                        </div>
                                    {:else}
                                        <div class="space-y-3 max-h-40 overflow-y-auto overflow-x-hidden pr-2 custom-scrollbar min-h-0 flex flex-col">
                                            {#each upcomingEvents as event}
                                                <div 
                                                    class="bg-white/5 rounded-lg p-3 border border-white/10 cursor-pointer hover:bg-white/10 transition-colors"
                                                    on:click={() => handleEventClick(event)}
                                                    on:keydown={(e) => e.key === 'Enter' && handleEventClick(event)}
                                                    role="button"
                                                    tabindex="0"
                                                >
                                                    <div class="flex justify-between items-start mb-1">
                                                        <div class="flex items-center flex-1 pr-2">
                                                            <svg class="w-4 h-4 mr-2 text-green-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                            </svg>
                                                            <h4 class="font-medium text-white text-sm truncate">
                                                                {event.title}
                                                            </h4>
                                                        </div>
                                                        <div class="flex items-center space-x-2">
                                                            {#if event.priority && event.priority !== 'normal'}
                                                                <span class="text-xs px-2 py-1 rounded-full {
                                                                    event.priority === 'high' ? 'bg-red-500/20 text-red-300' :
                                                                    event.priority === 'medium' ? 'bg-amber-500/20 text-amber-300' :
                                                                    'bg-gray-500/20 text-gray-300'
                                                                }">
                                                                    {event.priority}
                                                                </span>
                                                            {/if}
                                                            <span class="text-xs text-green-300 font-mono whitespace-nowrap">
                                                                {event.time}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    {#if event.description}
                                                        <p class="text-xs text-white/60 truncate">
                                                            {event.description}
                                                        </p>
                                                    {/if}
                                                </div>
                                            {/each}
                                        </div>
                                    {/if}
                                </div>
                            {/if}

                                <!-- Tasks Section -->
                                {#if hasTasks}
                                <div class="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20 overflow-hidden"
                                    in:fly="{{ x: -100, duration: 600, delay: 300, easing: elasticOut }}">

                                    <h3 class="text-xl font-semibold text-white mb-4 flex items-center">
                                        <svg class="w-6 h-6 mr-3 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                                        </svg>
                                        Active Tasks
                                    </h3>
                            
                                    {#if isLoadingTasks}
                                        <div class="flex items-center py-4">
                                            <div class="animate-spin rounded-full h-5 w-5 border-b-2 border-white/50 mr-3"></div>
                                            <span class="text-white/60 text-sm">Loading tasks...</span>
                                        </div>
                                    {:else}
                                        <div class="space-y-3 max-h-40 overflow-y-auto overflow-x-hidden pr-2 custom-scrollbar min-h-0 flex flex-col">
                                            {#each topTasks as task}
                                                <div 
                                                    class="bg-white/5 rounded-lg p-3 border border-white/10 cursor-pointer hover:bg-white/10 transition-colors"
                                                    on:click={() => handleTaskClick(task)}
                                                    on:keydown={(e) => e.key === 'Enter' && handleTaskClick(task)}
                                                    role="button"
                                                    tabindex="0"
                                                >
                                                    <div class="flex justify-between items-start mb-1">
                                                        <h4 class="font-medium text-white text-sm truncate flex-1 pr-2">
                                                            {task.title}
                                                        </h4>
                                                        {#if task.priority}
                                                            <span class="text-xs px-2 py-1 rounded-full {
                                                                task.priority.toLowerCase() === 'high' ? 'bg-red-500/20 text-red-300' :
                                                                task.priority.toLowerCase() === 'medium' ? 'bg-amber-500/20 text-amber-300' :
                                                                'bg-indigo-500/20 text-indigo-300'
                                                            }">
                                                                {task.priority}
                                                            </span>
                                                        {/if}
                                                    </div>
                                                    {#if task.dueDate}
                                                        <p class="text-xs text-white/60">
                                                            Due: {new Date(task.dueDate).toLocaleDateString()}
                                                        </p>
                                                    {/if}
                                                </div>
                                            {/each}
                                        </div>
                                    {/if}
                                </div>
                            {/if}

                                <!-- Badges Section -->
                                {#if hasBadges}
                                <div class="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20 overflow-hidden"
                                    in:fly="{{ x: 100, duration: 600, delay: 400, easing: elasticOut }}">

                                    <h3 class="text-xl font-semibold text-white mb-4 flex items-center">
                                        <svg class="w-6 h-6 mr-3 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.857 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.857 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.857.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.857-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.857 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.857 3.42 3.42 0 013.138-3.138z" />
                                        </svg>
                                        Active Badges
                                    </h3>
                            
                                    {#if isLoadingBadges}
                                        <div class="flex items-center py-4">
                                            <div class="animate-spin rounded-full h-5 w-5 border-b-2 border-white/50 mr-3"></div>
                                            <span class="text-white/60 text-sm">Loading badges...</span>
                                        </div>
                                    {:else}
                                        <div class="space-y-3 max-h-40 overflow-y-auto overflow-x-hidden pr-2 custom-scrollbar min-h-0 flex flex-col">
                                            {#each badges as badge}
                                                <div 
                                                    class="bg-white/5 rounded-lg p-3 border border-white/10 cursor-pointer hover:bg-white/10 transition-colors"
                                                    on:click={() => handleBadgeClick(badge)}
                                                    on:keydown={(e) => e.key === 'Enter' && handleBadgeClick(badge)}
                                                    role="button"
                                                    tabindex="0"
                                                >
                                                    <div class="flex justify-between items-start mb-1">
                                                        <h4 class="font-medium text-white text-sm truncate flex-1 pr-2">
                                                            {badge.title}
                                                        </h4>
                                                        {#if badge.recipients && badge.recipients.length > 0}
                                                            <span class="text-xs text-yellow-300 whitespace-nowrap">
                                                                {badge.recipients.length} recipients
                                                            </span>
                                                        {/if}
                                                    </div>
                                                    {#if badge.description}
                                                        <p class="text-xs text-white/60 truncate">
                                                            {badge.description}
                                                        </p>
                                                    {/if}
                                                </div>
                                            {/each}
                                        </div>
                                    {/if}
                                </div>
                            {/if}
                            </div>
                        </div>
                    {/if}
                </div>

                <!-- Bottom Right: ESC hint -->
                <div class="absolute bottom-6 right-6">
                    <p class="text-white/40 text-sm flex items-center">
                        Press <kbd class="mx-2 px-2 py-1 bg-white/10 rounded text-xs border border-white/20">Esc</kbd> to close
                    </p>
                </div>
            </div>
        </div>
    </div>
{/if}

<!-- Role Modal -->
{#if showRoleModal && selectedItem && holonID}
    <RoleModal 
        role={selectedItem}
        roleId={selectedItem.id}
        userStore={users}
        holosphere={holosphere}
        holonId={holonID}
        on:close={() => closeAllModals()}
        on:deleted={() => closeAllModals()}
    />
{/if}

<!-- Task Modal -->
{#if showTaskModal && selectedItem && holonID}
    <TaskModal 
        quest={selectedItem}
        questId={selectedItem.id}
        holonId={holonID}
        on:close={() => closeAllModals()}
    />
{/if}

<!-- Event Modal (using ItemModal) -->
{#if showEventModal && selectedItem && holonID}
    <ItemModal 
        quest={selectedItem}
        questId={selectedItem.id}
        holonId={holonID}
        on:close={() => closeAllModals()}
    />
{/if}

<style>
    kbd {
        box-shadow: inset 0 -1px 0 rgba(255, 255, 255, 0.1);
    }


    
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
    
    /* Firefox scrollbar */
    .custom-scrollbar {
        scrollbar-width: thin;
        scrollbar-color: rgba(255, 255, 255, 0.3) rgba(255, 255, 255, 0.1);
    }











</style>
