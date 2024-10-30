<script lang="ts">
    import { onMount, getContext } from 'svelte';
    import { ID } from '../dashboard/store';
    import HoloSphere from 'holosphere';
    
    interface User {
        first_name: string;
        last_name?: string;
        initiated: string[];
        completed: string[];
        sent: number;
        received: number;
        hours: number;
        collaboration: number;
        wants: string[];
        offers: string[];
    }

    interface Equation {
        initiated: number;
        completed: number;
        sent: number;
        received: number;
        hours: number;
        collaboration: number;
        wants: number;
        offers: number;
    }

    let store: Record<string, User> = {};
    $: holonID = $ID;
    let holosphere = getContext('holosphere') || new HoloSphere('Holons');

    // Default equation values
    const equation: Equation = {
        initiated: 1,
        completed: 1,
        sent: 1,
        received: 1//,
        // hours: 1,
        // collaboration: 2,
        // wants: 0.5,
        // offers: 0.5
    };

    onMount(() => {
        subscribeToUsers();
    });

    ID.subscribe((value) => {
        holonID = value;
        subscribeToUsers();
    });

    async function subscribeToUsers() {
        store = {};
        if (holosphere) {
            holosphere.subscribe(holonID, 'users', (newUser, key) => {
                if (newUser) {
                    store[key] = JSON.parse(newUser);
                } else {
                    delete store[key];
                    store = store;
                }
            });
        }
    }
    

    function calculateScore(user: User): number {
        return user.initiated.length * equation.initiated +
            user.completed.length * equation.completed +
            user.sent * equation.sent +
            user.received * equation.received 
            // user.hours * equation.hours +
            // user.collaboration * equation.collaboration +
            // user.wants.length * equation.wants +
            // user.offers.length * equation.offers;
    }

    $: sortedUsers = Object.entries(store).sort(([, a], [, b]) => {
        return calculateScore(b) - calculateScore(a);
    });
</script>

<div class="w-full lg:w-8/12 bg-gray-800 py-6 px-6 rounded-3xl">
    <div class="flex justify-between text-white items-center mb-8">
        <p class="text-2xl font-bold">Status Rankings</p>
        <p class="">{new Date().toDateString()}</p>
    </div>

    <div class="flex flex-wrap justify-between items-center pb-8">
        <div class="flex flex-wrap text-white">
            <div class="pr-10">
                <div class="text-2xl font-bold">{sortedUsers.length}</div>
                <div class="">Total Users</div>
            </div>
            <div>
                <div class="text-2xl font-bold">
                    {sortedUsers.filter(([, user]) => calculateScore(user) > 0).length}
                </div>
                <div class="">Active Users</div>
            </div>
        </div>
    </div>

    <div class="overflow-x-auto">
        <table class="w-full text-white">
            <thead>
                <tr class="bg-gray-700">
                    <th class="p-3 text-left">Rank</th>
                    <th class="p-3 text-left">Name</th>
                    <th class="p-3 text-left">Tasks Initiated</th>
                    <th class="p-3 text-left">Tasks Completed</th>
                    <th class="p-3 text-left">Sent</th>
                    <th class="p-3 text-left">Received</th>
                    <th class="p-3 text-left">Score</th>
                </tr>
            </thead>
            <tbody>
                {#each sortedUsers as [userId, user], index}
                    {@const score = calculateScore(user)}
                    <tr class="border-b border-gray-700 hover:bg-gray-700">
                        <td class="p-3">{index + 1}</td>
                        <td class="p-3">{user.first_name} {user.last_name || ''}</td>
                        <td class="p-3">{user.initiated.length}</td>
                        <td class="p-3">{user.completed.length}</td>
                        <td class="p-3">{user.sent}</td>
                        <td class="p-3">{user.received}</td>
                        <td class="p-3">{score.toFixed(1)}</td>
                    </tr>
                {/each}
            </tbody>
        </table>
    </div>
</div>

<style>
    th, td {
        @apply text-left;
    }

    tr:hover {
        @apply transition-colors duration-200;
    }

    .overflow-x-auto {
        @apply rounded-lg;
    }

    table {
        border-collapse: separate;
        border-spacing: 0;
    }

    th:first-child {
        @apply rounded-tl-lg;
    }

    th:last-child {
        @apply rounded-tr-lg;
    }

    tr:last-child td:first-child {
        @apply rounded-bl-lg;
    }

    tr:last-child td:last-child {
        @apply rounded-br-lg;
    }
</style> 