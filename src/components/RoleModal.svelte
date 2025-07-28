<script lang="ts">
    // @ts-nocheck

    $: if (role && !role.participants) {
        console.log("[RoleModal.svelte] Initializing role.participants as [] because it was falsy.");
        role.participants = [];
    }

    import { createEventDispatcher, onMount } from 'svelte';
    import { fade, scale } from 'svelte/transition';
    
    export let role: any;
    export let roleId: string;
    export let userStore: Record<string, any>;
    export let holosphere: any;
    export let holonId: string;

    console.log("[RoleModal.svelte] Script run/init. Role ID:", roleId);
    console.log("[RoleModal.svelte] Initial role prop:", JSON.parse(JSON.stringify(role || {})));
    console.log("[RoleModal.svelte] Initial userStore prop:", JSON.parse(JSON.stringify(userStore || {})));

    onMount(() => {
        console.log("[RoleModal.svelte] Mounted. Role ID:", roleId);
        console.log("[RoleModal.svelte] role prop onMount:", JSON.parse(JSON.stringify(role || {})));
        console.log("[RoleModal.svelte] userStore prop onMount:", JSON.parse(JSON.stringify(userStore || {})));
    });

    const dispatch = createEventDispatcher();
    let showAddParticipants = false;

    // Reactive statement to calculate available users
    $: availableUsersToList = (() => {
        if (!userStore || Object.keys(userStore).length === 0) {
            return [];
        }
        
        if (!role?.participants) {
            // If no participants yet, show all users
            return Object.entries(userStore);
        }
        
        // Filter out users who are already participants
        return Object.entries(userStore).filter(([userId, _user]) => !isUserParticipant(userId));
    })();

    // Debug logging when dropdown is shown
    $: if (showAddParticipants) {
        console.log("[RoleModal.svelte] Add Participants dropdown opened");
        console.log("[RoleModal.svelte] userStore keys:", Object.keys(userStore || {}));
        console.log("[RoleModal.svelte] role.participants:", role?.participants || []);
        console.log("[RoleModal.svelte] availableUsersToList count:", availableUsersToList.length);
    }

    async function updateRole(updates: any) {
        const updatedRole = { ...role, ...updates };
        await holosphere.put(holonId, 'roles', updatedRole);
        role = updatedRole;
    }

    async function deleteRole() {
        if (confirm('Are you sure you want to delete this role?')) {
            await holosphere.delete(holonId, 'roles', roleId);
            dispatch('deleted', { roleId: roleId });
            dispatch('close');
        }
    }

    function closeModal() {
        dispatch('close');
    }

    async function removeParticipant(participantId: string) {
        const participants = role.participants.filter((p: { id: string }) => p.id !== participantId);
        await updateRole({ participants });
    }

    async function addParticipant(userId: string) {
        const user = userStore[userId];
        const participants = [...(role.participants || [])];
        
        if (!participants.some((p: { id: string }) => p.id === userId)) {
            participants.push({
                id: userId,
                username: user.first_name + (user.last_name ? ' ' + user.last_name : '')
            });
            await updateRole({ participants });
        }
        showAddParticipants = false;
    }

    function isUserParticipant(userId: string) {
        return role.participants?.some((p: { id: string }) => p.id === userId);
    }
</script>

<div 
    class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
    on:click|self={closeModal}
    on:keydown={e => e.key === 'Escape' && closeModal()}
    role="dialog"
    aria-modal="true"
    aria-labelledby="modal-title"
    transition:fade
