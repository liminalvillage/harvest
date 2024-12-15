<script lang="ts">
    import { onMount, getContext } from "svelte";
    import { ID } from "../dashboard/store";
    import { page } from "$app/stores";
    import Announcements from "./Announcements.svelte";
    import HoloSphere from 'holosphere';
    import Offers from "./Offers.svelte";

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

            chatCount = Object.keys(chats).length;
            userCount = Object.keys(users).length;
            shoppingItemCount = Object.keys(shoppingItems).length;
            offerCount = Object.keys(offers).length;
            checklistCount = Object.keys(checklists).length;
            completedChecklistCount = Object.values(checklists).filter(
                (checklist: any) => checklist.completed === true
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
        <div class="flex justify-between text-white items-center mb-8">
            <p class="text-2xl font-bold">Dashboard Overview</p>
            <p class="">{new Date().toDateString()}</p>
        </div>

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
        </div>
    </div>
    <Announcements />
</div>
