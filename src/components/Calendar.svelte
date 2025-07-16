<script lang="ts">
    import { createEventDispatcher,getContext, onMount } from 'svelte';
    import HoloSphere from 'holosphere';
    import { ID } from "../dashboard/store";
    import Timeline from './Timeline.svelte';

    interface CalendarEvents {
        dateSelect: { date: Date; events: any[] };
    }
    const dispatch = createEventDispatcher<CalendarEvents>();

    const holosphere = getContext("holosphere") as HoloSphere;

    // Calendar state
    let currentDate = new Date();
    let selectedDate: Date | null = null;
    let events: { [key: string]: any[] } = {};
    let tasks: Record<string, any> = {};
    let monthTasks: any[] = [];
    let monthProfiles: any[] = [];
    let showModal = false;
    let selectedTask: { id: string; task: any } | null = null;
    let tempDate: string;
    let tempTime: string;
    let tempEndTime: string;
    
    // View options: 'month', 'week', 'day'
    let viewMode: 'grid' | 'list' | 'canvas' | 'month' | 'week' | 'day' = 'week';
    
    // Get calendar data for current month
    $: monthData = getMonthData(currentDate);
    $: weekData = getWeekData(currentDate);

    let currentDayPercentage = 0;

    // Add these before the calendar state variables
    let users: Record<string, User> = {};
    let profiles: Record<string, Profile> = {};
    let unsubscribe: (() => void) | null = null;

    // Watch for month changes to update data
    $: {
        const month = currentDate.getMonth();
        const year = currentDate.getFullYear();
        updateMonthData(month, year);
    }

    function updateMonthData(month: number, year: number) {
        const startDate = new Date(year, month, 1);
        const endDate = new Date(year, month + 1, 0);

        // Filter tasks for current month
        monthTasks = Object.entries(tasks)
            .filter(([_, task]) => {
                const taskDate = new Date(task.when);
                return taskDate >= startDate && taskDate <= endDate;
            })
            .map(([key, task]) => ({ key, ...task }));

        // Filter profiles for current month
        monthProfiles = Object.entries(profiles)
            .filter(([_, profile]) => {
                if (!profile?.arrival || !profile?.departure) return false;
                const arrival = new Date(profile.arrival);
                const departure = new Date(profile.departure);
                return (arrival <= endDate && departure >= startDate);
            })
            .map(([userId, profile]) => ({
                userId,
                profile,
                user: users[userId] || { first_name: 'Loading...' }
            }));
    }

    onMount(() => {
        loadProfiles();
        loadTasks();
    });

    // Function to reload data when view changes
    function reloadData() {
        loadProfiles();
        loadTasks();
    }

    // Update navigation functions to trigger data reload
    function handleNavigation(direction: 1 | -1) {
        switch (viewMode) {
            case 'month':
                navigateMonth(direction);
                break;
            case 'week':
                navigateWeek(direction);
                break;
            case 'day':
                navigateDay(direction);
                break;
        }
        reloadData();
    }

    // Update view mode changes to trigger data reload
    function handleViewModeChange(mode: 'month' | 'week' | 'day') {
        viewMode = mode;
        reloadData();
    }

    // Load profiles
    function loadProfiles() {
        if (!holosphere) return;
        
        try {
            // Subscribe to users
            holosphere.subscribe($ID, "users", async (newUser, key) => {
                if (!key) return; // Skip if no key
                if (newUser) {
                    const userData =  newUser;
                    if (!userData?.id) return; // Skip if no user ID
                    users[key] = userData;
                    users = users; // Trigger reactivity
                   
                    // Load profile for this user
                    try {
                        const profile = await holosphere.get(userData.id, 'profile', userData.id );
                        console.log("profile found:",profile)
                        if (profile) {
                            profiles[key] = profile;
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

    function navigateDay(direction: 1 | -1) {
        currentDate = new Date(currentDate.setDate(currentDate.getDate() + direction));
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
        const dateStr = date.toDateString();
        const dayTasks = monthTasks
            .filter(task => new Date(task.when).toDateString() === dateStr)
            .map(task => ({
                ...task,
                color: '#3B82F6',
            }));
        
        return [...(events[dateStr] || []), ...dayTasks];
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
        return monthProfiles
            .filter(({ profile }) => {
                const arrivalDate = new Date(profile.arrival);
                const departureDate = new Date(profile.departure);
                const checkDate = new Date(dateStr);
                return checkDate >= arrivalDate && checkDate <= departureDate;
            })
            .map(stay => ({
                ...stay,
                isArrival: new Date(stay.profile.arrival).toDateString() === dateStr,
                isDeparture: new Date(stay.profile.departure).toDateString() === dateStr
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

    function loadTasks() {
        if (!holosphere) return;
        
        holosphere.subscribe($ID, 'quests', (newTask, key) => {
            if (newTask) {
                const task = newTask;
                if (task.when) {
                    tasks[key] = task;
                    tasks = tasks;
                }
            } else {
                delete tasks[key];
                tasks = tasks;
            }
        });
    }

    function handleTaskClick(key: string, task: any) {
        selectedTask = { id: key, task };
        const date = new Date(task.when);
        const endDate = task.ends ? new Date(task.ends) : new Date(date.getTime() + 60*60*1000);
        tempDate = date.toISOString().split('T')[0];
        tempTime = date.toTimeString().slice(0, 5);
        tempEndTime = endDate.toTimeString().slice(0, 5);
        showModal = true;
    }

    function updateDateTime() {
        if (!selectedTask) return;
        
        const newDate = new Date(`${tempDate}T${tempTime}`);
        const endDate = new Date(`${tempDate}T${tempEndTime}`);
        const updatedTask = {
            ...selectedTask.task,
            when: newDate.toISOString(),
            ends: endDate.toISOString()
        };
        
        showModal = false;
        selectedTask = null;
        
        try {
            holosphere.put($ID, 'quests', updatedTask);
        } catch (error) {
            console.error('Error updating task:', error);
        }
    }

    function deleteSchedule() {
        if (!selectedTask) return;

        try {
            const updatedTask = {
                ...selectedTask.task,
                when: null,
                status: 'ongoing'
            };
            
            showModal = false;
            selectedTask = null;
            
            holosphere.put($ID, 'quests', updatedTask);
        } catch (error) {
            console.error('Error removing schedule:', error);
        }
    }

    // Add this helper function to calculate grid positions
    function getTaskPosition(task: any) {
        const startTime = new Date(task.when);
        const endTime = task.ends ? new Date(task.ends) : new Date(startTime.getTime() + 60*60*1000);
        
        const startHour = startTime.getHours() - 6; // Adjust for 6 AM start
        const startMinutes = startTime.getMinutes();
        const endHour = endTime.getHours() - 6;
        const endMinutes = endTime.getMinutes();
        
        const startRow = startHour + (startMinutes / 60); // Convert to decimal hours
        const endRow = endHour + (endMinutes / 60);
        
        return {
            gridRowStart: Math.max(Math.floor(startRow) + 1, 1),
            gridRowEnd: Math.min(Math.ceil(endRow) + 1, 19),
            startTime: `${startTime.getHours().toString().padStart(2, '0')}:${startTime.getMinutes().toString().padStart(2, '0')}`,
            endTime: `${endTime.getHours().toString().padStart(2, '0')}:${endTime.getMinutes().toString().padStart(2, '0')}`
        };
    }

    // Add to script section at the top
    let now = new Date();
    let currentTimeInterval: number;

    // Update current time every minute
    onMount(() => {
        currentTimeInterval = setInterval(() => {
            now = new Date();
        }, 60000);

        return () => {
            clearInterval(currentTimeInterval);
        };
    });

    // First, update the current time calculation to include minutes for smoother positioning
    function getCurrentTimePosition() {
        const hours = now.getHours() - 6; // Adjust for 6 AM start
        const minutes = now.getMinutes();
        const position = hours + (minutes / 60);
        return {
            position: Math.max(0, Math.min(position, 18)) * 48, // Multiply by row height (48px)
            isVisible: now.getHours() >= 6 && now.getHours() < 24
        };
    }
</script>

<Timeline 
    currentDate={currentDate}
    profiles={profiles}
    users={users}
    on:dateSelect={handleTimelineDateSelect}
/>

<div class="bg-gray-800 rounded-3xl p-6">
    <div class="flex justify-between items-center mb-6">
        <div class="flex items-center gap-4">
            <div class="flex gap-2">
                <button 
                    class="p-2 rounded-lg bg-gray-700 text-white hover:bg-gray-600 transition-colors"
                    on:click={() => handleNavigation(-1)}
                >
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
                    </svg>
                </button>
                <button 
                    class="p-2 rounded-lg bg-gray-700 text-white hover:bg-gray-600 transition-colors"
                    on:click={() => handleNavigation(1)}
                >
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                    </svg>
                </button>
            </div>
            <h2 class="text-2xl font-bold text-white">
                {#if viewMode === 'month'}
                    {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                {:else if viewMode === 'week'}
                    {weekData[0].toLocaleDateString(undefined, { month: 'long', day: 'numeric' })} - 
                    {weekData[6].toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
                {:else}
                    {currentDate.toLocaleString('default', { month: 'long', day: 'numeric', year: 'numeric' })}
                {/if}
            </h2>
        </div>
        <div class="flex gap-2">
            <button 
                class="px-4 py-2 rounded-lg {viewMode === 'day' ? 'bg-gray-600' : 'bg-gray-700'} text-white hover:bg-gray-600 transition-colors"
                on:click={() => handleViewModeChange('day')}
            >
                Day
            </button>
            <button 
                class="px-4 py-2 rounded-lg {viewMode === 'week' ? 'bg-gray-600' : 'bg-gray-700'} text-white hover:bg-gray-600 transition-colors"
                on:click={() => handleViewModeChange('week')}
            >
                Week
            </button>
            <button 
                class="px-4 py-2 rounded-lg {viewMode === 'month' ? 'bg-gray-600' : 'bg-gray-700'} text-white hover:bg-gray-600 transition-colors"
                on:click={() => handleViewModeChange('month')}
            >
                Month
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
                        {#each Array(18) as _, i}
                            <div 
                                class="p-1 min-h-[48px] group hover:bg-gray-700 transition-colors"
                                style="grid-row: {i + 1}"
                            >
                                <div class="text-xs text-gray-500 group-hover:text-gray-400">
                                    {(i + 6).toString().padStart(2, '0')}:00
                                </div>
                            </div>
                        {/each}

                        {#each Object.entries(tasks) as [key, task]}
                            {#if new Date(task.when).toDateString() === date.toDateString()}
                                {@const position = getTaskPosition(task)}
                                <div 
                                    class="text-xs p-1 rounded bg-blue-500 bg-opacity-90 truncate text-white cursor-pointer hover:bg-blue-400 transition-colors absolute inset-x-0 mx-1"
                                    on:click|stopPropagation={() => handleTaskClick(key, task)}
                                    on:keydown={(e) => e.key === 'Enter' && handleTaskClick(key, task)}
                                    role="button"
                                    tabindex="0"
                                    style="
                                        grid-row: {position.gridRowStart} / {position.gridRowEnd};
                                        top: 0;
                                        bottom: 0;
                                    "
                                >
                                    <div class="font-bold">{task.title}</div>
                                    {#if task.created}
                                        <div class="text-xs opacity-75">
                                            Created: {formatDate(task.created)}
                                        </div>
                                    {/if}
                                    <div class="text-xs opacity-75">
                                        {position.startTime} - {position.endTime}
                                    </div>
                                    {#if task.location}
                                        <div class="text-sm opacity-75">{task.location}</div>
                                    {/if}
                                </div>
                            {/if}
                        {/each}

                        {#if now.toDateString() === date.toDateString()}
                            {@const timePosition = getCurrentTimePosition()}
                            {#if timePosition.isVisible}
                                <div 
                                    class="absolute inset-x-0 z-30 pointer-events-none"
                                    style="top: {timePosition.position}px;"
                                >
                                    <div class="relative flex items-center">
                                        <div class="absolute right-full pr-2">
                                            <span class="text-red-500 text-xs font-medium bg-gray-800 px-1 rounded">
                                                {now.getHours().toString().padStart(2, '0')}:{now.getMinutes().toString().padStart(2, '0')}
                                            </span>
                                        </div>
                                        <div class="absolute -left-1 w-2 h-2 bg-red-500 rounded-full"></div>
                                        <div class="w-full h-px bg-gradient-to-r from-red-500 via-red-500/50 to-transparent"></div>
                                    </div>
                                </div>
                            {/if}
                        {/if}

                        {#each events[date.toDateString()] || [] as event}
                            <div 
                                class="text-xs p-1 rounded bg-opacity-90 truncate mt-1"
                                style="background-color: {event.color || '#4B5563'}"
                            >
                                {event.title}
                            </div>
                        {/each}
                    </div>
                </div>
            {/each}
        </div>
    {:else if viewMode === 'day'}
        <div class="bg-gray-800">
            <div class="p-2 text-center border-b border-gray-700">
                <div class="text-gray-400 font-medium">
                    {currentDate.toLocaleString('default', { weekday: 'long' })}
                </div>
                <div 
                    class="inline-flex w-8 h-8 items-center justify-center rounded-full text-white mt-1
                    {isToday(currentDate) ? 'bg-blue-500' : ''}"
                >
                    {currentDate.getDate()}
                </div>
            </div>
            
            <div class="divide-y divide-gray-700 relative">
                {#each Array(18) as _, i}
                    <div 
                        class="p-1 min-h-[48px] group hover:bg-gray-700 transition-colors"
                        style="grid-row: {i + 1}"
                        on:click={() => {
                            const eventDate = new Date(currentDate);
                            eventDate.setHours(i + 6);
                            handleDateClick(eventDate);
                        }}
                    >
                        <div class="text-xs text-gray-500 group-hover:text-gray-400">
                            {(i + 6).toString().padStart(2, '0')}:00
                        </div>
                    </div>
                {/each}

                {#each Object.entries(tasks) as [key, task]}
                    {#if new Date(task.when).toDateString() === currentDate.toDateString()}
                        {@const position = getTaskPosition(task)}
                        <div
                            class="text-xs p-1 rounded bg-blue-500 bg-opacity-90 truncate text-white cursor-pointer hover:bg-blue-400 transition-colors absolute inset-x-0 mx-1"
                            on:click|stopPropagation={() => handleTaskClick(key, task)}
                            on:keydown={(e) => e.key === 'Enter' && handleTaskClick(key, task)}
                            role="button"
                            tabindex="0"
                            style="
                                grid-row: {position.gridRowStart} / {position.gridRowEnd};
                                top: 0;
                                bottom: 0;
                                z-index: 10;
                            "
                        >
                            <div class="font-bold">{task.title}</div>
                            {#if task.created}
                                <div class="text-xs opacity-75">
                                    Created: {formatDate(task.created)}
                                </div>
                            {/if}
                            <div class="text-xs opacity-75">
                                {position.startTime} - {position.endTime}
                            </div>
                            {#if task.location}
                                <div class="text-sm opacity-75">{task.location}</div>
                            {/if}
                            {#if task.participants?.length}
                                <div class="text-sm mt-1">
                                    🙋‍♂️ {task.participants.length} participants
                                </div>
                            {/if}
                        </div>
                    {/if}
                {/each}

                <!-- Show arrivals/departures at noon -->
                <div 
                    style="grid-row: 13"
                    class="relative z-20"
                >
                    {#each Object.entries(profiles) as [userId, profile]}
                        {@const arrival = new Date(profile.arrival)}
                        {@const departure = new Date(profile.departure)}
                        {@const isToday = arrival.toDateString() === currentDate.toDateString() || 
                                                departure.toDateString() === currentDate.toDateString()}
                        {#if isToday}
                            <div
                                class="text-xs p-1 rounded text-white mt-1"
                                style="background-color: {getUserColor(userId)};"
                            >
                                <div class="font-bold">
                                    {#if arrival.toDateString() === currentDate.toDateString() && users[userId]}
                                        🛬 {users[userId]?.first_name || 'Loading...'} arrives
                                    {:else}
                                        🛫 {users[userId]?.first_name || 'Loading...'} departs
                                    {/if}
                                </div>
                            </div>
                        {/if}
                    {/each}
                </div>

                <!-- Add current time indicator -->
                {#if now.toDateString() === currentDate.toDateString()}
                    {@const timePosition = getCurrentTimePosition()}
                    {#if timePosition.isVisible}
                        <div 
                            class="absolute inset-x-0 z-30 pointer-events-none"
                            style="top: {timePosition.position}px;"
                        >
                            <div class="relative flex items-center">
                                <div class="absolute right-full pr-2">
                                    <span class="text-red-500 text-xs font-medium bg-gray-800 px-1 rounded">
                                        {now.getHours().toString().padStart(2, '0')}:{now.getMinutes().toString().padStart(2, '0')}
                                    </span>
                                </div>
                                <div class="absolute -left-1 w-2 h-2 bg-red-500 rounded-full"></div>
                                <div class="w-full h-px bg-gradient-to-r from-red-500 via-red-500/50 to-transparent"></div>
                            </div>
                        </div>
                    {/if}
                {/if}
            </div>
        </div>
    {/if}
</div>

{#if showModal}
    <dialog 
        class="fixed inset-0 bg-black/75 z-50"
        open
    >
        <div class="fixed inset-0 flex items-center justify-center">
            <form 
                method="dialog"
                class="bg-gray-800 p-6 rounded-xl schedule-modal border border-gray-700 shadow-xl max-w-md w-full"
                role="dialog"
                aria-labelledby="modal-title"
                aria-describedby="modal-description"
            >
                <div class="flex justify-between items-center mb-6">
                    <h3 id="modal-title" class="text-white text-lg font-medium">Update Schedule</h3>
                    <span id="modal-description" class="sr-only">Update schedule date and time</span>
                    <button 
                        class="text-gray-400 hover:text-white transition-colors"
                        on:click={() => {
                            showModal = false;
                            selectedTask = null;
                        }}
                        aria-label="Close modal"
                    >
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                
                <div class="space-y-4">
                    <div>
                        <label for="date-input" class="text-gray-300 text-sm font-medium block mb-2">Date</label>
                        <input 
                            id="date-input"
                            type="date" 
                            bind:value={tempDate}
                            class="w-full bg-gray-900 text-white p-2.5 rounded-lg border border-gray-700 focus:border-gray-500 focus:ring-1 focus:ring-gray-500 outline-none transition-colors"
                        >
                    </div>
                    
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label for="time-input" class="text-gray-300 text-sm font-medium block mb-2">Start Time</label>
                            <input 
                                id="time-input"
                                type="time" 
                                bind:value={tempTime}
                                class="w-full bg-gray-900 text-white p-2.5 rounded-lg border border-gray-700 focus:border-gray-500 focus:ring-1 focus:ring-gray-500 outline-none transition-colors"
                            >
                        </div>
                        
                        <div>
                            <label for="end-time-input" class="text-gray-300 text-sm font-medium block mb-2">End Time</label>
                            <input 
                                id="end-time-input"
                                type="time" 
                                bind:value={tempEndTime}
                                class="w-full bg-gray-900 text-white p-2.5 rounded-lg border border-gray-700 focus:border-gray-500 focus:ring-1 focus:ring-gray-500 outline-none transition-colors"
                            >
                        </div>
                    </div>
                    
                    <div class="flex gap-3 justify-end pt-2">
                        <button 
                            type="button"
                            class="px-4 py-2 bg-gray-700 text-red-300 rounded-lg hover:bg-gray-600 border border-red-900/20 transition-colors text-sm font-medium"
                            on:click={deleteSchedule}
                            aria-label="Remove schedule"
                        >
                            Remove Schedule
                        </button>
                        <button 
                            type="button"
                            class="px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 border border-gray-600 transition-colors text-sm font-medium"
                            on:click={() => {
                                showModal = false;
                                selectedTask = null;
                            }}
                            aria-label="Cancel changes"
                        >
                            Cancel
                        </button>
                        <button 
                            type="button"
                            class="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-500 transition-colors text-sm font-medium"
                            on:click={updateDateTime}
                            aria-label="Update schedule"
                        >
                            Update
                        </button>
                    </div>
                </div>
            </form>
        </div>
    </dialog>
{/if}

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

    .scheduleContainer {
        display: grid;
        grid-template-columns: 5rem 1fr;
        grid-template-rows: repeat(32, minmax(3rem, auto));
        gap: 1px;
        position: relative;
    }

    .event {
        position: relative;
        overflow: hidden;
        z-index: 1;
    }

    .divide-y > div {
        position: relative;
        height: 48px;
    }
    
    .divide-y {
        display: grid;
        grid-template-rows: repeat(18, 48px);
        position: relative;
        height: 864px; /* 18 rows * 48px */
        overflow-y: auto;
    }
</style> 