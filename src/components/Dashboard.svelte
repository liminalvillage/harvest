<script lang="ts">
    import { onMount, getContext } from "svelte";
    import { ID } from "../dashboard/store";
    import { page } from "$app/stores";
    import Announcements from "./Announcements.svelte";

    // Initialize holosphere
    const holosphere = getContext("holosphere");
    let holonID: string = $page.params.id;
    let unsubscribe: () => void;

    let chatCount = 0;
    let userCount = 0;
    let completedTaskCount = 0;
    let openTaskCount = 0;
    let recentEventCount = 0;
    let shoppingItemCount = 0;

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

            chatCount = Object.keys(chats).length;
            userCount = Object.keys(users).length;
            shoppingItemCount = Object.keys(shoppingItems).length;

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
            <a
                href={`/${holonID}/chats`}
                class="bg-blue-500 p-6 rounded-lg text-white"
            >
                <h3 class="text-xl font-semibold mb-2">Chats</h3>
                <p class="text-3xl font-bold">{chatCount}</p>
            </a>
            <a
                href={`/${holonID}/status`}
                class="bg-green-500 p-6 rounded-lg text-white"
            >
                <h3 class="text-xl font-semibold mb-2">Users</h3>
                <p class="text-3xl font-bold">{userCount}</p>
            </a>
            <a
                href={`/${holonID}/kanban`}
                class="bg-yellow-500 p-6 rounded-lg text-white"
            >
                <h3 class="text-xl font-semibold mb-2">Tasks</h3>
                <p class="text-3xl font-bold">
                    {completedTaskCount} / {openTaskCount + completedTaskCount}
                </p>
                <p class="text-sm">Completed / Total</p>
            </a>
            <a
                href={`/${holonID}/schedule`}
                class="bg-purple-500 p-6 rounded-lg text-white"
            >
                <h3 class="text-xl font-semibold mb-2">Recent Events</h3>
                <p class="text-3xl font-bold">{recentEventCount}</p>
                <p class="text-sm">Last 7 days</p>
            </a>
            <a
                href={`/${holonID}/shopping`}
                class="bg-red-500 p-6 rounded-lg text-white"
            >
                <h3 class="text-xl font-semibold mb-2">Shopping Items</h3>
                <p class="text-3xl font-bold">{shoppingItemCount}</p>
            </a>
        </div>
    </div>
    <Announcements />
</div>
