<script lang="ts">
    import { createEventDispatcher, getContext, onMount } from 'svelte';
    import HoloSphere from 'holosphere';
    import { ID } from "../dashboard/store";
    import { formatDate, formatTime } from '../utils/date.js';
    import Timeline from './Timeline.svelte';

    const holosphere = getContext("holosphere") as HoloSphere;
    const dispatch = createEventDispatcher();

    // Calendar state
    let currentDate = new Date();
    let selectedDate: Date | null = null;
    let events: { [key: string]: any[] } = {};
    
    // View options: 'month', 'week', 'day'
    let viewMode: 'month' | 'week' | 'day' = 'month';
    
    // Get calendar data for current month
    $: monthData = getMonthData(currentDate);
    $: weekData = getWeekData(currentDate);

    let currentDayPercentage = 0;

    // Add these before the calendar state variables
    let users: Record<string, User> = {};
    let profiles: Record<string, Profile> = {};
    let unsubscribe: (() => void) | null = null;

    onMount(() => {
        loadProfiles();
        return () => {
            if (unsubscribe) unsubscribe();
        };
    });

    // Watch for month/year changes
    $: {
        const month = currentDate.getMonth();
        const year = currentDate.getFullYear();
        if (unsubscribe) {
            unsubscribe();
            users = {};
            profiles = {};
        }
        loadProfiles();
    }

    // Load profiles
    function loadProfiles() {
        if (!holosphere) return;
        
        try {
            // Subscribe to users
            unsubscribe = holosphere.subscribe($ID, "users", async (newUser, key) => {
                if (newUser) {
                    const userData = typeof newUser === 'string' ? JSON.parse(newUser) : newUser;
                    users[key] = userData;
                    users = users; // Trigger reactivity
                    
                    // Load profile for this user
                    try {
                        const profile = await holosphere.get(userData.id || key, 'profile', userData.id || key);
                        if (profile) {
                            profiles[key] = typeof profile === 'string' ? JSON.parse(profile) : profile;
                            profiles = profiles; // Trigger reactivity
                        }
                    } catch (error) {
                        console.error(`Error loading profile for user ${key}:`, error);
                    }
                } else {
                    delete users[key];
                    delete profiles[key];
                    users = users;
                    profiles = profiles;
                }
            });
        } catch (error) {
            console.error('Error loading users and profiles:', error);
            users = {};
            profiles = {};
        }
    }

    function getMonthData(date: Date) {
        const year = date.getFullYear();
        const month = date.getMonth();
        
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        
        const startOffset = firstDay.getDay();
        const daysInMonth = lastDay.getDate();
        
        // Get previous month's spillover days
        const prevMonthDays = [];
        const prevLastDay = new Date(year, month, 0).getDate();
        for (let i = startOffset - 1; i >= 0; i--) {
            prevMonthDays.push(new Date(year, month - 1, prevLastDay - i));
        }
        
        // Get current month's days
        const currentMonthDays = [];
        for (let i = 1; i <= daysInMonth; i++) {
            currentMonthDays.push(new Date(year, month, i));
        }
        
        // Get next month's spillover days
        const nextMonthDays = [];
        const remainingCells = 42 - (prevMonthDays.length + currentMonthDays.length);
        for (let i = 1; i <= remainingCells; i++) {
            nextMonthDays.push(new Date(year, month + 1, i));
        }
        
        return [...prevMonthDays, ...currentMonthDays, ...nextMonthDays];
    }

    function getWeekData(date: Date) {
        const week = [];
        const firstDayOfWeek = new Date(date);
        firstDayOfWeek.setDate(date.getDate() - date.getDay());
        
        for (let i = 0; i < 7; i++) {
            const day = new Date(firstDayOfWeek);
            day.setDate(firstDayOfWeek.getDate() + i);
            week.push(day);
        }
        
        return week;
    }

    function handleDateClick(date: Date) {
        currentDate = date;
        selectedDate = date;
        dispatch('dateSelect', { 
            date, 
            events: events[date.toDateString()] || [] 
        });
    }

    function navigateMonth(direction: 1 | -1) {
        currentDate = new Date(currentDate.setMonth(currentDate.getMonth() + direction));
    }

    function navigateWeek(direction: 1 | -1) {
        currentDate = new Date(currentDate.setDate(currentDate.getDate() + (direction * 7)));
    }

    function isToday(date: Date): boolean {
        const today = new Date();
        return date.toDateString() === today.toDateString();
    }

    function isSelected(date: Date): boolean {
        return selectedDate?.toDateString() === date.toDateString();
    }

    function isCurrentMonth(date: Date): boolean {
        return date.getMonth() === currentDate.getMonth();
    }

    function getDayEvents(date: Date) {
        return events[date.toDateString()] || [];
    }

    function handleTimelineDateSelect(event: CustomEvent<{date: Date, dayOfYear: number}>) {
        currentDate = event.detail.date;
        selectedDate = currentDate;
        currentDayPercentage = (event.detail.dayOfYear / 365) * 100;
        
        dispatch('dateSelect', { 
            date: currentDate, 
            events: events[currentDate.toDateString()] || [] 
        });
    }

    function getStaysForDay(date: Date) {
        const dateStr = date.toDateString();
        return Object.entries(profiles)
            .filter(([_, profile]) => {
                if (!profile.arrival || !profile.departure) return false;
                const arrivalDate = new Date(profile.arrival);
                const departureDate = new Date(profile.departure);
                const checkDate = new Date(dateStr);
                return checkDate >= arrivalDate && checkDate <= departureDate;
            })
            .map(([userId, profile]) => ({
                userId,
                profile,
                user: users[userId],
                isArrival: new Date(profile.arrival).toDateString() === dateStr,
                isDeparture: new Date(profile.departure).toDateString() === dateStr
            }));
    }

    // Add interface for Profile type
    interface Profile {
        arrival: string;
        departure: string;
        // ... other profile fields ...
    }

    // Add this helper function at the script level
    function getUserColor(userId: string): string {
        // Generate a hash from the userId
        let hash = 0;
        for (let i = 0; i < userId.length; i++) {
            hash = userId.charCodeAt(i) + ((hash << 5) - hash);
        }
        // Convert to HSL color with fixed saturation and lightness
        const hue = hash % 360;
        return `hsl(${hue}, 70%, 60%)`;
    }

    // Update getStayStyle to use the user color
    function getStayStyle(date: Date, profile: Profile, userId: string): string {
        const arrivalDate = new Date(profile.arrival);
        const departureDate = new Date(profile.departure);
        const checkDate = new Date(date.toDateString());
        
        let style = `bg-opacity-90 `;
        style += `style="background-color: ${getUserColor(userId)};" `;
        
        // First day of stay
        if (checkDate.getTime() === arrivalDate.setHours(0,0,0,0)) {
            style += "rounded-l ";
        }
        
        // Last day of stay
        if (checkDate.getTime() === departureDate.setHours(0,0,0,0)) {
            style += "rounded-r ";
        }
        
        // Middle days
        if (checkDate > arrivalDate && checkDate < departureDate) {
            style += "-mx-[1px] "; // Negative margin to connect bars
        }
        
        return style;
    }
