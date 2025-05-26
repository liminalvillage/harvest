<script lang="ts">
    import { onMount, getContext } from "svelte";
    import { ID } from "../dashboard/store";
    import { page } from "$app/stores";
    import Announcements from "./Announcements.svelte";
    import HoloSphere from 'holosphere';


    // Initialize holosphere
    const holosphere = getContext("holosphere") as HoloSphere;
    let holonID: string = $page.params.id;
    let unsubscribe: () => void;

    let chatCount = 0;
    let userCount = 0;
    let completedTaskCount = 0;
    let openTaskCount = 0;
    let recentEventCount = 0;
    let shoppingItemCount = 0;
    let offerCount = 0;
    let checklistCount = 0;
    let completedChecklistCount = 0;
    let roleCount = 0;
    let unassignedRoleCount = 0;

    let holonPurpose: string | null = null; // Variable to store the holon's purpose

    onMount(() => {
        // Set up subscription to ID store
        unsubscribe = ID.subscribe((value) => {
            if (value) {
                holonID = value;
                fetchData();
            }
        });

        // Initial fetch if we have an ID
        if (holonID) {
            fetchData();
        }

        // Cleanup subscription on unmount
        return () => {
            if (unsubscribe) unsubscribe();
        };
    });

    // Watch for page ID changes
    $: {
        const newId = $page.params.id;
        if (newId && newId !== holonID) {
            holonID = newId;
            if (holosphere) {
                fetchData();
            }
        }
    }

    async function fetchData() {
        if (!holonID || !holosphere) return;
        
        try {
            const chats = (await holosphere.getAll(holonID, "chats")) || {};
            const users = (await holosphere.getAll(holonID, "users")) || {};
            const tasks = (await holosphere.getAll(holonID, "quests")) || {};
            const events = (await holosphere.getAll(holonID, "events")) || {};
            const shoppingItems = (await holosphere.getAll(holonID, "shopping")) || {};
            const offers = (await holosphere.getAll(holonID, "offers")) || {};
            const checklists = (await holosphere.getAll(holonID, "checklists")) || {};
            const roles = (await holosphere.getAll(holonID, "roles")) || {};

            // Fetch holon purpose from config
            const configData = await holosphere.get(holonID, "settings", holonID);
            if (configData && typeof configData === 'object' && configData.purpose) {
                holonPurpose = configData.purpose;
            } else {
                holonPurpose = null; // Ensure it's null if not found or not a string
            }

            chatCount = Object.keys(chats).length;
            userCount = Object.keys(users).length;
            shoppingItemCount = Object.keys(shoppingItems).length;
            offerCount = Object.keys(offers).length;
            checklistCount = Object.keys(checklists).length;
            completedChecklistCount = Object.values(checklists).filter(
                (checklist: any) => checklist.completed === true
            ).length;

            roleCount = Object.keys(roles).length;
            unassignedRoleCount = Object.values(roles).filter(
                (role: any) => !role.participants || role.participants.length === 0
            ).length;

            completedTaskCount = Object.values(tasks).filter(
                (task: any) => task.status === "completed"
            ).length;
            openTaskCount = Object.values(tasks).filter(
                (task: any) => task.status !== "completed"
            ).length;

            const oneWeekAgo = new Date();
            oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
            recentEventCount = Object.values(events).filter(
                (event: any) => new Date(event.when) >= oneWeekAgo
            ).length;
        } catch (error) {
            console.error('Error fetching dashboard data:', error);
        }
    }
</script>