>
    <div 
        class="bg-gray-800 rounded-xl max-w-2xl w-full shadow-xl" 
        transition:scale={{duration: 200, start: 0.95}}
    >
        <div class="p-6">
            <div class="flex justify-between items-start mb-6">
                <h2 id="modal-title" class="text-2xl font-bold text-white">{role.title}</h2>
                <button 
                    class="text-gray-400 hover:text-white"
                    on:click={closeModal}
                    aria-label="Close modal"
                >
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            <div class="space-y-6 text-gray-300">
                {#if role.description}
                    <p class="text-sm">{role.description}</p>
                {/if}

                <div class="space-y-4">
                    <div class="flex justify-between items-center">
                        <h3 class="text-lg font-semibold">Participants</h3>
                        <button 
                            class="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded-full text-sm transition-colors"
                            on:click={() => showAddParticipants = !showAddParticipants}
                            disabled={Object.keys(userStore || {}).length === 0 && !showAddParticipants && holosphere}
                        >
                            {#if Object.keys(userStore || {}).length === 0 && !showAddParticipants && holosphere}
                                Loading Users...
                            {:else if showAddParticipants}
                                Cancel
                            {:else}
                                + Add Participant
                            {/if}
                        </button>
                    </div>

                    <!-- Current Participants List -->
                    <div class="space-y-2">
                        {#if role.participants?.length}
                            {#each role.participants as participant}
                                <div class="flex items-center justify-between bg-gray-700 p-2 rounded-lg">
                                    <div class="flex items-center gap-2">
                                            <img 
                                            src={`https://gun.holons.io/getavatar?user_id=${participant.id}`}
                                                alt={participant.username}
                                            class="w-8 h-8 rounded-full object-cover border border-gray-500"
                                            on:error={(e) => {
                                                e.currentTarget.style.display = 'none';
                                                e.currentTarget.nextElementSibling.style.display = 'flex';
                                            }}
                                        />
                                        <div class="w-8 h-8 rounded-full bg-gray-500 flex items-center justify-center text-white text-sm font-bold border border-gray-500" style="display: none;">
                                            {participant.username ? participant.username[0] : '?'}
                                        </div>
                                        <span>{participant.username}</span>
                                    </div>
                                    <button 
                                        class="text-red-400 hover:text-red-300"
                                        on:click={() => removeParticipant(participant.id)}
                                    >
                                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>
                            {/each}
                        {:else}
                            <p class="text-gray-500 text-sm">No participants yet</p>
                        {/if}
                    </div>

                    <!-- Add Participants Dropdown -->
                    {#if showAddParticipants}
                        <div class="bg-gray-700 rounded-lg overflow-hidden mt-2">
                            {#if Object.keys(userStore || {}).length === 0 && holosphere}
                                <p class="p-3 text-sm text-gray-400">Loading users or no users found in this holon.</p>
                            {:else if availableUsersToList.length === 0 && Object.keys(userStore || {}).length > 0}
                                <p class="p-3 text-sm text-gray-400">All available users are already participants or no other users to add.</p>
                            {:else}
                                {#each availableUsersToList as [userId, user]}
                                    <button
                                        class="w-full text-left px-4 py-2 hover:bg-gray-600 transition-colors flex items-center gap-2 text-gray-200"
                                        on:click={() => addParticipant(userId)}
                                    >
                                            <img 
                                            src={`https://gun.holons.io/getavatar?user_id=${user.id || userId}`}
                                                alt={user.first_name}
                                            class="w-6 h-6 rounded-full object-cover border border-gray-500"
                                            on:error={(e) => {
                                                e.currentTarget.style.display = 'none';
                                                e.currentTarget.nextElementSibling.style.display = 'flex';
                                            }}
                                        />
                                        <div class="w-6 h-6 rounded-full bg-gray-500 flex items-center justify-center text-xs text-white border border-gray-500" style="display: none;">
                                            {user.first_name ? user.first_name[0] : '?'}{user.last_name ? user.last_name[0] : ''}
                                            </div>
                                        <span>{user.first_name} {user.last_name || ''}</span>
                                    </button>
                                {/each}
                            {/if}
                        </div>
                    {/if}
                </div>

                <div class="flex justify-between pt-6">
                    <button
                        class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                        on:click={deleteRole}
                    >
                        Delete Role
                    </button>
                    
                    <button
                        class="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                        on:click={closeModal}
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    </div>
</div> 