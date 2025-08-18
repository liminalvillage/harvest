<script lang="ts">
    import { onMount, onDestroy, getContext } from "svelte";
    import { fade, slide } from "svelte/transition";
    import { ID } from "../dashboard/store";
    import HoloSphere from "holosphere";
    import { fetchHolonName } from "../utils/holonNames";
    import { taskSortStore, sortTasks, type TaskSortState } from "../dashboard/taskSortStore";

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
    
    // Weather state
    let weatherData: {
        temperature: number;
        weatherCode: number;
        windSpeed: number;
        unit: string;
    } | null = null;
    let isLoadingWeather = false;
    
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
    
    // Events and tasks data
    let todaysEvents: Array<{
        id: string;
        title: string;
        time: string;
        description?: string;
    }> = [];
    let topTasks: Array<{
        id: string;
        title: string;
        priority?: string;
        dueDate?: string;
        status: string;
    }> = [];
    let isLoadingEvents = false;
    let isLoadingTasks = false;

    // Time formatting
    function formatTime(date: Date) {
        return date.toLocaleTimeString('en-US', {
            hour12: true,
            hour: 'numeric',
            minute: '2-digit'
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

    // Fetch weather data
    async function fetchWeather() {
        isLoadingWeather = true;
        
        try {
            // Get user's location
            if ("geolocation" in navigator) {
                navigator.geolocation.getCurrentPosition(async (position) => {
                    const { latitude, longitude } = position.coords;
                    
                    try {
                        // Using Open-Meteo API (free, no API key required)
                        const response = await fetch(
                            `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code,wind_speed_10m&timezone=auto`
                        );
                        
                        if (response.ok) {
                            const data = await response.json();
                            weatherData = {
                                temperature: Math.round(data.current.temperature_2m),
                                weatherCode: data.current.weather_code,
                                windSpeed: Math.round(data.current.wind_speed_10m),
                                unit: data.current_units.temperature_2m
                            };
                        }
                    } catch (error) {
                        console.error("Failed to fetch weather:", error);
                    } finally {
                        isLoadingWeather = false;
                    }
                }, (error) => {
                    console.warn("Geolocation denied:", error);
                    isLoadingWeather = false;
                });
            } else {
                console.warn("Geolocation not supported");
                isLoadingWeather = false;
            }
        } catch (error) {
            console.error("Weather fetch error:", error);
            isLoadingWeather = false;
        }
    }

    // Get weather icon based on weather code
    function getWeatherIcon(code: number) {
        if (code === 0) return "☀️"; // Clear sky
        if (code <= 3) return "⛅"; // Partly cloudy
        if (code <= 48) return "🌫️"; // Fog
        if (code <= 67) return "🌧️"; // Rain
        if (code <= 77) return "❄️"; // Snow
        if (code <= 82) return "🌦️"; // Rain showers
        if (code <= 86) return "🌨️"; // Snow showers
        if (code <= 99) return "⛈️"; // Thunderstorm
        return "🌤️"; // Default
    }

    // Load today's events
    async function loadTodaysEvents() {
        if (!holosphere || !holonID) return;
        
        isLoadingEvents = true;
        try {
            const eventsData = await holosphere.getAll(holonID, "calendar");
            const today = new Date();
            const todayStr = today.toISOString().split('T')[0];
            
            let events: any[] = [];
            if (Array.isArray(eventsData)) {
                events = eventsData;
            } else if (eventsData && typeof eventsData === 'object') {
                events = Object.values(eventsData);
            }
            
            // Filter for today's events and sort by time
            const todayEvents = events.filter((event: any) => {
                if (!event.date && !event.startDate) return false;
                const eventDate = new Date(event.date || event.startDate);
                return eventDate.toISOString().split('T')[0] === todayStr;
            }).sort((a: any, b: any) => {
                const timeA = new Date(a.date || a.startDate).getTime();
                const timeB = new Date(b.date || b.startDate).getTime();
                return timeA - timeB;
            }).slice(0, 3);
            
            todaysEvents = todayEvents.map((event: any) => ({
                id: event.id || Math.random().toString(),
                title: event.title || event.name || 'Untitled Event',
                time: new Date(event.date || event.startDate).toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true
                }),
                description: event.description || event.details
            }));
            
        } catch (error) {
            console.error("Dashboard: Error loading events:", error);
        } finally {
            isLoadingEvents = false;
        }
    }

    // Load top tasks using the same sorting as Tasks.svelte
    async function loadTopTasks() {
        if (!holosphere || !holonID) return;
        
        isLoadingTasks = true;
        try {
            const tasksData = await holosphere.getAll(holonID, "quests");
            let tasks: any[] = [];
            
            if (Array.isArray(tasksData)) {
                // Convert array to entries for consistent processing
                tasks = tasksData.map((task, index) => [task.id || index.toString(), task]);
            } else if (tasksData && typeof tasksData === 'object') {
                tasks = Object.entries(tasksData);
            }
            
            // Filter active tasks first
            const activeTasks = tasks.filter(([_, task]: [string, any]) => 
                task.status !== 'completed' && task.status !== 'cancelled'
            );
            
            // Get current sort state and apply the same sorting as Tasks.svelte
            const currentSortState = $taskSortStore;
            const sortedTasks = sortTasks(activeTasks, currentSortState);
            
            // Take only the top 3 tasks after sorting
            const topTaskEntries = sortedTasks.slice(0, 3);
            
            topTasks = topTaskEntries.map(([key, task]: [string, any]) => ({
                id: key,
                title: task.title || task.name || 'Untitled Task',
                priority: task.priority,
                dueDate: task.dueDate,
                status: task.status || 'pending',
                created: task.created,
                orderIndex: task.orderIndex,
                position: task.position
            }));
            
        } catch (error) {
            console.error("Dashboard: Error loading tasks:", error);
        } finally {
            isLoadingTasks = false;
        }
    }

    // Load holon statistics (simplified for dashboard)
    async function loadHolonStats() {
        if (!holosphere || !holonID) {
            console.warn("Dashboard: holosphere or holonID not available");
            return;
        }

        isLoadingStats = true;
        
        try {
            // Fetch holon name
            holonName = await fetchHolonName(holosphere, holonID);
            
            // Fetch tasks (simplified)
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

            holonStats = {
                totalTasks,
                completedTasks,
                activeTasks: totalTasks - completedTasks,
                totalRoles: 0,
                roles: []
            };

        } catch (error) {
            console.error("Dashboard: Error loading holon stats:", error);
        } finally {
            isLoadingStats = false;
        }
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
        loadHolonStats();
        loadTodaysEvents();
        loadTopTasks();
    }
    
    // Watch for sort changes to reload tasks
    $: if ($taskSortStore && isVisible && holonID) {
        loadTopTasks();
    }

    onMount(() => {
        // Update time every second
        timeInterval = setInterval(() => {
            currentTime = new Date();
        }, 1000);

        // Load initial data if visible
        if (isVisible) {
            if (holonID) {
            loadHolonStats();
                loadTodaysEvents();
                loadTopTasks();
            }
            fetchWeather();
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
        if (timeInterval) {
            clearInterval(timeInterval);
        }
        if (inactivityTimer) {
            clearTimeout(inactivityTimer);
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

    // Calculate completion percentage
    $: completionPercentage = holonStats.totalTasks > 0 ? 
        Math.round((holonStats.completedTasks / holonStats.totalTasks) * 100) : 0;
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
        aria-labelledby="dashboard-title"
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
            <div class="h-full p-8 flex flex-col">
                <!-- Top Section: Date and Weather -->
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

                    <!-- Weather Section -->
                    <div class="text-right">
                        {#if isLoadingWeather}
                            <div class="flex items-center justify-end">
                                <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-white/50 mr-3"></div>
                                <span class="text-white/60">Loading weather...</span>
                            </div>
                        {:else if weatherData}
                            <div class="flex items-center justify-end space-x-4">
                                <div class="text-right">
                                    <div class="text-4xl font-light text-white">
                                        {weatherData.temperature}°{weatherData.unit === '°C' ? 'C' : 'F'}
                                    </div>
                                    <div class="text-white/60">
                                        Wind: {weatherData.windSpeed} km/h
                                    </div>
                                </div>
                                <div class="text-6xl">
                                    {getWeatherIcon(weatherData.weatherCode)}
                                </div>
                            </div>
                        {:else}
                            <div class="text-white/60">
                                Weather unavailable
                            </div>
                        {/if}
                    </div>
                </div>

                <!-- Center Section: Prominent Digital Clock -->
                <div class="flex-1 flex flex-col items-center justify-center">
                    <!-- Large Digital Clock -->
                    <div class="text-center mb-12">
                        <div class="text-8xl md:text-9xl lg:text-[10rem] font-light text-white tracking-wider mb-4 drop-shadow-2xl">
                            {formatTime(currentTime)}
                        </div>
                        <div class="text-lg text-white/50 font-mono tracking-wider">
                            {formatTimeSeconds(currentTime)}
                        </div>
                    </div>

                    <!-- Events and Tasks Grid -->
                    <div class="w-full max-w-5xl grid md:grid-cols-2 gap-8">
                        <!-- Today's Events -->
                        <div class="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
                                <h3 class="text-xl font-semibold text-white mb-4 flex items-center">
                                <svg class="w-6 h-6 mr-3 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                Today's Events
                                </h3>
                                
                            {#if isLoadingEvents}
                                <div class="flex items-center py-4">
                                    <div class="animate-spin rounded-full h-5 w-5 border-b-2 border-white/50 mr-3"></div>
                                    <span class="text-white/60 text-sm">Loading events...</span>
                                    </div>
                            {:else if todaysEvents.length > 0}
                                <div class="space-y-3">
                                    {#each todaysEvents as event}
                                        <div class="bg-white/5 rounded-lg p-3 border border-white/10">
                                            <div class="flex justify-between items-start mb-1">
                                                <h4 class="font-medium text-white text-sm truncate flex-1 pr-2">
                                                    {event.title}
                                                </h4>
                                                <span class="text-xs text-indigo-300 font-mono whitespace-nowrap">
                                                    {event.time}
                                                </span>
                                    </div>
                                            {#if event.description}
                                                <p class="text-xs text-white/60 truncate">
                                                    {event.description}
                                                </p>
                                            {/if}
                                        </div>
                                    {/each}
                                        </div>
                            {:else}
                                <div class="text-center py-6">
                                    <svg class="w-12 h-12 text-white/30 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                    <p class="text-white/50 text-sm">No events today</p>
                                </div>
                            {/if}
                            </div>

                        <!-- Top Tasks -->
                        <div class="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
                                <h3 class="text-xl font-semibold text-white mb-4 flex items-center">
                                <svg class="w-6 h-6 mr-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                                    </svg>
                                Top Tasks
                                </h3>
                                
                            {#if isLoadingTasks}
                                <div class="flex items-center py-4">
                                    <div class="animate-spin rounded-full h-5 w-5 border-b-2 border-white/50 mr-3"></div>
                                    <span class="text-white/60 text-sm">Loading tasks...</span>
                                        </div>
                            {:else if topTasks.length > 0}
                                <div class="space-y-3">
                                    {#each topTasks as task}
                                        <div class="bg-white/5 rounded-lg p-3 border border-white/10">
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
                            {:else}
                                <div class="text-center py-6">
                                    <svg class="w-12 h-12 text-white/30 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                                    </svg>
                                    <p class="text-white/50 text-sm">No active tasks</p>
                                </div>
                            {/if}
                        </div>
                    </div>
                </div>
                                    
                <!-- Bottom Section: Holon Info (simplified) -->
                {#if holonName !== "Loading..." && !isLoadingStats}
                    <div class="mt-8 flex justify-center">
                        <div class="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
                            <div class="text-center">
                                <div class="text-white/80 text-lg mb-2">
                                    {holonName}
                                    </div>
                                {#if holonStats.totalTasks > 0}
                                    <div class="flex items-center justify-center space-x-6 text-sm">
                                        <div class="flex items-center space-x-2">
                                            <div class="w-3 h-3 bg-green-400 rounded-full"></div>
                                            <span class="text-white/60">{holonStats.completedTasks} completed</span>
                                        </div>
                                        <div class="flex items-center space-x-2">
                                            <div class="w-3 h-3 bg-yellow-400 rounded-full"></div>
                                            <span class="text-white/60">{holonStats.activeTasks} active</span>
                                        </div>
                                    </div>
                                    {/if}
                                </div>
                            </div>
                        </div>
                    {/if}

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

<style>
    kbd {
        box-shadow: inset 0 -1px 0 rgba(255, 255, 255, 0.1);
    }
</style>
