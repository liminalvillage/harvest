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

    $: maxScore = sortedUsers.length > 0 ? calculateScore(sortedUsers[0][1]) : 0;
    $: totalScore = sortedUsers.reduce((sum, [, user]) => sum + calculateScore(user), 0);

    function calculatePercentage(score: number): number {
        if (totalScore === 0) return 0;
        return (score / totalScore) * 100;
    }

    function openUserModal(userId: string) {
        selectedUserId = userId;
        showUserModal = true;
    }

    function closeUserModal() {
        showUserModal = false;
        selectedUserId = null;
    }
</script>

<div class="space-y-8">
    <!-- Header Section -->
    <div class="bg-gradient-to-r from-gray-800 to-gray-700 py-8 px-8 rounded-3xl shadow-2xl">
        <div class="flex flex-col md:flex-row justify-between items-center">
            <div class="text-center md:text-left mb-4 md:mb-0">
                <h1 class="text-4xl font-bold text-white mb-2">Status Rankings</h1>
                <p class="text-gray-300 text-lg">{new Date().toDateString()}</p>
            </div>
        </div>
    </div>

    <!-- Main Content Container -->
    <div class="bg-gray-800 rounded-3xl shadow-xl min-h-[600px]">
        <div class="p-8">
            {#if !valueEquationLoaded}
                <div class="flex items-center justify-center py-12 text-gray-400">
                    <svg class="animate-spin h-8 w-8 mr-3" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"/>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                    </svg>
                    <span>Loading value equation...</span>
                </div>
            {:else}
                <!-- Stats Section -->
                <div class="grid grid-cols-2 gap-4 mb-8">
                    <div class="bg-gray-700/50 rounded-2xl p-4 text-center">
                        <div class="text-2xl font-bold text-white mb-1">{sortedUsers.length}</div>
                        <div class="text-sm text-gray-400">Total Users</div>
                    </div>
                    <div class="bg-gray-700/50 rounded-2xl p-4 text-center">
                        <div class="text-2xl font-bold text-white mb-1">
                            {sortedUsers.filter(([, user]) => calculateScore(user) > 0).length}
                        </div>
                        <div class="text-sm text-gray-400">Active Users</div>
                    </div>
                </div>

                <!-- Rankings Table -->
                <div class="bg-gray-700/30 rounded-2xl overflow-hidden">
                    <div class="overflow-x-auto">
                        <table class="w-full text-white">
                            <thead>
                                <tr class="bg-gray-600/80">
                                    <th class="p-4 text-left font-semibold">Rank</th>
                                    <th class="p-4 text-left font-semibold">Name</th>
                                    <th class="p-4 text-left font-semibold">Tasks Initiated</th>
                                    <th class="p-4 text-left font-semibold">Tasks Completed</th>
                                    <th class="p-4 text-left font-semibold">Sent</th>
                                    <th class="p-4 text-left font-semibold">Received</th>
                                    <th class="p-4 text-left font-semibold">Score</th>
                                    <th class="p-4 text-left font-semibold">Percentage</th>
                                </tr>
                            </thead>
                            <tbody>
                                {#each sortedUsers as [userId, user], index}
                                    {@const score = calculateScore(user)}
                                    {@const percentage = calculatePercentage(score)}
                                    <tr class="border-b border-gray-600/50 hover:bg-gray-600/20 transition-all duration-200">
                                        <td class="p-4">
                                            <div class="flex items-center">
                                                {#if index === 0}
                                                    <span class="w-8 h-8 bg-yellow-500 text-black rounded-full flex items-center justify-center font-bold text-sm">🏆</span>
                                                {:else if index === 1}
                                                    <span class="w-8 h-8 bg-gray-400 text-white rounded-full flex items-center justify-center font-bold text-sm">🥈</span>
                                                {:else if index === 2}
                                                    <span class="w-8 h-8 bg-orange-600 text-white rounded-full flex items-center justify-center font-bold text-sm">🥉</span>
                                                {:else}
                                                    <span class="w-8 h-8 bg-gray-600 text-white rounded-full flex items-center justify-center font-bold text-sm">{index + 1}</span>
                                                {/if}
                                            </div>
                                        </td>
                                        <td class="p-4">
                                            <button 
                                                class="text-left hover:text-blue-400 transition-colors cursor-pointer underline-offset-2 hover:underline flex items-center gap-3"
                                                on:click={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    openUserModal(userId);
                                                }}
                                            >
                                                <div class="relative">
                                                    <img 
                                                        src={`https://gun.holons.io/getavatar?user_id=${user.id || userId}`}
                                                        alt={`${user.first_name} ${user.last_name || ''}`}
                                                        class="w-10 h-10 rounded-full object-cover border-2 border-gray-500"
                                                        on:error={(e) => {
                                                            e.currentTarget.style.display = 'none';
                                                            e.currentTarget.nextElementSibling.style.display = 'flex';
                                                        }}
                                                    />
                                                    <div class="w-10 h-10 rounded-full bg-gray-600 flex items-center justify-center text-white text-sm font-bold border-2 border-gray-500" style="display: none;">
                                                        {user.first_name ? user.first_name[0] : '?'}{user.last_name ? user.last_name[0] : ''}
                                                    </div>
                                                </div>
                                                <div>
                                                    <div class="font-semibold">{user.first_name} {user.last_name || ""}</div>
                                                    {#if user.username}
                                                        <div class="text-sm text-gray-400">@{user.username}</div>
                                                    {/if}
                                                </div>
                                            </button>
                                        </td>
                                        <td class="p-4">
                                            <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-600/20 text-blue-300">
                                                {user.initiated.length}
                                            </span>
                                        </td>
                                        <td class="p-4">
                                            <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-600/20 text-green-300">
                                                {user.completed.length}
                                            </span>
                                        </td>
                                        <td class="p-4">
                                            <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-600/20 text-blue-300">
                                                {user.sent}
                                            </span>
                                        </td>
                                        <td class="p-4">
                                            <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-600/20 text-purple-300">
                                                {user.received}
                                            </span>
                                        </td>
                                        <td class="p-4">
                                            <span class="font-bold text-lg text-white">{score.toFixed(1)}</span>
                                        </td>
                                        <td class="p-4">
                                            <div class="flex items-center gap-3">
                                                <div class="flex-1 bg-gray-600 rounded-full h-3 min-w-[100px]">
                                                    <div 
                                                        class="bg-gradient-to-r from-blue-500 to-blue-400 h-3 rounded-full transition-all duration-500"
                                                        style="width: {percentage}%"
                                                    ></div>
                                                </div>
                                                <span class="text-sm font-medium text-gray-300 min-w-[45px]">
                                                    {percentage.toFixed(1)}%
                                                </span>
                                            </div>
                                        </td>
                                    </tr>
                                {/each}
                            </tbody>
                        </table>
                    </div>

                    {#if sortedUsers.length === 0}
                        <div class="text-center py-12">
                            <div class="w-16 h-16 mx-auto mb-4 bg-gray-700 rounded-full flex items-center justify-center">
                                <svg class="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>
                                </svg>
                            </div>
                            <h3 class="text-lg font-medium text-white mb-2">No users found</h3>
                            <p class="text-gray-400">Users will appear here once they start participating</p>
                        </div>
                    {/if}
                </div>
            {/if}
        </div>
    </div>
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
</style>