</script>

<Timeline 
    currentDate={currentDate}
    {currentDayPercentage}
    {profiles}
    {users}
    on:dateSelect={handleTimelineDateSelect}
/>

<div class="bg-gray-800 rounded-3xl p-6">
    <div class="flex justify-between items-center mb-6">
        <div class="flex items-center gap-4">
            <div class="flex gap-2">
                <button 
                    class="p-2 rounded-lg bg-gray-700 text-white hover:bg-gray-600 transition-colors"
                    on:click={() => navigateMonth(-1)}
                >
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
                    </svg>
                </button>
                <button 
                    class="p-2 rounded-lg bg-gray-700 text-white hover:bg-gray-600 transition-colors"
                    on:click={() => navigateMonth(1)}
                >
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                    </svg>
                </button>
            </div>
            <h2 class="text-2xl font-bold text-white">
                {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
            </h2>
        </div>
        <div class="flex gap-2">
            <button 
                class="px-4 py-2 rounded-lg {viewMode === 'month' ? 'bg-gray-600' : 'bg-gray-700'} text-white hover:bg-gray-600 transition-colors"
                on:click={() => viewMode = 'month'}
            >
                Month
            </button>
            <button 
                class="px-4 py-2 rounded-lg {viewMode === 'week' ? 'bg-gray-600' : 'bg-gray-700'} text-white hover:bg-gray-600 transition-colors"
                on:click={() => viewMode = 'week'}
            >
                Week
            </button>
        </div>
    </div>

    {#if viewMode === 'month'}
        <div class="grid grid-cols-7 gap-px bg-gray-700">
            {#each ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as day}
                <div class="p-2 text-center text-gray-400 font-medium bg-gray-800">
                    {day}
                </div>
            {/each}
            
            {#each monthData as date}
                {@const dateEvents = getDayEvents(date)}
                {@const stays = getStaysForDay(date)}
                <button 
                    class="p-2 min-h-[100px] text-left bg-gray-800 relative group transition-colors hover:bg-gray-700"
                    class:opacity-50={!isCurrentMonth(date)}
                    class:ring-2={isSelected(date)}
                    class:ring-white={isSelected(date)}
                    on:click={() => handleDateClick(date)}
                >
                    <span 
                        class="inline-flex w-8 h-8 items-center justify-center rounded-full text-white
                        {isToday(date) ? 'bg-blue-500' : ''}"
                    >
                        {date.getDate()}
                    </span>
                    
                    <div class="mt-1 space-y-1">
                        {#each stays as stay}
                            <div 
                                class="text-xs p-1 truncate flex items-center gap-1 relative {getStayStyle(date, stay.profile, stay.userId)}"
                                class:mt-px={!stay.isArrival}
                                class:mb-px={!stay.isDeparture}
                                class:z-10={stay.isArrival || stay.isDeparture}
                                class:z-0={!stay.isArrival && !stay.isDeparture}
                                style="background-color: {getUserColor(stay.userId)};"
                            >
                                {#if stay.isArrival}
                                    <span>🛬</span>
                                {/if}
                                <span class="truncate">{stay.user.first_name}</span>
                                {#if stay.isDeparture}
                                    <span>🛫</span>
                                {/if}
                            </div>
                        {/each}
                        
                        {#each dateEvents.slice(0, 3) as event}
                            <div 
                                class="text-xs p-1 rounded bg-opacity-90 truncate"
                                style="background-color: {event.color || '#4B5563'}"
                            >
                                {event.title}
                            </div>
                        {/each}
                        {#if dateEvents.length > 3}
                            <div class="text-xs text-gray-400">
                                +{dateEvents.length - 3} more
                            </div>
                        {/if}
                    </div>
                </button>
            {/each}
        </div>
    {:else if viewMode === 'week'}
        <div class="grid grid-cols-7 gap-px bg-gray-700">
            {#each weekData as date}
                <div class="bg-gray-800">
                    <div class="p-2 text-center border-b border-gray-700">
                        <div class="text-gray-400 font-medium">
                            {date.toLocaleString('default', { weekday: 'short' })}
                        </div>
                        <div 
                            class="inline-flex w-8 h-8 items-center justify-center rounded-full text-white mt-1
                            {isToday(date) ? 'bg-blue-500' : ''}"
                        >
                            {date.getDate()}
                        </div>
                    </div>
                    
                    <div class="divide-y divide-gray-700">
                        {#each Array(24) as _, hour}
                            <div 
                                class="p-1 min-h-[48px] group hover:bg-gray-700 transition-colors"
                                on:click={() => {
                                    const eventDate = new Date(date);
                                    eventDate.setHours(hour);
                                    handleDateClick(eventDate);
                                }}
                            >
                                <div class="text-xs text-gray-500 group-hover:text-gray-400">
                                    {hour.toString().padStart(2, '0')}:00
                                </div>
                                
                                {#if hour === 12}
                                    {#each getStaysForDay(date) as stay}
                                        <div 
                                            class="text-xs p-1 truncate flex items-center gap-1 relative {getStayStyle(date, stay.profile, stay.userId)}"
                                            class:mt-px={!stay.isArrival}
                                            class:mb-px={!stay.isDeparture}
                                            class:z-10={stay.isArrival || stay.isDeparture}
                                            class:z-0={!stay.isArrival && !stay.isDeparture}
                                            style="background-color: {getUserColor(stay.userId)};"
                                        >
                                            {#if stay.isArrival}
                                                <span>🛬</span>
                                            {/if}
                                            <span class="truncate">{stay.user.first_name}</span>
                                            {#if stay.isDeparture}
                                                <span>🛫</span>
                                            {/if}
                                        </div>
                                    {/each}
                                {/if}
                                
                                {#each getDayEvents(date).filter(event => new Date(event.date).getHours() === hour) as event}
                                    <div 
                                        class="text-xs p-1 rounded bg-opacity-90 truncate mt-1"
                                        style="background-color: {event.color || '#4B5563'}"
                                    >
                                        {event.title}
                                    </div>
                                {/each}
                            </div>
                        {/each}
                    </div>
                </div>
            {/each}
        </div>
    {/if}
</div>

<style>
    button {
        transition: all 0.2s ease;
    }

    /* Add these new styles */
    .mt-px {
        margin-top: 1px;
    }
    
    .mb-px {
        margin-bottom: 1px;
    }
    
    /* Ensure the calendar grid has no gaps */
    :global(.grid.grid-cols-7) {
        gap: 1px;
        margin: -1px;
        padding: 1px;
    }
</style> 