<div class="flex flex-wrap">
    <div class="w-full lg:w-8/12 bg-gray-800 py-6 px-6 rounded-3xl">
        <div class="flex justify-between text-white items-center mb-2">
            <p class="text-2xl font-bold">Dashboard Overview</p>
            <p class="">{new Date().toDateString()}</p>
        </div>
        {#if holonPurpose}
            <p class="text-lg text-gray-400 italic mt-1 mb-6 text-center">{holonPurpose}</p>
        {/if}

        <div class="grid grid-cols-2 md:grid-cols-3 gap-6">
            <!-- <a
                href={`/${holonID}/chats`}
                class="bg-blue-500 p-6 rounded-lg text-white relative overflow-hidden"
            >
                <i class="fas fa-comments text-6xl absolute bottom-0 right-0 transform translate-x-2 translate-y-2 opacity-20"></i>
                <h3 class="text-xl font-semibold mb-2">Chats</h3>
                <p class="text-3xl font-bold">{chatCount}</p>
            </a> -->
            <a
                href={`/${holonID}/status`}
                class="bg-green-500 p-6 rounded-lg text-white relative overflow-hidden"
            >
                <i class="fas fa-users text-6xl absolute bottom-0 right-0 transform translate-x-2 translate-y-2 opacity-20"></i>
                <h3 class="text-xl font-semibold mb-2">Users</h3>
                <p class="text-3xl font-bold">{userCount}</p>
            </a>
            <a
                href={`/${holonID}/tasks`}
                class="bg-yellow-500 p-6 rounded-lg text-white relative overflow-hidden"
            >
                <i class="fas fa-tasks text-6xl absolute bottom-0 right-0 transform translate-x-2 translate-y-2 opacity-20"></i>
                <h3 class="text-xl font-semibold mb-2">Tasks</h3>
                <p class="text-3xl font-bold">
                    {completedTaskCount} / {openTaskCount + completedTaskCount}
                </p>
                <p class="text-sm">Completed / Total</p>
            </a>
            <a
                href={`/${holonID}/schedule`}
                class="bg-purple-500 p-6 rounded-lg text-white relative overflow-hidden"
            >
                <i class="fas fa-calendar-alt text-6xl absolute bottom-0 right-0 transform translate-x-2 translate-y-2 opacity-20"></i>
                <h3 class="text-xl font-semibold mb-2">Recent Events</h3>
                <p class="text-3xl font-bold">{recentEventCount}</p>
                <p class="text-sm">Last 7 days</p>
            </a>
            <a
                href={`/${holonID}/shopping`}
                class="bg-red-500 p-6 rounded-lg text-white relative overflow-hidden"
            >
                <i class="fas fa-shopping-cart text-6xl absolute bottom-0 right-0 transform translate-x-2 translate-y-2 opacity-20"></i>
                <h3 class="text-xl font-semibold mb-2">Shopping Items</h3>
                <p class="text-3xl font-bold">{shoppingItemCount}</p>
            </a>
            <a
                href={`/${holonID}/offers`}
                class="bg-indigo-500 p-6 rounded-lg text-white relative overflow-hidden"
            >
                <i class="fas fa-gift text-6xl absolute bottom-0 right-0 transform translate-x-2 translate-y-2 opacity-20"></i>
                <h3 class="text-xl font-semibold mb-2">Active Offers</h3>
                <p class="text-3xl font-bold">{offerCount}</p>
            </a>
            <a
                href={`/${holonID}/checklists`}
                class="bg-teal-500 p-6 rounded-lg text-white relative overflow-hidden"
            >
                <i class="fas fa-clipboard-check text-6xl absolute bottom-0 right-0 transform translate-x-2 translate-y-2 opacity-20"></i>
                <h3 class="text-xl font-semibold mb-2">Checklists</h3>
                <p class="text-3xl font-bold">
                    {completedChecklistCount} / {checklistCount}
                </p>
                <p class="text-sm">Completed / Total</p>
            </a>
            <a
                href={`/${holonID}/roles`}
                class="bg-cyan-500 p-6 rounded-lg text-white relative overflow-hidden"
            >
                <i class="fas fa-user-tag text-6xl absolute bottom-0 right-0 transform translate-x-2 translate-y-2 opacity-20"></i>
                <h3 class="text-xl font-semibold mb-2">Roles</h3>
                <p class="text-3xl font-bold">{roleCount}</p>
                <p class="text-sm">{unassignedRoleCount} Unassigned</p>
            </a>
        </div>
    </div>
    <Announcements />
</div>
