<script lang="ts">
    console.log('RoleModal props:', {
        role,
        roleId,
        userStore,
        holosphere,
        holonId
    });

    $: if (role && !role.participants) {
        role.participants = [];
    }

    import { createEventDispatcher } from 'svelte';
    import { fade, scale } from 'svelte/transition';
    
    export let role: any;
    export let roleId: string;
    export let userStore: Record<string, any>;
    export let holosphere: any;
    export let holonId: string;

    const dispatch = createEventDispatcher();
    let showAddParticipants = false;

    async function updateRole(updates: any) {
        const updatedRole = { ...role, ...updates };
        await holosphere.put(holonId, 'roles', updatedRole);
        role = updatedRole;
    }

    async function deleteRole() {
        if (confirm('Are you sure you want to delete this role?')) {
            await holosphere.delete(holonId, 'roles', roleId);
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
                username: user.first_name + (user.last_name ? ' ' + user.last_name : ''),
                picture: user.picture
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
                        >
                            {showAddParticipants ? 'Cancel' : '+ Add Participant'}
                        </button>
                    </div>

                    <!-- Current Participants List -->
                    <div class="space-y-2">
                        {#if role.participants?.length}
                            {#each role.participants as participant}
                                <div class="flex items-center justify-between bg-gray-700 p-2 rounded-lg">
                                    <div class="flex items-center gap-2">
                                        {#if participant.picture}
                                            <img 
                                                src={participant.picture} 
                                                alt={participant.username}
                                                class="w-8 h-8 rounded-full"
                                            />
                                        {/if}
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
                            {#each Object.entries(userStore) as [userId, user]}
                                {#if !isUserParticipant(userId)}
                                    <button
                                        class="w-full text-left px-4 py-2 hover:bg-gray-600 transition-colors flex items-center gap-2"
                                        on:click={() => addParticipant(userId)}
                                    >
                                        {#if user.picture}
                                            <img 
                                                src={user.picture} 
                                                alt={user.first_name}
                                                class="w-6 h-6 rounded-full"
                                            />
                                        {/if}
                                        <span>{user.first_name} {user.last_name || ''}</span>
                                    </button>
                                {/if}
                            {/each}
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