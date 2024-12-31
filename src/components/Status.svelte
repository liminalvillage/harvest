<script lang="ts">
	// @ts-nocheck
    import { onMount, getContext } from "svelte";
    import { ID } from "../dashboard/store";
    import HoloSphere from "holosphere";

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
    let holosphere = getContext("holosphere") as HoloSphere;
    let valueEquationLoaded = false;

    // Initialize equation with default values
    let equation: Equation = {
        initiated: 1,
        completed: 1,
        sent: 1,
        received: 1,
        hours: 1,
        collaboration: 1,
        wants: 1,
        offers: 1
    };

    onMount(async () => {
        ID.subscribe((value) => {
            holonID = value;
            loadEquation();
            subscribeToUsers();
            
        });
    });

    async function loadEquation() {
        try {
            const settings = await holosphere.getAll(holonID, 'settings');
         
            if (settings && settings[0]?.valueEquation) {
                equation = {
                    ...equation, // Keep defaults as fallback
                    ...settings[0].valueEquation  // Override with stored values
                };
                console.log('Loaded equation settings:', equation);
                valueEquationLoaded = true;
            } 
        } catch (error) {
            console.error('Error loading equation settings:', error);
        }
    }

    async function subscribeToUsers() {
        store = {};
        if (holosphere) {
            holosphere.subscribe(holonID, "users", (newUser, key) => {
                if (newUser) {
                    store[key] = newUser;
                } else {
                    delete store[key];
                    store = store;
                }
            });
        }
    }

    function calculateScore(user: User): number {
        return (
            user.initiated.length * equation.initiated +
            user.completed.length * equation.completed +
            user.sent * equation.sent +
            user.received * equation.received
        );
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

    {#if !valueEquationLoaded}
        <div class="flex items-center justify-center py-12 text-gray-400">
            <svg class="animate-spin h-8 w-8 mr-3" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"/>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
            </svg>
            <span>Loading value equation...</span>
        </div>
    {:else}
        <div class="flex flex-wrap justify-between items-center pb-8">
            <div class="flex flex-wrap text-white">
                <div class="pr-10">
                    <div class="text-2xl font-bold">{sortedUsers.length}</div>
                    <div class="">Total Users</div>
                </div>
                <div>
                    <div class="text-2xl font-bold">
                        {sortedUsers.filter(([, user]) => calculateScore(user) > 0)
                            .length}
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
                            <td class="p-3"
                                >{user.first_name} {user.last_name || ""}</td
                            >
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
    {/if}
</div>

<style>
    th,
    td {
        text-align: left;
    }

    tr:hover {
        transition-property: color, background-color;
        transition-duration: 200ms;
    }

    .overflow-x-auto {
        border-radius: 0.5rem;
    }

    table {
        border-collapse: separate;
        border-spacing: 0;
    }

    th:first-child {
        border-top-left-radius: 0.5rem;
    }

    th:last-child {
        border-top-right-radius: 0.5rem;
    }

    tr:last-child td:first-child {
        border-bottom-left-radius: 0.5rem;
    }

    tr:last-child td:last-child {
        border-bottom-right-radius: 0.5rem;
    }
</style>
