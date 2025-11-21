<script lang="ts">
    import { onMount, getContext } from "svelte";
    import { ID } from "../dashboard/store";
    import { page } from "$app/stores";
    import { goto } from "$app/navigation";
    import Announcements from "./Announcements.svelte";
    import HoloSphere from 'holosphere';
    import { fetchHolonName } from "../utils/holonNames";

    // Dashboard card interface
    interface DashboardCard {
        id: string;
        title: string;
        href: string;
        icon: string;
        colorClasses: {
            bg: string;
            bgOpacity: string;
            text: string;
            textHover: string;
            progress: string;
        };
        gradient: string;
        description?: string;
        count?: () => number | string;
        subtext?: () => string;
        showProgress?: boolean;
        progressPercent?: () => number;
    }

    // Helper to get color classes
    function getColorClasses(baseColor: string) {
        const colorMap: Record<string, any> = {
            'green': {
                bg: 'bg-green-500',
                bgOpacity: 'bg-green-500 bg-opacity-20',
                text: 'text-green-400',
                textHover: 'group-hover:text-green-400',
                progress: 'bg-green-500'
            },
            'blue': {
                bg: 'bg-blue-500',
                bgOpacity: 'bg-blue-500 bg-opacity-20',
                text: 'text-blue-400',
                textHover: 'group-hover:text-blue-400',
                progress: 'bg-blue-500'
            },
            'cyan': {
                bg: 'bg-cyan-500',
                bgOpacity: 'bg-cyan-500 bg-opacity-20',
                text: 'text-cyan-400',
                textHover: 'group-hover:text-cyan-400',
                progress: 'bg-cyan-500'
            },
            'emerald': {
                bg: 'bg-emerald-500',
                bgOpacity: 'bg-emerald-500 bg-opacity-20',
                text: 'text-emerald-400',
                textHover: 'group-hover:text-emerald-400',
                progress: 'bg-emerald-500'
            },
            'red': {
                bg: 'bg-red-500',
                bgOpacity: 'bg-red-500 bg-opacity-20',
                text: 'text-red-400',
                textHover: 'group-hover:text-red-400',
                progress: 'bg-red-500'
            },
            'amber': {
                bg: 'bg-amber-500',
                bgOpacity: 'bg-amber-500 bg-opacity-20',
                text: 'text-amber-400',
                textHover: 'group-hover:text-amber-400',
                progress: 'bg-amber-500'
            },
            'yellow': {
                bg: 'bg-yellow-500',
                bgOpacity: 'bg-yellow-500 bg-opacity-20',
                text: 'text-yellow-400',
                textHover: 'group-hover:text-yellow-400',
                progress: 'bg-yellow-500'
            },
            'indigo': {
                bg: 'bg-indigo-500',
                bgOpacity: 'bg-indigo-500 bg-opacity-20',
                text: 'text-indigo-400',
                textHover: 'group-hover:text-indigo-400',
                progress: 'bg-indigo-500'
            },
            'teal': {
                bg: 'bg-teal-500',
                bgOpacity: 'bg-teal-500 bg-opacity-20',
                text: 'text-teal-400',
                textHover: 'group-hover:text-teal-400',
                progress: 'bg-teal-500'
            },
            'orange': {
                bg: 'bg-orange-500',
                bgOpacity: 'bg-orange-500 bg-opacity-20',
                text: 'text-orange-400',
                textHover: 'group-hover:text-orange-400',
                progress: 'bg-orange-500'
            }
        };
        return colorMap[baseColor] || colorMap['green'];
    }

    // Initialize holosphere
    const holosphere = getContext("holosphere") as HoloSphere;
    let holonID: string = $page.params.id;
    let unsubscribe: () => void;
    let isLoading = true;
    let connectionReady = false;

    let chatCount = 0;
    let userCount = 0;
    let completedTaskCount = 0;
    let openTaskCount = 0;
    let proposalCount = 0;
    let shoppingItemCount = 0;
    let offerCount = 0;
    let checklistCount = 0;
    let completedChecklistCount = 0;
    let roleCount = 0;
    let unassignedRoleCount = 0;

    // Drag and drop state
    let draggedCard: string | null = null;
    let draggedFromRow: 'primary' | 'secondary' | null = null;

    onMount(() => {
        // Initialize with URL parameter first
        const urlId = $page.params.id;
        if (urlId && urlId !== 'undefined' && urlId !== 'null' && urlId.trim() !== '') {
            holonID = urlId;
            // Update the ID store to keep them in sync
            ID.set(urlId);
        }

        // Wait for holosphere to be ready before proceeding
        const checkConnection = async () => {
            if (!holosphere) {
                setTimeout(checkConnection, 100);
                return;
            }
            
            // Add a small delay to ensure the connection is stable
            await new Promise(resolve => setTimeout(resolve, 200));
            connectionReady = true;
            
            // Set up subscription to ID store with debouncing
            let updateTimeout: NodeJS.Timeout;
            unsubscribe = ID.subscribe((value) => {
                if (value && value !== 'undefined' && value !== 'null' && value.trim() !== '') {
                    // Clear any pending update
                    if (updateTimeout) clearTimeout(updateTimeout);
                    
                    // Debounce the update to avoid rapid changes
                    updateTimeout = setTimeout(() => {
                        if (value !== holonID) {
                            holonID = value;
                            fetchData();
                        }
                    }, 100);
                }
            });

            // Initial fetch if we have an ID
            if (holonID && holonID !== 'undefined' && holonID !== 'null' && holonID.trim() !== '') {
                fetchData();
            }
        };
        
        checkConnection();

        // Cleanup subscription on unmount
        return () => {
            if (unsubscribe) unsubscribe();
        };
    });

    // Watch for page ID changes with debouncing
    let pageUpdateTimeout: NodeJS.Timeout;
    $: {
        const newId = $page.params.id;
        if (newId && newId !== holonID && connectionReady) {
            // Check if the new ID is valid
            if (newId !== 'undefined' && newId !== 'null' && newId.trim() !== '') {
                // Clear any pending update
                if (pageUpdateTimeout) clearTimeout(pageUpdateTimeout);
                
                // Debounce the update to avoid rapid changes
                pageUpdateTimeout = setTimeout(() => {
                    holonID = newId;
                    // Update the ID store to keep them in sync
                    ID.set(newId);
                    if (holosphere) {
                        fetchData();
                    }
                }, 100);
            }
        }
    }

    async function fetchData(retryCount = 0) {
        if (!holonID || !holosphere || !connectionReady || holonID === 'undefined' || holonID === 'null' || holonID.trim() === '') {
            // Don't redirect - just return without fetching data
            return;
        }
        
        // Reset all counters to 0 before fetching new data
        chatCount = 0;
        userCount = 0;
        completedTaskCount = 0;
        openTaskCount = 0;
        proposalCount = 0;
        shoppingItemCount = 0;
        offerCount = 0;
        checklistCount = 0;
        completedChecklistCount = 0;
        roleCount = 0;
        unassignedRoleCount = 0;
        
        isLoading = true;
        
        try {
            // Fetch all data in parallel with timeouts
            const fetchWithTimeout = async (promise: Promise<any>, timeoutMs: number = 5000) => {
                const timeoutPromise = new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Timeout')), timeoutMs)
                );
                return Promise.race([promise, timeoutPromise]);
            };

            // Fetch all data in parallel with individual timeouts
            const [chats, users, quests, shoppingItems, checklists, roles] = await Promise.allSettled([
                fetchWithTimeout(holosphere.getAll(holonID, "chats"), 5000),
                fetchWithTimeout(holosphere.getAll(holonID, "users"), 5000),
                fetchWithTimeout(holosphere.getAll(holonID, "quests"), 5000),
                fetchWithTimeout(holosphere.getAll(holonID, "shopping"), 5000),
                fetchWithTimeout(holosphere.getAll(holonID, "checklists"), 5000),
                fetchWithTimeout(holosphere.getAll(holonID, "roles"), 5000),
            ]);

            // Process results safely
            const chatsData = chats.status === 'fulfilled' ? (chats.value || {}) : {};
            const usersData = users.status === 'fulfilled' ? (users.value || {}) : {};
            const questsData = quests.status === 'fulfilled' ? (quests.value || {}) : {};
            const shoppingData = shoppingItems.status === 'fulfilled' ? (shoppingItems.value || {}) : {};
            const checklistsData = checklists.status === 'fulfilled' ? (checklists.value || {}) : {};
            const rolesData = roles.status === 'fulfilled' ? (roles.value || {}) : {};

            // Calculate statistics
            chatCount = Object.keys(chatsData).length;
            userCount = Object.keys(usersData).length;
            shoppingItemCount = Object.keys(shoppingData).length;
            
            // Count offers and requests from quests lens
            const questValues = Object.values(questsData);
            const offersAndRequests = questValues.filter((item: any) => {
                const type = item.type || 'task';
                return type === 'offer' || type === 'request' || type === 'need';
            });
            offerCount = offersAndRequests.length;
            
            checklistCount = Object.keys(checklistsData).length;
            completedChecklistCount = Object.values(checklistsData).filter(
                (checklist: any) => checklist.completed === true
            ).length;

            roleCount = Object.keys(rolesData).length;
            unassignedRoleCount = Object.values(rolesData).filter(
                (role: any) => !role.participants || role.participants.length === 0
            ).length;

            // Process quests to separate tasks and proposals
            proposalCount = questValues.filter((item: any) => item.type === "proposal").length;

            const actualTasks = questValues.filter((item: any) => {
                const type = item.type || 'task';
                return type === 'task' || type === 'recurring';
            });
            completedTaskCount = actualTasks.filter((task: any) => task.status === "completed").length;
            openTaskCount = actualTasks.filter((task: any) => task.status !== "completed").length;

        } catch (error: any) {
            console.error('Error fetching dashboard data:', error);
            
            // Retry on network errors up to 3 times with exponential backoff
            if (retryCount < 3) {
                const delay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
                console.log(`Retrying data fetch in ${delay}ms (attempt ${retryCount + 1}/3)`);
                setTimeout(() => fetchData(retryCount + 1), delay);
                return;
            }
        } finally {
            isLoading = false;
        }
    }

    // Define all available dashboard cards
    const allCards: Record<string, DashboardCard> = {
        users: {
            id: 'users',
            title: 'Users',
            href: `/${holonID}/status`,
            icon: 'fas fa-users',
            colorClasses: getColorClasses('green'),
            gradient: 'from-green-500/10 to-green-600/5',
            description: 'View rankings & stats',
            count: () => userCount,
            subtext: () => 'Active Users'
        },
        tasks: {
            id: 'tasks',
            title: 'Tasks',
            href: `/${holonID}/tasks`,
            icon: 'fas fa-tasks',
            colorClasses: getColorClasses('blue'),
            gradient: 'from-blue-500/10 to-blue-600/5',
            count: () => `${completedTaskCount}/${openTaskCount + completedTaskCount}`,
            subtext: () => 'Completed',
            showProgress: true,
            progressPercent: () => Math.round((completedTaskCount / (openTaskCount + completedTaskCount || 1)) * 100)
        },
        roles: {
            id: 'roles',
            title: 'Roles',
            href: `/${holonID}/roles`,
            icon: 'fas fa-user-tag',
            colorClasses: getColorClasses('cyan'),
            gradient: 'from-cyan-500/10 to-cyan-600/5',
            description: 'Active roles',
            count: () => roleCount,
            subtext: () => `${unassignedRoleCount} Unassigned`
        },
        settings: {
            id: 'settings',
            title: 'Settings',
            href: `/${holonID}/settings`,
            icon: 'fas fa-cog',
            colorClasses: getColorClasses('emerald'),
            gradient: 'from-emerald-500/10 to-emerald-600/5',
            description: 'Configure holon'
        },
        shopping: {
            id: 'shopping',
            title: 'Shopping',
            href: `/${holonID}/shopping`,
            icon: 'fas fa-shopping-cart',
            colorClasses: getColorClasses('red'),
            gradient: 'from-red-500/10 to-red-600/5',
            count: () => shoppingItemCount
        },
        expenses: {
            id: 'expenses',
            title: 'Expenses',
            href: `/${holonID}/expenses`,
            icon: 'fas fa-coins',
            colorClasses: getColorClasses('amber'),
            gradient: 'from-amber-500/10 to-amber-600/5',
            description: 'Track spending'
        },
        proposals: {
            id: 'proposals',
            title: 'Proposals',
            href: `/${holonID}/proposals`,
            icon: 'fas fa-lightbulb',
            colorClasses: getColorClasses('yellow'),
            gradient: 'from-yellow-500/10 to-yellow-600/5',
            count: () => proposalCount
        },
        offers: {
            id: 'offers',
            title: 'Offers & Requests',
            href: `/${holonID}/offers`,
            icon: 'fas fa-gift',
            colorClasses: getColorClasses('indigo'),
            gradient: 'from-indigo-500/10 to-indigo-600/5',
            count: () => offerCount
        },
        checklists: {
            id: 'checklists',
            title: 'Checklists',
            href: `/${holonID}/checklists`,
            icon: 'fas fa-clipboard-check',
            colorClasses: getColorClasses('teal'),
            gradient: 'from-teal-500/10 to-teal-600/5',
            count: () => `${completedChecklistCount}/${checklistCount}`,
            showProgress: true,
            progressPercent: () => (completedChecklistCount / (checklistCount || 1)) * 100
        },
        federation: {
            id: 'federation',
            title: 'Federation',
            href: `/${holonID}/federation`,
            icon: 'fas fa-network-wired',
            colorClasses: getColorClasses('orange'),
            gradient: 'from-orange-500/10 to-orange-600/5',
            description: 'Configure data sharing'
        }
    };

    // Default layout
    const defaultPrimaryCards = ['users', 'tasks', 'roles', 'settings'];
    const defaultSecondaryCards = ['shopping', 'expenses', 'proposals', 'offers', 'checklists', 'federation'];

    // Load layout from localStorage or use defaults
    let primaryCards: string[] = [];
    let secondaryCards: string[] = [];

    function loadLayout() {
        if (typeof window === 'undefined') return;

        const storageKey = `dashboard-layout-${holonID}`;
        const saved = localStorage.getItem(storageKey);

        if (saved) {
            try {
                const layout = JSON.parse(saved);
                // Validate that saved cards exist in allCards
                const validPrimary = (layout.primary || []).filter((id: string) => allCards[id]);
                const validSecondary = (layout.secondary || []).filter((id: string) => allCards[id]);

                // Use validated cards or defaults if empty
                primaryCards = validPrimary.length > 0 ? validPrimary : [...defaultPrimaryCards];
                secondaryCards = validSecondary.length > 0 ? validSecondary : [...defaultSecondaryCards];
            } catch (e) {
                primaryCards = [...defaultPrimaryCards];
                secondaryCards = [...defaultSecondaryCards];
            }
        } else {
            primaryCards = [...defaultPrimaryCards];
            secondaryCards = [...defaultSecondaryCards];
        }
    }

    function saveLayout() {
        if (typeof window === 'undefined') return;

        const storageKey = `dashboard-layout-${holonID}`;
        const layout = {
            primary: primaryCards,
            secondary: secondaryCards
        };
        localStorage.setItem(storageKey, JSON.stringify(layout));
    }

    // Drag and drop handlers
    function handleDragStart(e: DragEvent, cardId: string, row: 'primary' | 'secondary') {
        draggedCard = cardId;
        draggedFromRow = row;
        if (e.dataTransfer) {
            e.dataTransfer.effectAllowed = 'move';
        }
    }

    function handleDragOver(e: DragEvent) {
        e.preventDefault();
        if (e.dataTransfer) {
            e.dataTransfer.dropEffect = 'move';
        }
    }

    function handleDrop(e: DragEvent, targetCardId: string, targetRow: 'primary' | 'secondary') {
        e.preventDefault();

        if (!draggedCard || !draggedFromRow) return;

        // Remove card from source row
        if (draggedFromRow === 'primary') {
            primaryCards = primaryCards.filter(id => id !== draggedCard);
        } else {
            secondaryCards = secondaryCards.filter(id => id !== draggedCard);
        }

        // Add card to target row at the position of targetCardId
        if (targetRow === 'primary') {
            const targetIndex = primaryCards.indexOf(targetCardId);
            primaryCards = [
                ...primaryCards.slice(0, targetIndex),
                draggedCard,
                ...primaryCards.slice(targetIndex)
            ];
        } else {
            const targetIndex = secondaryCards.indexOf(targetCardId);
            secondaryCards = [
                ...secondaryCards.slice(0, targetIndex),
                draggedCard,
                ...secondaryCards.slice(targetIndex)
            ];
        }

        saveLayout();
        draggedCard = null;
        draggedFromRow = null;
    }

    function handleDragEnd() {
        draggedCard = null;
        draggedFromRow = null;
    }

    function resetLayout() {
        primaryCards = [...defaultPrimaryCards];
        secondaryCards = [...defaultSecondaryCards];
        saveLayout();
    }

    // Load layout when holon changes
    $: if (holonID) {
        loadLayout();
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
<div class="space-y-8">
    <!-- Reset Button -->
    <div class="flex justify-end">
        <button
            on:click={resetLayout}
            class="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors text-sm flex items-center gap-2"
        >
            <i class="fas fa-undo"></i>
            Reset Layout
        </button>
    </div>

    <!-- Primary Stats Grid -->
    <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {#each primaryCards as cardId (cardId)}
            {@const card = allCards[cardId]}
            <a
                href={card.href}
                draggable="true"
                on:dragstart={(e) => handleDragStart(e, cardId, 'primary')}
                on:dragover={handleDragOver}
                on:drop={(e) => handleDrop(e, cardId, 'primary')}
                on:dragend={handleDragEnd}
                class="group bg-gray-800 hover:bg-gray-750 transition-all duration-300 p-8 rounded-2xl shadow-xl hover:shadow-2xl transform hover:scale-105 relative overflow-hidden cursor-move"
                class:opacity-50={draggedCard === cardId}
            >
                <div class="absolute inset-0 bg-gradient-to-br {card.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <div class="relative z-10">
                    <div class="flex items-center justify-between mb-4">
                        <div class="p-3 {card.colorClasses.bgOpacity} rounded-xl">
                            <i class="{card.icon} text-2xl {card.colorClasses.text}"></i>
                        </div>
                        {#if card.count}
                            <div class="text-right">
                                <p class="text-3xl font-bold text-white">{card.count()}</p>
                                {#if card.subtext}
                                    <p class="text-sm text-gray-400">{card.subtext()}</p>
                                {/if}
                            </div>
                        {/if}
                    </div>
                    <h3 class="text-xl font-semibold text-white {card.colorClasses.textHover} transition-colors">{card.title}</h3>
                    {#if card.description}
                        <p class="text-gray-400 text-sm mt-1">{card.description}</p>
                    {/if}
                    {#if card.showProgress}
                        <div class="mt-2">
                            <div class="flex justify-between text-sm text-gray-400 mb-1">
                                <span>Progress</span>
                                <span>{card.progressPercent()}%</span>
                            </div>
                            <div class="w-full bg-gray-700 rounded-full h-2">
                                <div class="{card.colorClasses.progress} h-2 rounded-full transition-all duration-500" style="width: {card.progressPercent()}%"></div>
                            </div>
                        </div>
                    {/if}
                </div>
            </a>
        {/each}
    </div>

    <!-- Secondary Stats Grid -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
        {#each secondaryCards as cardId (cardId)}
            {@const card = allCards[cardId]}
            <a
                href={card.href}
                draggable="true"
                on:dragstart={(e) => handleDragStart(e, cardId, 'secondary')}
                on:dragover={handleDragOver}
                on:drop={(e) => handleDrop(e, cardId, 'secondary')}
                on:dragend={handleDragEnd}
                class="group bg-gray-800 hover:bg-gray-750 transition-all duration-300 p-6 rounded-2xl shadow-xl hover:shadow-2xl transform hover:scale-105 relative overflow-hidden cursor-move"
                class:opacity-50={draggedCard === cardId}
            >
                <div class="absolute inset-0 bg-gradient-to-br {card.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <div class="relative z-10">
                    <div class="flex items-center space-x-4">
                        <div class="p-3 {card.colorClasses.bgOpacity} rounded-xl">
                            <i class="{card.icon} text-xl {card.colorClasses.text}"></i>
                        </div>
                        <div class="flex-1">
                            <h3 class="text-lg font-semibold text-white {card.colorClasses.textHover} transition-colors">{card.title}</h3>
                            {#if card.count}
                                <p class="text-2xl font-bold text-white">{card.count()}</p>
                            {/if}
                            {#if card.description}
                                <p class="text-sm text-gray-400">{card.description}</p>
                            {/if}
                            {#if card.showProgress}
                                <div class="mt-1">
                                    <div class="w-full bg-gray-700 rounded-full h-1.5">
                                        <div class="{card.colorClasses.progress} h-1.5 rounded-full transition-all duration-500" style="width: {card.progressPercent()}%"></div>
                                    </div>
                                </div>
                            {/if}
                        </div>
                    </div>
                </div>
            </a>
        {/each}
    </div>

    <!-- Announcements Section -->
    <div class="bg-gray-800 rounded-3xl shadow-xl">
        <Announcements />
    </div>
</div>
{/if}
