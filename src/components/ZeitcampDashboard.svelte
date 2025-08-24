<script lang="ts">
    import { onMount, onDestroy, getContext } from "svelte";
import { fade, slide, scale, fly } from "svelte/transition";
import { elasticOut, bounceOut } from "svelte/easing";
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
    let todaysEvents: Array<{
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

    // Pagination state
    let rolesToShow = 8;
    let eventsToShow = 8;
    let tasksToShow = 8;
    let badgesToShow = 8;

    // Modal states
    let showRoleModal = false;
    let showTaskModal = false;
    let showEventModal = false;
    let showBadgeModal = false;
    let selectedItem: any = null;

    // Game-like animations and effects
    let particles: Array<{id: number, x: number, y: number, vx: number, vy: number, size: number, opacity: number}> = [];
    let animationFrame: number;
    let scoreMultiplier = 1;
    let experiencePoints = 0;
    let levelProgress = 0;
    let achievements: string[] = [];
    let pulseAnimation = false;
    let celebrationMode = false;

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

    // Load roles data
    async function loadRoles() {
        if (!holosphere || !holonID) return;
        
        isLoadingRoles = true;
        try {
            const rolesData = await holosphere.getAll(holonID, "roles");
            let rolesArray: any[] = [];
            
            if (Array.isArray(rolesData)) {
                rolesArray = rolesData;
            } else if (rolesData && typeof rolesData === 'object') {
                rolesArray = Object.values(rolesData);
            }
            
            // Process and normalize roles
            roles = rolesArray.map((role: any) => ({
                id: role.id || role.title || Math.random().toString(),
                title: role.title || 'Untitled Role',
                description: role.description,
                participants: role.participants || [],
                created_at: role.created_at,
                status: role.status || 'active'
            }));
            
        } catch (error) {
            console.error("ZeitcampDashboard: Error loading roles:", error);
        } finally {
            isLoadingRoles = false;
        }
    }

    // Load users data
    async function loadUsers() {
        if (!holosphere || !holonID) return;
        
        isLoadingUsers = true;
        try {
            const usersData = await holosphere.getAll(holonID, "users");
            
            if (Array.isArray(usersData)) {
                // Convert array to object with user ID as key
                users = usersData.reduce((acc: Record<string, any>, user: any) => {
                    if (user && user.id) {
                        acc[user.id] = user;
                    }
                    return acc;
                }, {});
            } else if (usersData && typeof usersData === 'object') {
                users = usersData;
            }
            
        } catch (error) {
            console.error("ZeitcampDashboard: Error loading users:", error);
        } finally {
            isLoadingUsers = false;
        }
    }

  
    // Load events data 
    async function loadEvents() {
        if (!holosphere || !holonID) return;
        
        isLoadingEvents = true;
        try {
            const eventsData = await holosphere.getAll(holonID, "quests");
            let events: any[] = [];
            
            if (Array.isArray(eventsData)) {
                events = eventsData;
            } else if (eventsData && typeof eventsData === 'object') {
                events = Object.values(eventsData);
            }
            
            // Filter for today's scheduled events (upcoming only)
            const today = new Date();
            const todayStr = today.toISOString().split('T')[0];
            const nowMs = Date.now();
            
            todaysEvents = events.filter((event: any) => {
                if (!event.when || event.status === 'completed' || event.status === 'cancelled') return false;
                const whenDate = new Date(event.when);
                const isToday = whenDate.toISOString().split('T')[0] === todayStr;
                return isToday;
            }).map((event: any) => {
                const whenDate = new Date(event.when);
                return {
                    id: event.id || Math.random().toString(),
                    title: event.title || event.name || 'Untitled Event',
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
                    type: 'event',
                    icon: '📅',
                    participants: event.participants || [],
                    priority: event.priority,
                    status: event.status
                };
            }).sort((a, b) => a.sortTime - b.sortTime);
            

            
        } catch (error) {
            console.error("ZeitcampDashboard: Error loading events:", error);
        } finally {
            isLoadingEvents = false;
        }
    }


    // Load tasks data 
    async function loadTasks() {
        if (!holosphere || !holonID) return;
        
        isLoadingTasks = true;
        try {
            const tasksData = await holosphere.getAll(holonID, "quests");
            let tasks: any[] = [];
            
            if (Array.isArray(tasksData)) {
                tasks = tasksData;
            } else if (tasksData && typeof tasksData === 'object') {
                tasks = Object.values(tasksData);
            }
            
            // Filter active tasks
            topTasks = tasks.filter((task: any) => 
                task.status !== 'completed' && task.status !== 'cancelled'
            ).map((task: any) => ({
                id: task.id || Math.random().toString(),
                title: task.title || task.name || 'Untitled Task',
                priority: task.priority,
                dueDate: task.dueDate,
                status: task.status || 'pending',
                participants: task.participants || []
            }));
            
        } catch (error) {
            console.error("ZeitcampDashboard: Error loading tasks:", error);
        } finally {
            isLoadingTasks = false;
        }
    }

    // Load holon name
    async function loadHolonName() {
        if (!holosphere || !holonID) return;
        
        isLoadingHolonName = true;
        try {
            holonName = await fetchHolonName(holosphere, holonID);
        } catch (error) {
            console.error("ZeitcampDashboard: Error loading holon name:", error);
            holonName = `Holon ${holonID}`;
        } finally {
            isLoadingHolonName = false;
        }
    }

    // Load badges data
    async function loadBadges() {
        if (!holosphere || !holonID) return;
        
        isLoadingBadges = true;
        try {
            const badgesData = await holosphere.getAll(holonID, "badges");
            let badgesArray: any[] = [];
            
            if (Array.isArray(badgesData)) {
                badgesArray = badgesData;
            } else if (badgesData && typeof badgesData === 'object') {
                badgesArray = Object.values(badgesData);
            }
            
            badges = badgesArray.map((badge: any) => ({
                id: badge.id || Math.random().toString(),
                title: badge.title || badge.name || 'Untitled Badge',
                description: badge.description || badge.details,
                recipients: badge.recipients || badge.owners || []
            }));
            
        } catch (error) {
            console.error("ZeitcampDashboard: Error loading badges:", error);
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
        gainExperience(10);
        if (event) {
            createParticle(event.clientX, event.clientY);
        }
    }

    function handleTaskClick(task: any, event?: MouseEvent) {
        selectedItem = task;
        showTaskModal = true;
        gainExperience(15);
        if (event) {
            createParticle(event.clientX, event.clientY);
        }
    }

    function handleEventClick(eventItem: any, event?: MouseEvent) {
        selectedItem = eventItem;
        showEventModal = true;
        gainExperience(12);
        if (event) {
            createParticle(event.clientX, event.clientY);
        }
    }

    function handleBadgeClick(badge: any, event?: MouseEvent) {
        selectedItem = badge;
        showBadgeModal = true;
        gainExperience(20);
        if (event) {
            createParticle(event.clientX, event.clientY);
        }
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

    // Get role statistics
    $: totalRoles = roles.length;
    $: assignedRoles = roles.filter(role => role.participants && role.participants.length > 0).length;
    $: unassignedRoles = totalRoles - assignedRoles;
    $: totalParticipants = roles.reduce((sum, role) => sum + (role.participants?.length || 0), 0);

    // Game mechanics functions
    function createParticle(x: number, y: number) {
        const particle = {
            id: Math.random(),
            x: x,
            y: y,
            vx: (Math.random() - 0.5) * 4,
            vy: (Math.random() - 0.5) * 4,
            size: Math.random() * 6 + 2,
            opacity: 1
        };
        particles = [...particles, particle];
        
        setTimeout(() => {
            particles = particles.filter(p => p.id !== particle.id);
        }, 2000);
    }

    function triggerCelebration() {
        celebrationMode = true;
        pulseAnimation = true;
        
        // Create multiple particles
        for (let i = 0; i < 20; i++) {
            setTimeout(() => {
                createParticle(
                    Math.random() * window.innerWidth,
                    Math.random() * window.innerHeight
                );
            }, i * 50);
        }
        
        setTimeout(() => {
            celebrationMode = false;
            pulseAnimation = false;
        }, 3000);
    }

    function gainExperience(amount: number) {
        experiencePoints += amount;
        levelProgress = (experiencePoints % 100) / 100;
        
        if (experiencePoints % 100 === 0) {
            triggerCelebration();
            achievements.push(`Level ${Math.floor(experiencePoints / 100)} Reached!`);
        }
    }

    function animateParticles() {
        particles = particles.map(particle => ({
            ...particle,
            x: particle.x + particle.vx,
            y: particle.y + particle.vy,
            opacity: particle.opacity - 0.01
        })).filter(particle => particle.opacity > 0);
        
        animationFrame = requestAnimationFrame(animateParticles);
    }

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

    // Watch for holon ID changes
    $: if (holonID && isVisible) {
        loadHolonName();
        loadRoles();
        loadUsers();
        loadEvents();
        loadTasks();
        loadBadges();
    }

    onMount(() => {
        // Update time every second
        timeInterval = setInterval(() => {
            currentTime = new Date();
        }, 1000);

        // Load initial data if visible
        if (isVisible) {
            if (holonID) {
                loadHolonName();
                loadRoles();
                loadUsers();
                loadEvents();
                loadTasks();
                loadBadges();
            }
        }

        // Start particle animation
        animateParticles();

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
        if (timeInterval) {
            clearInterval(timeInterval);
        }
        if (inactivityTimer) {
            clearTimeout(inactivityTimer);
        }
        if (animationFrame) {
            cancelAnimationFrame(animationFrame);
        }
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
        class="fixed inset-0 z-50 bg-gradient-to-br from-gray-800 via-gray-700 to-indigo-900 flex items-center justify-center p-4 overflow-hidden {celebrationMode ? 'bg-gradient-to-br from-purple-800 via-pink-700 to-yellow-900' : ''}"
        on:click|self={() => isVisible = false}
        on:keydown={handleKeydown}
        transition:fade={{ duration: 300 }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="zeitcamp-title"
        tabindex="0"
    >
        <!-- Animated Background Particles -->
        {#each particles as particle (particle.id)}
            <div 
                class="absolute rounded-full bg-gradient-to-r from-blue-400 to-purple-500 pointer-events-none animate-pulse"
                style="left: {particle.x}px; top: {particle.y}px; width: {particle.size}px; height: {particle.size}px; opacity: {particle.opacity};"
                in:scale="{{ duration: 500, easing: bounceOut }}"
                out:fade="{{ duration: 1000 }}"
            ></div>
        {/each}

        <!-- Floating Achievement Notifications -->
        {#if achievements.length > 0}
            {#each achievements.slice(-3) as achievement, index (achievement)}
                <div 
                    class="absolute top-20 right-20 bg-gradient-to-r from-yellow-400 to-orange-500 text-black px-4 py-2 rounded-lg font-bold text-sm shadow-lg z-60"
                    style="transform: translateY({index * 60}px);"
                    in:fly="{{ x: 100, duration: 500, easing: bounceOut }}"
                    out:fly="{{ x: 100, duration: 300 }}"
                >
                    🏆 {achievement}
                </div>
            {/each}
        {/if}
        <div 
            class="w-full max-w-6xl h-full max-h-[95vh] bg-black/30 backdrop-blur-lg rounded-3xl border border-white/10 shadow-2xl overflow-hidden relative z-40"
            transition:slide={{ duration: 400, axis: 'y' }}
        >
            <!-- Clock, XP Bar and Close Button -->
            <div class="absolute top-6 right-6 z-50 flex items-center space-x-4">
                <!-- XP Progress Bar -->
                <div class="text-center">
                    <div class="text-xs text-white/60 mb-1">Level {Math.floor(experiencePoints / 100)}</div>
                    <div class="w-24 h-2 bg-white/20 rounded-full overflow-hidden">
                        <div 
                            class="h-full bg-gradient-to-r from-blue-400 to-purple-500 transition-all duration-500 ease-out {pulseAnimation ? 'animate-pulse' : ''}"
                            style="width: {levelProgress * 100}%"
                        ></div>
                    </div>
                    <div class="text-xs text-white/40 mt-1">{experiencePoints % 100}/100 XP</div>
                </div>

                <!-- Clock -->
                <div class="text-right text-white/70">
                    <div class="text-3xl font-light {pulseAnimation ? 'animate-pulse text-yellow-300' : ''}">
                        {formatTime(currentTime)}
                    </div>
                </div>
                
                <!-- Close Button -->
                <button 
                    class="text-white/60 hover:text-white transition-all duration-300 p-2 rounded-lg hover:bg-white/10 hover:scale-110 hover:rotate-90 transform"
                    on:click={() => isVisible = false}
                    aria-label="Close zeitcamp dashboard"
                >
                    <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
                </button>
            </div>

            <!-- Main Dashboard Content -->
            <div class="h-full flex flex-col overflow-hidden">
                <!-- Top Section: Date and Holons Logo -->
                <div class="flex justify-between items-start mb-4 p-6 pb-2 flex-shrink-0">
                    <!-- Date Section -->
                    <div class="text-left">
                        <div class="text-2xl font-light text-white/70 mb-1">
                            {formatDay(currentTime)}
                        </div>
                        <div class="text-sm text-white/50 font-light">
                            {formatDateShort(currentTime)}
                        </div>
                    </div>

                    <!-- Holons Logo and Name - Centered -->
                    <div class="absolute left-1/2 transform -translate-x-1/2 text-center">
                        <div class="w-12 h-12 sm:w-50 sm:h-50 mx-auto mb-0 transform transition-all duration-500 hover:scale-110 hover:rotate-12 {celebrationMode ? 'animate-bounce' : ''}">
                            <MyHolonsIcon />
                        </div>
                        {#if isLoadingHolonName}
                            <div class="text-white/60 text-sm animate-pulse">Loading...</div>
                        {:else if holonName}
                            <div class="text-white/80 text-lg font-medium truncate max-w-48 {celebrationMode ? 'animate-pulse text-yellow-300' : ''}">
                                {holonName}
                            </div>
                        {:else}
                            <div class="text-white/40 text-sm">Unknown Holon</div>
                        {/if}
                    </div>
                </div>

                <!-- Center Section: Four Main Sections -->
                <div class="flex-1 overflow-y-auto custom-scrollbar px-6 pb-12">
                    <!-- Four Main Sections Grid -->
                    <div class="w-full max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-4 min-h-full">
                        <!-- Ruoli (Roles) Section -->
                        <div class="bg-white/15 backdrop-blur-md rounded-3xl p-6 border-2 border-white/25 flex flex-col shadow-2xl hover:border-indigo-400/50 hover:shadow-indigo-500/20 hover:shadow-2xl hover:scale-[1.02] transition-all duration-500 min-h-[280px] group"
                            in:fly="{{ x: -100, duration: 600, delay: 100, easing: elasticOut }}">
                            <div class="flex justify-between items-center mb-4 flex-shrink-0">
                                <h3 class="text-2xl font-bold text-white flex items-center">
                                    <svg class="w-8 h-8 mr-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                    </svg>
                                    Ruoli
                                </h3>
                                <button 
                                    class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-all duration-300 text-sm font-medium shadow-lg hover:shadow-xl hover:scale-105 hover:-translate-y-0.5 transform group-hover:animate-pulse"
                                    on:click={navigateToRoles}
                                >
                                    View All
                                </button>
                            </div>
                            
                            {#if isLoadingRoles}
                                <div class="flex items-center justify-center py-8">
                                    <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-white/50 mr-2"></div>
                                    <span class="text-white/60 text-sm">Loading...</span>
                                </div>
                            {:else if roles.length > 0}
                                <div class="space-y-2 flex-1 overflow-y-auto custom-scrollbar max-h-48">
                                    {#each roles.slice(0, rolesToShow) as role (role.id)}
                                        <div 
                                            class="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10 hover:bg-indigo-500/20 hover:border-indigo-400/50 cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:shadow-lg transform"
                                            on:click={(e) => handleRoleClick(role, e)}
                                            on:keydown={(e) => e.key === 'Enter' && handleRoleClick(role)}
                                            role="button"
                                            tabindex="0"
                                            aria-label="View role details for {role.title}"
                                            in:scale="{{ duration: 300, delay: 50 * roles.indexOf(role), easing: bounceOut }}"
                                        >
                                            <div class="flex-1 min-w-0">
                                                <h4 class="font-medium text-white text-sm truncate">
                                                    {role.title}
                                                </h4>
                                            </div>
                                            <div class="flex items-center space-x-2 ml-3">
                                                {#if role.participants && role.participants.length > 0}
                                                    <div class="flex -space-x-1">
                                                        {#each role.participants.slice(0, 3) as participant}
                                                            <div class="w-6 h-6 rounded-full bg-indigo-500/20 border border-white/20 flex items-center justify-center text-white text-xs font-medium overflow-hidden" title={getUserDisplayName(participant.id)}>
                                                                <img 
                                                                    src={`https://telegram.holons.io/getavatar?user_id=${participant.id}`}
                                                                    alt={getUserDisplayName(participant.id)}
                                                                    class="w-full h-full object-cover rounded-full"
                                                                    on:error={(e) => {
                                                                        e.currentTarget.style.display = 'none';
                                                                        e.currentTarget.nextElementSibling.style.display = 'flex';
                                                                    }}
                                                                />
                                                                <div class="w-full h-full bg-indigo-500/20 flex items-center justify-center text-white text-xs font-medium rounded-full" style="display: none;">
                                                                    {getUserDisplayName(participant.id).charAt(0).toUpperCase()}
                                                                </div>
                                                            </div>
                                                        {/each}
                                                        {#if role.participants.length > 3}
                                                            <div class="w-6 h-6 rounded-full bg-white/20 border border-white/20 flex items-center justify-center text-white text-xs font-medium">
                                                                +{role.participants.length - 3}
                                                            </div>
                                                        {/if}
                                                    </div>
                                                    <!-- Show first names below the avatars -->
                                                    <div class="text-xs text-white/70 ml-2">
                                                        {role.participants.slice(0, 2).map(p => users[p.id]?.first_name || getUserDisplayName(p.id).split(' ')[0]).join(', ')}
                                                        {#if role.participants.length > 2}
                                                            <span class="text-white/50"> +{role.participants.length - 2} more</span>
                                                        {/if}
                                                    </div>
                                                {:else}
                                                    <span class="text-white/40 text-xs">Unassigned</span>
                                                {/if}
                                            </div>
                                        </div>
                                    {/each}
                                    {#if roles.length > 8}
                                        <div class="text-center py-2">
                                            {#if rolesToShow < roles.length}
                                                <button 
                                                    class="text-indigo-400 hover:text-indigo-300 text-xs font-medium hover:underline transition-colors"
                                                    on:click={() => rolesToShow = Math.min(rolesToShow + 8, roles.length)}
                                                >
                                                    Load More (+{Math.min(8, roles.length - rolesToShow)})
                                                </button>
                                            {:else}
                                                <span class="text-white/40 text-xs">All {roles.length} roles shown</span>
                                            {/if}
                                        </div>
                                    {/if}
                                </div>
                            {:else}
                                <div class="text-center py-8 flex-1 flex items-center justify-center">
                                    <span class="text-white/50 text-sm">No roles defined</span>
                                </div>
                            {/if}
                        </div>

                        <!-- Eventi (Events) Section -->
                        <div class="bg-white/15 backdrop-blur-md rounded-3xl p-6 border-2 border-white/25 flex flex-col shadow-2xl hover:border-green-400/50 hover:shadow-green-500/20 hover:shadow-2xl hover:scale-[1.02] transition-all duration-500 min-h-[280px] group"
                            in:fly="{{ x: 100, duration: 600, delay: 200, easing: elasticOut }}">
                            <div class="flex justify-between items-center mb-4 flex-shrink-0">
                                <h3 class="text-2xl font-bold text-white flex items-center">
                                    <svg class="w-8 h-8 mr-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    Eventi
                                </h3>
                                <button 
                                    class="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-sm font-medium shadow-lg hover:shadow-xl"
                                    on:click={() => {
                                        if (holonID) {
                                            goto(`/${holonID}/calendar`);
                                            isVisible = false;
                                        }
                                    }}
                                >
                                    View All
                                </button>
                            </div>
                            
                            {#if isLoadingEvents}
                                <div class="flex items-center justify-center py-8">
                                    <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-white/50 mr-2"></div>
                                    <span class="text-white/60 text-sm">Loading...</span>
                                </div>
                            {:else if todaysEvents.length > 0}
                                <div class="space-y-2 flex-1 overflow-y-auto custom-scrollbar max-h-48">
                                    {#each todaysEvents.slice(0, eventsToShow) as event}
                                        <div 
                                            class="flex items-center p-2 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 cursor-pointer transition-colors"
                                            on:click={() => handleEventClick(event)}
                                            on:keydown={(e) => e.key === 'Enter' && handleEventClick(event)}
                                            role="button"
                                            tabindex="0"
                                            aria-label="View event details for {event.title}"
                                        >
                                            <!-- Time -->
                                            <div class="flex-shrink-0 w-16 text-center mr-3">
                                                <div class="text-xs font-medium text-green-400">
                                                    {event.time}
                                                </div>
                                            </div>
                                            
                                            <!-- Event info -->
                                            <div class="flex-1 min-w-0">
                                                <h4 class="font-medium text-white text-sm truncate mb-1">
                                                    {event.title}
                                                </h4>
                                                
                                                <!-- Participants -->
                                                {#if event.participants && event.participants.length > 0}
                                                    <div class="flex items-center">
                                                        <div class="flex -space-x-1 mr-2">
                                                            {#each event.participants.slice(0, 3) as participant}
                                                                <div class="w-4 h-4 rounded-full bg-green-500/20 border border-white/20 flex items-center justify-center text-white text-xs font-medium overflow-hidden" title={getUserDisplayName(participant.id)}>
                                                                    <img 
                                                                        src={`https://telegram.holons.io/getavatar?user_id=${participant.id}`}
                                                                        alt={getUserDisplayName(participant.id)}
                                                                        class="w-full h-full object-cover rounded-full"
                                                                        on:error={(e) => {
                                                                            e.currentTarget.style.display = 'none';
                                                                            e.currentTarget.nextElementSibling.style.display = 'flex';
                                                                        }}
                                                                    />
                                                                    <div class="w-full h-full bg-green-500/20 flex items-center justify-center text-white text-xs font-medium rounded-full" style="display: none;">
                                                                        {getUserDisplayName(participant.id).charAt(0).toUpperCase()}
                                                                    </div>
                                                                </div>
                                                            {/each}
                                                            {#if event.participants.length > 3}
                                                                <div class="w-4 h-4 rounded-full bg-white/20 border border-white/20 flex items-center justify-center text-white text-xs font-medium">
                                                                    +{event.participants.length - 3}
                                                                </div>
                                                            {/if}
                                                        </div>
                                                        <div class="text-xs text-white/60">
                                                            {event.participants.slice(0, 2).map(p => users[p.id]?.first_name || getUserDisplayName(p.id).split(' ')[0]).join(', ')}
                                                            {#if event.participants.length > 2}
                                                                <span class="text-white/40"> +{event.participants.length - 2} more</span>
                                                            {/if}
                                                        </div>
                                                    </div>
                                                {:else}
                                                    <div class="text-xs text-white/40">No participants</div>
                                                {/if}
                                            </div>
                                            
                                            <!-- Priority indicator -->
                                            {#if event.priority && event.priority !== 'normal'}
                                                <div class="ml-2 flex-shrink-0">
                                                    <span class="text-xs px-2 py-0.5 rounded-full {
                                                        event.priority === 'high' ? 'bg-red-500/20 text-red-300' :
                                                        event.priority === 'medium' ? 'bg-yellow-500/20 text-yellow-300' :
                                                        'bg-gray-500/20 text-gray-300'
                                                    }">
                                                        {event.priority}
                                                    </span>
                                                </div>
                                            {/if}
                                        </div>
                                    {/each}
                                    
                                    {#if todaysEvents.length === 0}
                                        <div class="text-center py-4">
                                            <div class="text-white/40 text-sm">No scheduled items for today</div>
                                        </div>
                                    {:else if todaysEvents.length > 8}
                                        <div class="text-center py-2">
                                            {#if eventsToShow < todaysEvents.length}
                                                <button 
                                                    class="text-green-400 hover:text-green-300 text-xs font-medium hover:underline transition-colors"
                                                    on:click={() => eventsToShow = Math.min(eventsToShow + 8, todaysEvents.length)}
                                                >
                                                    Load More (+{Math.min(8, todaysEvents.length - eventsToShow)})
                                                </button>
                                            {:else}
                                                <span class="text-white/40 text-xs">All {todaysEvents.length} events shown</span>
                                            {/if}
                                        </div>
                                    {/if}
                                </div>
                            {:else}
                                <div class="text-center py-8 flex-1 flex items-center justify-center">
                                    <span class="text-white/50 text-sm">No scheduled items today</span>
                                </div>
                            {/if}
                        </div>

                        <!-- Compiti (Tasks) Section -->
                        <div class="bg-white/15 backdrop-blur-md rounded-3xl p-6 border-2 border-white/25 flex flex-col shadow-2xl hover:border-amber-400/50 hover:shadow-amber-500/20 hover:shadow-2xl hover:scale-[1.02] transition-all duration-500 min-h-[280px] group"
                            in:fly="{{ x: -100, duration: 600, delay: 300, easing: elasticOut }}">
                            <div class="flex justify-between items-center mb-4 flex-shrink-0">
                                <h3 class="text-2xl font-bold text-white flex items-center">
                                    <svg class="w-8 h-8 mr-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                                    </svg>
                                    Compiti
                                </h3>
                                <button 
                                    class="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors text-sm font-medium shadow-lg hover:shadow-xl"
                                    on:click={() => {
                                        if (holonID) {
                                            goto(`/${holonID}/tasks`);
                                            isVisible = false;
                                        }
                                    }}
                                >
                                    View All
                                </button>
                            </div>
                            
                            {#if isLoadingTasks}
                                <div class="flex items-center justify-center py-8">
                                    <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-white/50 mr-2"></div>
                                    <span class="text-white/60 text-sm">Loading...</span>
                                </div>
                            {:else if topTasks.length > 0}
                                <div class="space-y-2 flex-1 overflow-y-auto custom-scrollbar max-h-48">
                                    {#each topTasks.slice(0, tasksToShow) as task}
                                        <div 
                                            class="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 cursor-pointer transition-colors"
                                            on:click={() => handleTaskClick(task)}
                                            on:keydown={(e) => e.key === 'Enter' && handleTaskClick(task)}
                                            role="button"
                                            tabindex="0"
                                            aria-label="View task details for {task.title}"
                                        >
                                            <div class="flex-1 min-w-0">
                                                <h4 class="font-medium text-white text-sm truncate">
                                                    {task.title}
                                                </h4>
                                                {#if task.dueDate}
                                                    <p class="text-white/60 text-xs">Due: {new Date(task.dueDate).toLocaleDateString()}</p>
                                                {/if}
                                            </div>
                                            <div class="flex items-center space-x-2 ml-3">
                                                {#if task.participants && task.participants.length > 0}
                                                    <div class="flex -space-x-1">
                                                        {#each task.participants.slice(0, 3) as participant}
                                                            <div class="w-6 h-6 rounded-full bg-amber-500/20 border border-white/20 flex items-center justify-center text-white text-xs font-medium overflow-hidden" title={getUserDisplayName(participant.id)}>
                                                                <img 
                                                                    src={`https://telegram.holons.io/getavatar?user_id=${participant.id}`}
                                                                    alt={getUserDisplayName(participant.id)}
                                                                    class="w-full h-full object-cover rounded-full"
                                                                    on:error={(e) => {
                                                                        e.currentTarget.style.display = 'none';
                                                                        e.currentTarget.nextElementSibling.style.display = 'flex';
                                                                    }}
                                                                />
                                                                <div class="w-full h-full bg-amber-500/20 flex items-center justify-center text-white text-xs font-medium rounded-full" style="display: none;">
                                                                    {getUserDisplayName(participant.id).charAt(0).toUpperCase()}
                                                                </div>
                                                            </div>
                                                        {/each}
                                                        {#if task.participants.length > 3}
                                                            <div class="w-6 h-6 rounded-full bg-white/20 border border-white/20 flex items-center justify-center text-white text-xs font-medium">
                                                                +{task.participants.length - 3}
                                                            </div>
                                                        {/if}
                                                    </div>
                                                    <!-- Show first names below the avatars -->
                                                    <div class="text-xs text-white/70 ml-2">
                                                        {task.participants.slice(0, 2).map(p => users[p.id]?.first_name || getUserDisplayName(p.id).split(' ')[0]).join(', ')}
                                                        {#if task.participants.length > 2}
                                                            <span class="text-white/50"> +{task.participants.length - 2} more</span>
                                                        {/if}
                                                    </div>
                                                {:else}
                                                    <span class="text-white/40 text-xs">Unassigned</span>
                                                {/if}
                                            </div>
                                        </div>
                                    {/each}
                                    {#if topTasks.length > 8}
                                        <div class="text-center py-2">
                                            {#if tasksToShow < topTasks.length}
                                                <button 
                                                    class="text-amber-400 hover:text-amber-300 text-xs font-medium hover:underline transition-colors"
                                                    on:click={() => tasksToShow = Math.min(tasksToShow + 8, topTasks.length)}
                                                >
                                                    Load More (+{Math.min(8, topTasks.length - tasksToShow)})
                                                </button>
                                            {:else}
                                                <span class="text-white/40 text-xs">All {topTasks.length} tasks shown</span>
                                            {/if}
                                        </div>
                                    {/if}
                                </div>
                            {:else}
                                <div class="text-center py-8 flex-1 flex items-center justify-center">
                                    <span class="text-white/50 text-sm">No active tasks</span>
                                </div>
                            {/if}
                        </div>

                        <!-- Medaglie (Badges) Section -->
                        <div class="bg-white/15 backdrop-blur-md rounded-3xl p-6 border-2 border-white/25 flex flex-col shadow-2xl hover:border-yellow-400/50 hover:shadow-yellow-500/20 hover:shadow-2xl hover:scale-[1.02] transition-all duration-500 min-h-[280px] group"
                            in:fly="{{ x: 100, duration: 600, delay: 400, easing: elasticOut }}">
                            <div class="flex justify-between items-center mb-4 flex-shrink-0">
                                <h3 class="text-2xl font-bold text-white flex items-center">
                                    <svg class="w-8 h-8 mr-4 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.857 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.857 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.857.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.857-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.857 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.857 3.42 3.42 0 013.138-3.138z" />
                                    </svg>
                                    Medaglie
                                </h3>
                                <button 
                                    class="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg transition-colors text-sm font-medium shadow-lg hover:shadow-xl"
                                    on:click={() => {
                                        if (holonID) {
                                            goto(`/${holonID}/badges`);
                                            isVisible = false;
                                        }
                                    }}
                                >
                                    View All
                                </button>
                            </div>
                            
                            {#if isLoadingBadges}
                                <div class="flex items-center justify-center py-8">
                                    <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-white/50 mr-2"></div>
                                    <span class="text-white/60 text-sm">Loading...</span>
                                </div>
                            {:else if badges.length > 0}
                                <div class="space-y-2 flex-1 overflow-y-auto custom-scrollbar max-h-48">
                                    {#each badges.slice(0, badgesToShow) as badge}
                                        <div 
                                            class="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 cursor-pointer transition-colors"
                                            on:click={() => handleBadgeClick(badge)}
                                            on:keydown={(e) => e.key === 'Enter' && handleBadgeClick(badge)}
                                            role="button"
                                            tabindex="0"
                                            aria-label="View badge details for {badge.title}"
                                        >
                                            <div class="flex-1 min-w-0">
                                                <h4 class="font-medium text-white text-sm truncate">
                                                    {badge.title}
                                                </h4>
                                                {#if badge.description}
                                                    <p class="text-white/60 text-xs truncate">{badge.description}</p>
                                                {/if}
                                            </div>
                                            <div class="flex items-center space-x-2 ml-3">
                                                {#if badge.recipients && badge.recipients.length > 0}
                                                    <div class="flex -space-x-1">
                                                        {#each badge.recipients.slice(0, 3) as recipient}
                                                            <div class="w-6 h-6 rounded-full bg-yellow-500/20 border border-white/20 flex items-center justify-center text-white text-xs font-medium overflow-hidden" title={getUserDisplayName(recipient.id)}>
                                                                <img 
                                                                    src={`https://telegram.holons.io/getavatar?user_id=${recipient.id}`}
                                                                    alt={getUserDisplayName(recipient.id)}
                                                                    class="w-full h-full object-cover rounded-full"
                                                                    on:error={(e) => {
                                                                        e.currentTarget.style.display = 'none';
                                                                        e.currentTarget.nextElementSibling.style.display = 'flex';
                                                                    }}
                                                                />
                                                                <div class="w-full h-full bg-yellow-500/20 flex items-center justify-center text-white text-xs font-medium rounded-full" style="display: none;">
                                                                    {getUserDisplayName(recipient.id).charAt(0).toUpperCase()}
                                                                </div>
                                                            </div>
                                                        {/each}
                                                        {#if badge.recipients.length > 3}
                                                            <div class="w-6 h-6 rounded-full bg-white/20 border border-white/20 flex items-center justify-center text-white text-xs font-medium">
                                                                +{badge.recipients.length - 3}
                                                            </div>
                                                        {/if}
                                                    </div>
                                                    <!-- Show first names below the avatars -->
                                                    <div class="text-xs text-white/70 ml-2">
                                                        {badge.recipients.slice(0, 2).map(p => users[p.id]?.first_name || getUserDisplayName(p.id).split(' ')[0]).join(', ')}
                                                        {#if badge.recipients.length > 2}
                                                            <span class="text-white/50"> +{badge.recipients.length - 2} more</span>
                                                        {/if}
                                                    </div>
                                                {:else}
                                                    <span class="text-white/40 text-xs">No recipients</span>
                                                {/if}
                                            </div>
                                        </div>
                                    {/each}
                                    {#if badges.length > 8}
                                        <div class="text-center py-2">
                                            {#if badgesToShow < badges.length}
                                                <button 
                                                    class="text-yellow-400 hover:text-yellow-300 text-xs font-medium hover:underline transition-colors"
                                                    on:click={() => badgesToShow = Math.min(badgesToShow + 8, badges.length)}
                                                >
                                                    Load More (+{Math.min(8, badges.length - badgesToShow)})
                                                </button>
                                            {:else}
                                                <span class="text-white/40 text-xs">All {badges.length} badges shown</span>
                                            {/if}
                                        </div>
                                    {/if}
                                </div>
                            {:else}
                                <div class="text-center py-8 flex-1 flex items-center justify-center">
                                    <span class="text-white/50 text-sm">No badges available</span>
                                </div>
                            {/if}
                        </div>
                    </div>
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

{/if}

<style>
    kbd {
        box-shadow: inset 0 -1px 0 rgba(255, 255, 255, 0.1);
    }

    @keyframes gameGlow {
        0%, 100% { 
            box-shadow: 0 0 20px rgba(59, 130, 246, 0.5);
            transform: scale(1);
        }
        50% { 
            box-shadow: 0 0 40px rgba(147, 51, 234, 0.7);
            transform: scale(1.05);
        }
    }

    @keyframes floatUp {
        0% {
            opacity: 1;
            transform: translateY(0px);
        }
        100% {
            opacity: 0;
            transform: translateY(-100px);
        }
    }

    @keyframes sparkle {
        0%, 100% { opacity: 0; transform: scale(0) rotate(0deg); }
        50% { opacity: 1; transform: scale(1) rotate(180deg); }
    }

    .game-glow {
        animation: gameGlow 2s ease-in-out infinite;
    }

    .float-up {
        animation: floatUp 2s ease-out forwards;
    }

    .sparkle {
        animation: sparkle 1.5s ease-in-out infinite;
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
        background: linear-gradient(45deg, rgba(59, 130, 246, 0.5), rgba(147, 51, 234, 0.5));
        border-radius: 3px;
    }
    
    .custom-scrollbar::-webkit-scrollbar-thumb:hover {
        background: linear-gradient(45deg, rgba(59, 130, 246, 0.8), rgba(147, 51, 234, 0.8));
    }
    
    /* Firefox scrollbar */
    .custom-scrollbar {
        scrollbar-width: thin;
        scrollbar-color: rgba(59, 130, 246, 0.5) rgba(255, 255, 255, 0.1);
    }

    /* Game-like pulsing background */
    .game-background {
        background: linear-gradient(-45deg, #1a1a2e, #16213e, #0f3460, #533483);
        background-size: 400% 400%;
        animation: gradientShift 15s ease infinite;
    }

    @keyframes gradientShift {
        0% { background-position: 0% 50%; }
        50% { background-position: 100% 50%; }
        100% { background-position: 0% 50%; }
    }

    /* Interactive hover effects */
    .game-card:hover {
        filter: brightness(1.1) contrast(1.05);
    }

    /* XP gain animation */
    .xp-gain {
        animation: floatUp 1s ease-out forwards;
        pointer-events: none;
        position: absolute;
        z-index: 1000;
        color: #fbbf24;
        font-weight: bold;
        text-shadow: 0 0 10px rgba(251, 191, 36, 0.8);
    }

</style>
