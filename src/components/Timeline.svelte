<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { phase } from 'lune';

    const dispatch = createEventDispatcher();

    // Type definitions
    interface Profile {
        arrival: string;
        departure: string;
        origin?: string;
        purpose?: string;
    }

    interface User {
        id: string;
        first_name: string;
        last_name?: string;
        username?: string;
    }

    // Add the getUserColor function
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

    // Category color scheme (matching the orbital view)
    const categoryColors: Record<string, string> = {
        'work': '#6366F1',      // Indigo
        'personal': '#8B5CF6',  // Violet
        'health': '#A855F7',    // Purple
        'learning': '#7C3AED',  // Indigo
        'finance': '#5B21B6',   // Deep Indigo
        'social': '#4F46E5',    // Indigo
        'default': '#6366F1'    // Default Indigo
    };

    function getCategoryColor(category?: string): string {
        if (!category) return categoryColors.default;
        return categoryColors[category.toLowerCase()] || categoryColors.default;
    }

    // Props
    export let currentDate: Date;
    export let profiles: Record<string, Profile> = {};
    export let users: Record<string, User> = {};
    export let tasks: Record<string, any> = {}; // Scheduled events/quests
    
    // Get all stays for the current year
    $: yearStays = Object.entries(profiles)
        .filter(([_, profile]) => {
            if (!profile.arrival || !profile.departure) return false;
            const arrival = new Date(profile.arrival);
            const departure = new Date(profile.departure);
            const yearStart = new Date(currentDate.getFullYear(), 0, 1);
            const yearEnd = new Date(currentDate.getFullYear(), 11, 31);
            return arrival <= yearEnd && departure >= yearStart;
        })
        .map(([userId, profile]) => ({
            userId,
            profile,
            user: users[userId]
        }));

    // Get all scheduled events for the current year
    $: yearEvents = Object.entries(tasks)
        .filter(([_, task]) => {
            if (!task.when) return false;
            const eventDate = new Date(task.when);
            const year = currentDate.getFullYear();
            return eventDate.getFullYear() === year;
        })
        .map(([key, task]) => ({
            id: key,
            date: new Date(task.when),
            title: task.title || 'Untitled Event',
            description: task.description,
            location: task.location,
            category: task.category,
            participants: task.participants,
            ends: task.ends ? new Date(task.ends) : undefined
        }));

    // Group events by day to stack them
    $: eventsByDay = yearEvents.reduce((acc, event) => {
        const dateKey = event.date.toDateString();
        if (!acc[dateKey]) {
            acc[dateKey] = [];
        }
        acc[dateKey].push(event);
        return acc;
    }, {} as Record<string, typeof yearEvents>);

    // Timeline state
    let timelineContainer: HTMLElement;
    let timelineWidth = 2000; // Width for the year
    
    function handleTimelineClick(event: MouseEvent) {
        const rect = timelineContainer.getBoundingClientRect();
        const x = event.clientX - rect.left;
        
        // Calculate position within the year (0 to 1)
        const positionInYear = x / rect.width;
        
        // Calculate the exact date
        const yearStart = new Date(currentDate.getFullYear(), 0, 1);
        const yearEnd = new Date(currentDate.getFullYear() + 1, 0, 1);
        const timestamp = yearStart.getTime() + (yearEnd.getTime() - yearStart.getTime()) * positionInYear;
        const newDate = new Date(timestamp);
        
        // Calculate day of year
        const startOfYear = new Date(newDate.getFullYear(), 0, 1);
        const dayOfYear = Math.floor((newDate.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
        
        dispatch('dateSelect', { 
            date: newDate,
            dayOfYear 
        });
    }

    function changeYear(offset: number) {
        const newDate = new Date(currentDate);
        newDate.setFullYear(currentDate.getFullYear() + offset);
        dispatch('dateSelect', { date: newDate });
    }

    function formatDateDisplay(date: Date): string {
        return date.toLocaleDateString(undefined, { 
            weekday: 'short', 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric' 
        });
    }

    function getMoonPhaseIcon(phaseValue: number) {
        if (phaseValue < 0.125) return '🌑';
        if (phaseValue < 0.25) return '🌒';
        if (phaseValue < 0.375) return '🌓';
        if (phaseValue < 0.5) return '🌔';
        if (phaseValue < 0.625) return '🌕';
        if (phaseValue < 0.75) return '🌖';
        if (phaseValue < 0.875) return '🌗';
        return '🌘';
    }

    // Calculate marker position as percentage of year
    $: markerPosition = ((currentDate.getTime() - new Date(currentDate.getFullYear(), 0, 1).getTime()) / 
        (new Date(currentDate.getFullYear() + 1, 0, 1).getTime() - new Date(currentDate.getFullYear(), 0, 1).getTime())) * 100;

    function getSolarEvents(year: number) {
        return {
            springEquinox: new Date(year, 2, 20),
            summerSolstice: new Date(year, 5, 21),
            autumnEquinox: new Date(year, 8, 22),
            winterSolstice: new Date(year, 11, 21)
        };
    }

    function getMoonPhases(year: number) {
        const phases: Array<{date: Date, isNew: boolean}> = [];
        const startDate = new Date(year, 0, 1);
        const endDate = new Date(year + 1, 0, 1);
        
        let currentDate = new Date(startDate);
        
        while (currentDate < endDate) {
            const phaseInfo = phase(currentDate);
            
            if (phaseInfo.phase < 0.025 || (phaseInfo.phase > 0.475 && phaseInfo.phase < 0.525)) {
                const isDuplicate = phases.some(p => 
                    Math.abs(p.date.getTime() - currentDate.getTime()) < 10 * 24 * 60 * 60 * 1000
                );
                
                if (!isDuplicate) {
                    phases.push({
                        date: new Date(currentDate),
                        isNew: phaseInfo.phase < 0.025
                    });
                }
            }
            
            currentDate = new Date(currentDate.getTime() + 6 * 60 * 60 * 1000);
        }
        
        return phases;
    }

    // Calculate phases for current year
    $: moonPhases = getMoonPhases(currentDate.getFullYear());
    $: solarEvents = getSolarEvents(currentDate.getFullYear());

    // Helper function to calculate position as percentage of year
    function getPositionInYear(date: Date): number {
        const yearStart = new Date(date.getFullYear(), 0, 1);
        const yearEnd = new Date(date.getFullYear() + 1, 0, 1);
        return ((date.getTime() - yearStart.getTime()) / (yearEnd.getTime() - yearStart.getTime())) * 100;
    }
</script>

<div class="bg-gray-800 rounded-3xl p-6 mb-6">
    <div class="flex justify-between items-center mb-4">
        <button 
            class="p-2 rounded-lg bg-gray-700 text-white hover:bg-gray-600 transition-colors"
            on:click={() => changeYear(-1)}
            aria-label="Previous year"
        >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
        </button>
        
        <h3 class="text-lg font-medium text-white">
            {currentDate.getFullYear()}
        </h3>
        
        <button 
            class="p-2 rounded-lg bg-gray-700 text-white hover:bg-gray-600 transition-colors"
            on:click={() => changeYear(1)}
            aria-label="Next year"
        >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
        </button>
    </div>
    
    <div 
        class="relative h-32 select-none"
        bind:this={timelineContainer}
        on:click={handleTimelineClick}
        on:keydown={handleTimelineClick}
        role="button"
        tabindex="0"
    >
        <!-- Base timeline -->
        <div class="absolute w-full h-px bg-gray-600 top-1/2"></div>
        
        <!-- Month grid lines -->
        {#each Array(12) as _, i}
            <div 
                class="absolute h-full"
                style="left: {(i / 12) * 100}%"
            >
                <div class="h-full w-px bg-gray-700 opacity-50"></div>
                <div class="absolute -top-1 left-0 w-1 h-2 bg-gray-600"></div>
                <div class="absolute -bottom-1 left-0 w-1 h-2 bg-gray-600"></div>
                <div 
                    class="absolute text-xs text-gray-400"
                    style="top: 8px; transform: translateX(-50%)"
                >
                    {new Date(currentDate.getFullYear(), i, 1).toLocaleString('default', { month: 'short' })}
                </div>
            </div>
        {/each}

        <!-- Solar events -->
        {#each Object.entries(solarEvents) as [name, date]}
            <div 
                class="absolute top-1/2 transform -translate-y-1/2 group"
                style="left: {getPositionInYear(date)}%"
            >
                {#if name.includes('Solstice')}
                    <div class="w-3 h-3 rounded-full bg-yellow-400"></div>
                {:else}
                    <div class="w-3 h-3 overflow-hidden relative">
                        <div class="absolute inset-0 rounded-l-full bg-yellow-400"></div>
                        <div class="absolute inset-0 rounded-r-full bg-gray-600"></div>
                    </div>
                {/if}
                
                <!-- Tooltip -->
                <div class="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    {name.replace(/([A-Z])/g, ' $1').trim()}: {date.toLocaleDateString()}
                </div>
            </div>
        {/each}

        <!-- Moon phases -->
        {#each moonPhases as { date, isNew }}
            <div 
                class="absolute top-1/2 transform -translate-y-1/2 group"
                style="left: {getPositionInYear(date)}%"
            >
                <div 
                    class="w-2 h-2 rounded-full border border-gray-400"
                    class:bg-gray-800={isNew}
                    class:bg-gray-300={!isNew}
                ></div>
                <!-- Tooltip -->
                <div class="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    {isNew ? '🌑 New Moon' : '🌕 Full Moon'}: {date.toLocaleDateString()}
                </div>
            </div>
        {/each}

        <!-- Scheduled Events (grouped by day) -->
        {#each Object.entries(eventsByDay) as [dateKey, dayEvents]}
            {@const eventDate = new Date(dateKey)}
            {@const position = getPositionInYear(eventDate)}
            <div
                class="absolute group"
                style="
                    left: {position}%;
                    top: 25%;
                    transform: translateX(-50%);
                "
            >
                <!-- Event dots/boxes stacked vertically -->
                <div class="flex flex-col gap-0.5">
                    {#each dayEvents.slice(0, 5) as event, index}
                        <div
                            class="w-2 h-2 rounded-sm transition-all hover:scale-125"
                            style="background-color: {getCategoryColor(event.category)}; box-shadow: 0 0 4px {getCategoryColor(event.category)}80;"
                        ></div>
                    {/each}
                    {#if dayEvents.length > 5}
                        <div class="text-[8px] text-gray-400 text-center leading-none">
                            +{dayEvents.length - 5}
                        </div>
                    {/if}
                </div>

                <!-- Tooltip with all events for this day -->
                <div class="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2
                    bg-gray-900 text-white text-xs px-3 py-2 rounded whitespace-nowrap
                    opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50
                    min-w-[200px] max-w-[300px]"
                    style="white-space: normal;"
                >
                    <div class="font-bold mb-1 border-b border-gray-700 pb-1">
                        {eventDate.toLocaleDateString('default', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </div>
                    <div class="space-y-2">
                        {#each dayEvents as event}
                            <div class="border-l-2 pl-2" style="border-color: {getCategoryColor(event.category)};">
                                <div class="font-semibold">{event.title}</div>
                                {#if event.description}
                                    <div class="text-gray-400 text-[10px] line-clamp-2">{event.description}</div>
                                {/if}
                                <div class="flex items-center gap-2 text-[10px] text-gray-400 mt-0.5">
                                    <span>
                                        {event.date.toLocaleTimeString('default', { hour: '2-digit', minute: '2-digit' })}
                                        {#if event.ends}
                                            - {event.ends.toLocaleTimeString('default', { hour: '2-digit', minute: '2-digit' })}
                                        {/if}
                                    </span>
                                    {#if event.category}
                                        <span class="px-1 rounded text-[9px]" style="background-color: {getCategoryColor(event.category)}40;">
                                            {event.category}
                                        </span>
                                    {/if}
                                </div>
                                {#if event.location}
                                    <div class="text-[10px] text-gray-500">📍 {event.location}</div>
                                {/if}
                                {#if event.participants && event.participants.length > 0}
                                    <div class="text-[10px] text-gray-500">
                                        👥 {event.participants.length} participant{event.participants.length > 1 ? 's' : ''}
                                    </div>
                                {/if}
                            </div>
                        {/each}
                    </div>
                </div>
            </div>
        {/each}

        <!-- Profile stays -->
        {#each yearStays as stay}
            {@const arrival = new Date(stay.profile.arrival)}
            {@const departure = new Date(stay.profile.departure)}
            {@const startPos = Math.max(0, getPositionInYear(arrival))}
            {@const endPos = Math.min(100, getPositionInYear(departure))}
            <div 
                class="absolute h-1.5 group cursor-pointer transition-all hover:h-2"
                style="
                    left: {startPos}%;
                    width: {endPos - startPos}%;
                    top: 75%;
                    background-color: {getUserColor(stay.userId)};
                "
            >
                <!-- Tooltip -->
                <div class="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 
                    bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap 
                    opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50"
                >
                    <div class="font-bold">{stay.user.first_name} {stay.user.last_name || ''}</div>
                    <div>Arrival: {arrival.toLocaleDateString()}</div>
                    <div>Departure: {departure.toLocaleDateString()}</div>
                    {#if stay.profile.origin}
                        <div>From: {stay.profile.origin}</div>
                    {/if}
                    {#if stay.profile.purpose}
                        <div>Purpose: {stay.profile.purpose}</div>
                    {/if}
                </div>
            </div>
        {/each}

        <!-- Current date indicator -->
        <div 
            class="absolute h-full w-px bg-white top-0 z-10"
            style="left: {markerPosition}%"
        >
            <div class="absolute -top-6 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded flex items-center gap-2">
                <span>{formatDateDisplay(currentDate)}</span>
                <span class="text-base" title="Current moon phase">
                    {getMoonPhaseIcon(phase(currentDate).phase)}
                </span>
            </div>
            <div class="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full"></div>
        </div>
    </div>
</div>

<style>
    .select-none {
        user-select: none;
        -webkit-user-select: none;
    }
</style>