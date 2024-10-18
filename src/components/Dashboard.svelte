<script lang="ts">
    import { onMount, getContext } from 'svelte';
    import { ID } from '../dashboard/store';
    import HoloSphere from 'holosphere';
    import Announcements from './Announcements.svelte';

    let holosphere = getContext('holosphere') || new HoloSphere('Holons');
    $: holonID = $ID;

    let chatCount = 0;
    let userCount = 0;
    let completedTaskCount = 0;
    let openTaskCount = 0;
    let recentEventCount = 0;
    let shoppingItemCount = 0;

    onMount(async () => {
        await fetchData();
    });

    ID.subscribe((value) => {
        holonID = value;
        fetchData();
    });

    async function fetchData() {
        let holons = await holosphere.get('','settings')
        console.log(await Promise.all(holons.map(async function (holon: any) { return holon.id })))

        // Fetch data from HoloSphere
        const chats = await holosphere.get(holonID, 'chats') || {};
        const users = await holosphere.get(holonID, 'users') || {};
        const tasks = await holosphere.get(holonID, 'quests') || {};
        const events = await holosphere.get(holonID, 'events') || {};
        const shoppingItems = await holosphere.get(holonID, 'shopping') || {};

        chatCount = Object.keys(chats).length;
        userCount = Object.keys(users).length;
        shoppingItemCount = Object.keys(shoppingItems).length;

        completedTaskCount = Object.values(tasks).filter((task: any) => task.status === 'completed').length;
        openTaskCount = Object.values(tasks).filter((task: any) => task.status !== 'completed').length;

        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        recentEventCount = Object.values(events).filter((event: any) => new Date(event.when) >= oneWeekAgo).length;
    }
</script>

<div class="flex flex-wrap">
    <div class="w-full lg:w-8/12 bg-gray-800 py-6 px-6 rounded-3xl">
        <div class="flex justify-between text-white items-center mb-8">
            <p class="text-2xl font-bold">Dashboard Overview</p>
            <p class="">{new Date().toDateString()}</p>
        </div>

        <div class="grid grid-cols-2 md:grid-cols-3 gap-6">
            <div class="bg-blue-500 p-6 rounded-lg text-white">
                <h3 class="text-xl font-semibold mb-2">Chats</h3>
                <p class="text-3xl font-bold">{chatCount}</p>
            </div>
            <div class="bg-green-500 p-6 rounded-lg text-white">
                <h3 class="text-xl font-semibold mb-2">Users</h3>
                <p class="text-3xl font-bold">{userCount}</p>
            </div>
            <div class="bg-yellow-500 p-6 rounded-lg text-white">
                <h3 class="text-xl font-semibold mb-2">Tasks</h3>
                <p class="text-3xl font-bold">{completedTaskCount} / {openTaskCount + completedTaskCount}</p>
                <p class="text-sm">Completed / Total</p>
            </div>
            <div class="bg-purple-500 p-6 rounded-lg text-white">
                <h3 class="text-xl font-semibold mb-2">Recent Events</h3>
                <p class="text-3xl font-bold">{recentEventCount}</p>
                <p class="text-sm">Last 7 days</p>
            </div>
            <div class="bg-red-500 p-6 rounded-lg text-white">
                <h3 class="text-xl font-semibold mb-2">Shopping Items</h3>
                <p class="text-3xl font-bold">{shoppingItemCount}</p>
            </div>
        </div>
    </div>
    <Announcements />
</div>
