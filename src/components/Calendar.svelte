<script lang="ts">
    import { createEventDispatcher, getContext, onMount } from 'svelte';
    import HoloSphere from 'holosphere';
    import { formatDate, formatTime } from '../utils/date.js';
    import { phase } from 'lune';

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

    // Add new state for celestial data
    let solarPhase = 0; // 0-1 representing position in year
    
    // Calculate solar phase (position in year)
    $: {
        const year = currentDate.getFullYear();
        const events = getSolarEvents(year);
        
        // Find the current season
        const now = currentDate.getTime();
        let seasonStart: Date;
        let seasonEnd: Date;
        let seasonName: string;
        
        if (now < events.springEquinox.getTime()) {
            seasonStart = new Date(year, 0, 1);
            seasonEnd = events.springEquinox;
            seasonName = 'Winter';
        } else if (now < events.summerSolstice.getTime()) {
            seasonStart = events.springEquinox;
            seasonEnd = events.summerSolstice;
            seasonName = 'Spring';
        } else if (now < events.autumnEquinox.getTime()) {
            seasonStart = events.summerSolstice;
            seasonEnd = events.autumnEquinox;
            seasonName = 'Summer';
        } else if (now < events.winterSolstice.getTime()) {
            seasonStart = events.autumnEquinox;
            seasonEnd = events.winterSolstice;
            seasonName = 'Autumn';
        } else {
            seasonStart = events.winterSolstice;
            seasonEnd = new Date(year + 1, 0, 1);
            seasonName = 'Winter';
        }
        
        // Calculate phase within the year
        const yearStart = new Date(year, 0, 1);
        const yearEnd = new Date(year + 1, 0, 1);
        solarPhase = (now - yearStart.getTime()) / (yearEnd.getTime() - yearStart.getTime());
        
        // Calculate phase within the season
        const seasonPhase = (now - seasonStart.getTime()) / (seasonEnd.getTime() - seasonStart.getTime());
    }
    
    // Subscribe to events
    onMount(() => {
        if (holosphere) {
            holosphere.getGlobal('Events', (newEvent, key) => {
                if (newEvent) {
                    const event = typeof newEvent === 'string' ? JSON.parse(newEvent) : newEvent;
                    const dateKey = new Date(event.date).toDateString();
                    
                    events = {
                        ...events,
                        [dateKey]: [...(events[dateKey] || []), { ...event, id: key }]
                    };
                } else {
                    // Remove event
                    Object.keys(events).forEach(date => {
                        events[date] = events[date].filter(e => e.id !== key);
                    });
                }
            });
        }
    });

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

    function getSolarEvents(year: number) {
        // Approximate dates - these vary slightly year to year
        return {
            springEquinox: new Date(year, 2, 20), // March 20
            summerSolstice: new Date(year, 5, 21), // June 21
            autumnEquinox: new Date(year, 8, 22), // September 22
            winterSolstice: new Date(year, 11, 21) // December 21
        };
    }

    // Add these state variables at the top of the script
    let timelineZoom = 1;
    let timelinePan = 0;
    let isDragging = false;
    let startX = 0;
    let startPan = 0;
    let timelineContainer: HTMLElement;

    // Add these state variables
    let visibleYears = new Set([currentDate.getFullYear()]);
    let timelineWidth = 2000; // Width per year

    // Add function to calculate visible years based on pan and zoom
    function updateVisibleYears() {
        const viewportStart = -timelinePan / timelineZoom;
        const viewportEnd = (timelineContainer.clientWidth - timelinePan) / timelineZoom;
        
        const startYear = Math.floor(viewportStart / timelineWidth) + currentDate.getFullYear();
        const endYear = Math.ceil(viewportEnd / timelineWidth) + currentDate.getFullYear();
        
        const newVisibleYears = new Set();
        for (let year = startYear; year <= endYear; year++) {
            newVisibleYears.add(year);
        }
        visibleYears = newVisibleYears;
    }

    // Add these functions for timeline interaction
    function handleTimelineWheel(event: WheelEvent) {
        event.preventDefault();
        
        if (event.ctrlKey || event.metaKey) {
            // Zoom
            const rect = timelineContainer.getBoundingClientRect();
            const mouseX = event.clientX - rect.left;
            const zoomPoint = (mouseX - timelinePan) / timelineZoom;
            
            const newZoom = Math.min(Math.max(0.5, timelineZoom * (event.deltaY > 0 ? 0.95 : 1.05)), 10);
            timelinePan = mouseX - (zoomPoint * newZoom);
            timelineZoom = newZoom;
        } else {
            // Pan
            timelinePan = timelinePan - event.deltaX;
        }
        updateVisibleYears();
    }

    function handleTimelineMouseDown(event: MouseEvent) {
        isDragging = true;
        startX = event.clientX;
        startPan = timelinePan;
    }

    function handleTimelineMouseMove(event: MouseEvent) {
        if (!isDragging) return;
        const delta = event.clientX - startX;
        timelinePan = startPan + delta;
        updateVisibleYears();
    }

    function handleTimelineMouseUp() {
        isDragging = false;
    }

    // Add function to get moon phases for the year
    function getMoonPhases(year: number) {
        const phases = [];
        const startDate = new Date(year, 0, 1);
        const endDate = new Date(year + 1, 0, 1);
        
        // Check every 6 hours for better accuracy
        let currentDate = new Date(startDate);
        
        while (currentDate < endDate) {
            const phaseInfo = phase(currentDate);
            
            // Only add exact new moons (phase ≈ 0) or full moons (phase ≈ 0.5)
            if (phaseInfo.phase < 0.025 || (phaseInfo.phase > 0.475 && phaseInfo.phase < 0.525)) {
                // Check if we already have a similar phase nearby (within 10 days)
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
            
            // Move forward by 6 hours
            currentDate = new Date(currentDate.getTime() + 6 * 60 * 60 * 1000);
        }
        
        return phases;
    }

    // Add to reactive statements
    $: moonPhases = getMoonPhases(currentDate.getFullYear());

    // Add function to handle timeline clicks and cursor drags
    function handleTimelineClick(event: MouseEvent) {
        if (isDragging) return;
        
        const rect = timelineContainer.getBoundingClientRect();
        const x = (event.clientX - rect.left - timelinePan) / timelineZoom;
        
        // Calculate total months from the start
        const totalMonths = (x / (timelineWidth / 12));
        const years = Math.floor(totalMonths / 12);
        const months = Math.floor(totalMonths % 12);
        const daysIntoMonth = ((totalMonths % 1) * getDaysInMonth(currentDate.getMonth()));
        
        updateSelectedDate(years, months, daysIntoMonth);
    }

    function updateSelectedDate(yearOffset: number, monthOffset: number, days: number) {
        const newDate = new Date(currentDate);
        newDate.setFullYear(currentDate.getFullYear() + yearOffset);
        newDate.setMonth(monthOffset);
        newDate.setDate(Math.floor(days));
        
        currentDate = newDate;
        selectedDate = currentDate;
        dispatch('dateSelect', { 
            date: currentDate, 
            events: events[currentDate.toDateString()] || [] 
        });
    }

    // Helper function to get days in a month
    function getDaysInMonth(month: number): number {
        return new Date(currentDate.getFullYear(), month + 1, 0).getDate();
    }

    // Update the timeline container element

    // Add a function to format date for display
    function formatDateDisplay(date: Date): string {
        return date.toLocaleDateString(undefined, { 
            weekday: 'short', 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric' 
        });
    }

    // Add function to get current moon phase icon
    function getMoonPhaseIcon(phaseValue: number) {
        // 0 = new moon, 0.5 = full moon, 1 = new moon
        if (phaseValue < 0.125) return '🌑'; // new moon
        if (phaseValue < 0.25) return '🌒'; // waxing crescent
        if (phaseValue < 0.375) return '🌓'; // first quarter
        if (phaseValue < 0.5) return '🌔'; // waxing gibbous
        if (phaseValue < 0.625) return '🌕'; // full moon
        if (phaseValue < 0.75) return '🌖'; // waning gibbous
        if (phaseValue < 0.875) return '🌗'; // last quarter
        return '🌘'; // waning crescent
    }
</script>

<div class="bg-gray-800 rounded-3xl p-6 mb-6">
    <div class="flex justify-between items-center mb-4">
        <h3 class="text-lg font-medium text-white">Timeline</h3>
        <div class="text-sm text-gray-400">
            Zoom: {timelineZoom.toFixed(1)}x
        </div>
    </div>
    
    <!-- Timeline container -->
    <div 
        class="relative h-32 overflow-hidden cursor-grab select-none"
        class:cursor-grabbing={isDragging}
        bind:this={timelineContainer}
        on:wheel={handleTimelineWheel}
        on:mousedown={handleTimelineMouseDown}
        on:mousemove={handleTimelineMouseMove}
        on:mouseup={handleTimelineMouseUp}
        on:mouseleave={handleTimelineMouseUp}
        on:click={handleTimelineClick}
    >
        <!-- Timeline content -->
        <div 
            class="absolute inset-0"
            style="transform: translateX({timelinePan}px);"
        >
            <!-- Scalable elements container -->
            <div 
                class="absolute inset-0"
                style="transform: scaleX({timelineZoom}); transform-origin: left center;"
            >
                {#each [...visibleYears] as year}
                    {@const yearOffset = (year - currentDate.getFullYear()) * timelineWidth}
                    <!-- Base timeline line -->
                    <div class="absolute w-[2000px] h-px bg-gray-600 top-1/2"
                        style="left: {yearOffset}px"
                    ></div>
                    
                    <!-- Month grid lines -->
                    {#each Array(12) as _, i}
                        <div 
                            class="absolute h-full"
                            style="left: {yearOffset + (i / 12) * timelineWidth}px"
                        >
                            <div class="h-full w-px bg-gray-700 opacity-50"></div>
                        </div>
                    {/each}
                {/each}
            </div>

            <!-- Non-scaling elements -->
            {#each [...visibleYears] as year}
                {@const yearOffset = (year - currentDate.getFullYear()) * timelineWidth * timelineZoom}
                
                <!-- Month labels -->
                {#each Array(12) as _, i}
                    <div 
                        class="absolute text-xs text-gray-400"
                        style="left: {yearOffset + (i / 12) * timelineWidth * timelineZoom}px; top: 8px; transform: translateX(-50%)"
                    >
                        {new Date(year, i, 1).toLocaleString('default', { month: 'long' })}
                    </div>
                {/each}

                <!-- Solar events -->
                {#each Object.entries(getSolarEvents(year)) as [name, date]}
                    <div 
                        class="absolute top-1/2 transform -translate-y-1/2 group"
                        style="left: {yearOffset + (date.getTime() - new Date(year, 0, 1).getTime()) / 
                            (new Date(year + 1, 0, 1).getTime() - new Date(year, 0, 1).getTime()) * timelineWidth * timelineZoom}px"
                    >
                        <!-- Different icons for solstices and equinoxes -->
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
            {/each}

            <!-- Move moon phase markers outside the year loop -->
            {#each moonPhases as { date, isNew }}
                <div 
                    class="absolute top-1/2 transform -translate-y-1/2 group"
                    style="left: {((date.getTime() - new Date(currentDate.getFullYear(), 0, 1).getTime()) / 
                        (new Date(currentDate.getFullYear() + 1, 0, 1).getTime() - new Date(currentDate.getFullYear(), 0, 1).getTime())) * timelineWidth * timelineZoom}px"
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

            <!-- Current date indicator -->
            <div 
                class="absolute h-full w-px bg-white top-0 cursor-ew-resize z-10"
                style="left: {((currentDate.getTime() - new Date(currentDate.getFullYear(), 0, 1).getTime()) / 
                    (new Date(currentDate.getFullYear() + 1, 0, 1).getTime() - new Date(currentDate.getFullYear(), 0, 1).getTime()) + 
                    (currentDate.getFullYear() - Math.min(...visibleYears))) * timelineWidth * timelineZoom}px;"
            >
                <div class="absolute top-0 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded flex items-center gap-2">
                    <span>{formatDateDisplay(currentDate)}</span>
                    <span class="text-base" title="Current moon phase">
                        {getMoonPhaseIcon(phase(currentDate).phase)}
                    </span>
                </div>
                <!-- Indicator handle -->
                <div class="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full"></div>
            </div>
        </div>
    </div>
</div>

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
                <button 
                    class="p-2 min-h-[100px] text-left bg-gray-800 relative group transition-colors hover:bg-gray-700"
                    class:opacity-50={!isCurrentMonth(date)}
                    class:ring-2={date.toDateString() === currentDate.toDateString()}
                    class:ring-white={date.toDateString() === currentDate.toDateString()}
                    on:click={() => handleDateClick(date)}
                >
                    <span 
                        class="inline-flex w-8 h-8 items-center justify-center rounded-full text-white
                        {isToday(date) ? 'bg-blue-500' : ''}"
                    >
                        {date.getDate()}
                    </span>
                    
                    <div class="mt-1 space-y-1">
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
    /* Ensure smooth transitions */
    button {
        transition: all 0.2s ease;
    }
    
    /* Custom scrollbar styles */
    div {
        scrollbar-width: thin;
        scrollbar-color: rgba(75, 85, 99, 0.5) transparent;
    }
    
    div::-webkit-scrollbar {
        width: 6px;
    }
    
    div::-webkit-scrollbar-track {
        background: transparent;
    }
    
    div::-webkit-scrollbar-thumb {
        background-color: rgba(75, 85, 99, 0.5);
        border-radius: 3px;
    }

    /* Prevent text selection during dragging */
    .select-none {
        user-select: none;
        -webkit-user-select: none;
    }

    /* Smooth transitions */
    .transition-transform {
        transition: transform 0.1s ease-out;
    }

    /* Hide scrollbars */
    .overflow-hidden::-webkit-scrollbar {
        display: none;
    }
</style> 