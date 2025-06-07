<script lang="ts">
	// @ts-nocheck
    import { onMount, getContext } from "svelte";
    import { ID } from "../dashboard/store";
    import { page } from "$app/stores";
    import HoloSphere from "holosphere";
    import User from "./User.svelte";

    interface User {
        id?: string;
        username?: string;
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
    let holonID: string;
    let holosphere = getContext("holosphere") as HoloSphere;
    let valueEquationLoaded = false;
    let selectedUserId: string | null = null;
    let showUserModal = false;

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
        // Initialize from URL params first (priority), fallback to ID store
        const urlId = $page.params.id;
        const storeId = $ID;
        
        // Use URL parameter if available, otherwise use store value
        holonID = urlId || storeId;
        
        // If we have URL param, update the store to keep them in sync
        if (urlId && urlId !== storeId) {
            ID.set(urlId);
        }
        
        // Set up ID store subscription for future changes (skip initial value)
        let isFirstCall = true;
        const unsubscribe = ID.subscribe((value) => {
            if (isFirstCall) {
                isFirstCall = false;
                return; // Skip the initial subscription call
            }
            
            if (value && value !== holonID) {
                holonID = value;
                store = {}; // Reset store
                valueEquationLoaded = false;
                loadEquation();
                fetchInitialUsersAndSubscribe();
            }
        });

        // Watch for page parameter changes
        const pageUnsubscribe = page.subscribe((pageValue) => {
            const newId = pageValue.params.id;
            if (newId && newId !== holonID) {
                holonID = newId;
                // Update the ID store to keep it in sync
                ID.set(newId);
                store = {}; // Reset store
                valueEquationLoaded = false;
                loadEquation();
                fetchInitialUsersAndSubscribe();
            }
        });

        // Initial load if we have an ID
        if (holonID) {
            loadEquation();
            fetchInitialUsersAndSubscribe();
        }

        // Cleanup subscriptions
        return () => {
            unsubscribe();
            pageUnsubscribe();
        };
    });

    async function loadEquation() {
        try {
            const settings = await holosphere.getAll(holonID, 'settings');
         
            if (settings && settings[0]?.valueEquation) {
                equation = {
                    ...equation, // Keep defaults as fallback
                    ...settings[0].valueEquation  // Override with stored values
                };

                valueEquationLoaded = true;
            } 
        } catch (error) {
            console.error('Error loading equation settings:', error);
        }
    }

    // Debounce subscription updates to avoid excessive re-renders
    let subscriptionUpdateTimeout: ReturnType<typeof setTimeout> | null = null;
    let pendingUsers = new Map<string, any>();
    
    function flushPendingUsers() {
        if (pendingUsers.size > 0) {
            const updates = Object.fromEntries(pendingUsers);
            store = { ...store, ...updates };
            pendingUsers.clear();
        }
    }

    async function subscribeToUsers() {
        if (holosphere && holonID) {
            holosphere.subscribe(holonID, "users", (newUser, key) => {
                if (!key || key === 'undefined') return;
                
                if (newUser && newUser.id) {
                    // Use user ID as canonical key
                    const canonicalKey = newUser.id;
                    
                    // Check if this is actually a new/changed user to avoid unnecessary updates
                    const existingUser = store[canonicalKey];
                    if (existingUser && JSON.stringify(existingUser) === JSON.stringify(newUser)) {
                        return; // No actual change, skip update
                    }
                    
                    // Batch the update
                    pendingUsers.set(canonicalKey, newUser);
                    
                    // Debounce updates to batch multiple changes
                    if (subscriptionUpdateTimeout) {
                        clearTimeout(subscriptionUpdateTimeout);
                    }
                    subscriptionUpdateTimeout = setTimeout(flushPendingUsers, 50);
                    
                } else if (newUser && !newUser.id) {
                    // Fallback for users without id
                    store = { ...store, [key]: newUser };
                } else {
                    // Handle deletion
                    if (store.hasOwnProperty(key)) {
                        const { [key]: _, ...rest } = store;
                        store = rest;
                    }
                }
            });
        }
    }

    async function fetchInitialUsersAndSubscribe() {
        if (!holosphere || !holonID) {
            store = {};
            return;
        }


        try {
            const initialUsers = await holosphere.getAll(holonID, "users");
            
            if (Array.isArray(initialUsers)) {
                let usersKeyedById: Record<string, User> = {};
                initialUsers.forEach(user => {
                    if (user && user.id) {
                        usersKeyedById[user.id] = user as User;
                    } else if (user && user.username) {
                        // Fallback to username if no id
                        usersKeyedById[user.username] = user as User;
                    }
                });
                store = usersKeyedById;
            } else if (typeof initialUsers === 'object' && initialUsers !== null) {
                // If it's already an object, normalize the keys to use ids
                let normalizedStore: Record<string, User> = {};
                Object.entries(initialUsers).forEach(([key, user]) => {
                    if (user && user.id) {
                        normalizedStore[user.id] = user as User;
                    } else if (user) {
                        // Keep original key if no id
                        normalizedStore[key] = user as User;
                    }
                });
                store = normalizedStore;
            } else {
                store = {};
            }
        } catch (error) {
            console.error("[Status.svelte] Error fetching initial users:", error);
            store = {};
        }
        subscribeToUsers();
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

    function openUserModal(userId: string) {
        selectedUserId = userId;
        showUserModal = true;
    }

    function closeUserModal() {
        showUserModal = false;
        selectedUserId = null;
    }
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
                            <td class="p-3">
                                <button 
                                    class="text-left hover:text-blue-400 transition-colors cursor-pointer underline-offset-2 hover:underline flex items-center gap-3"
                                    on:click={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        openUserModal(userId);
                                    }}
                                >
                                    <img 
                                        src={`https://gun.holons.io/getavatar?user_id=${user.id || userId}`}
                                        alt={`${user.first_name} ${user.last_name || ''}`}
                                        class="w-8 h-8 rounded-full object-cover border border-gray-500"
                                        on:error={(e) => {
                                            // Fallback to initials if image fails to load
                                            e.currentTarget.style.display = 'none';
                                            e.currentTarget.nextElementSibling.style.display = 'flex';
                                        }}
                                    />
                                    <div class="w-8 h-8 rounded-full bg-gray-500 flex items-center justify-center text-white text-sm font-bold border border-gray-500" style="display: none;">
                                        {user.first_name ? user.first_name[0] : '?'}{user.last_name ? user.last_name[0] : ''}
                                    </div>
                                    <span>{user.first_name} {user.last_name || ""}</span>
                                </button>
                            </td>
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

<!-- User Modal -->
{#if showUserModal && selectedUserId && holonID && store[selectedUserId]}
    <User 
        userId={selectedUserId} 
        holonId={holonID} 
        userData={store[selectedUserId]}
        on:close={closeUserModal} 
    />
{/if}

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
