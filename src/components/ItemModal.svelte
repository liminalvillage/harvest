<script lang="ts">
    import { createEventDispatcher, getContext, onMount } from 'svelte';
    import { fade, scale } from 'svelte/transition';
    import HoloSphere from "holosphere";
    // Allow either quest or role to be passed
    export let quest: any = undefined;
    export let role: any = undefined;
    export let questId: string | undefined = undefined;
    export let roleId: string | undefined = undefined;
    export let holonId: string;

    const item = quest || role;
    const itemId = questId || roleId;
    const itemType = quest ? 'quests' : 'roles';

    interface User {
        first_name: string;
        last_name?: string;
        picture?: string;
        username?: string;
        id?: string;
    }

    interface UserStore {
        [key: string]: User;
    }


    const holosphere = getContext("holosphere") as HoloSphere;
    
    let userStore: UserStore = {};

    onMount(async () => {
        document.addEventListener('click', handleClickOutside);
        
        if (holosphere) {
            // First, fetch all existing users
            try {
                const initialUsers = await holosphere.getAll(holonId, "users");
                if (initialUsers) {
                    userStore = initialUsers;
                    console.log("[ItemModal] Loaded initial users:", Object.keys(userStore).length);
                }
            } catch (error) {
                console.error("[ItemModal] Error fetching initial users:", error);
            }

            // Then subscribe to future updates
            holosphere.subscribe(holonId, "users", (newUser: any, key: string) => {
                if (newUser) {
                    const parsedUser = newUser;
                    userStore = {
                        ...userStore,
                        [key]: parsedUser
                    };
                } else {
                    const { [key]: _, ...rest } = userStore;
                    userStore = rest;
                }
            });
        }

        return () => {
            document.removeEventListener('click', handleClickOutside);
        };
    });

    const dispatch = createEventDispatcher();
    let showDropdown = false;

    async function updateItem(updates: any, shouldClose = false) {
        if (!holosphere) {
            console.error(`Cannot update ${itemType}: holosphere is not available`);
            return;
        }
        
        const updatedItem = { ...item, ...updates };
        await holosphere.put(holonId, itemType, updatedItem);
        if (quest) quest = updatedItem;
        if (role) role = updatedItem;
        
        if (shouldClose) {
            dispatch('close');
        }
    }

    async function deleteItem() {
        if (!itemId || !holonId) {
            console.error(`Cannot delete ${itemType}: missing parameters`, { itemId, holonId });
            return;
        }

        if (confirm(`Are you sure you want to delete this ${itemType.slice(0, -1)}?`)) {
            try {
                await holosphere.delete(holonId, itemType, itemId);
                dispatch('close', { deleted: true, itemId });
            } catch (error) {
                console.error(`Error deleting ${itemType}:`, error);
            }
        }
    }

    function closeModal() {
        dispatch('close');
    }

    async function removeParticipant(participantId: string) {
        // Update the item directly for immediate UI update
        item.participants = item.participants.filter((p: any) => p.id !== participantId);
        
        if (quest) {
            quest.participants = quest.participants.filter((p: any) => p.id !== participantId);
        } else if (role) {
            role.participants = role.participants.filter((p: any) => p.id !== participantId);
        }
        const participants = (quest || role).participants;
        await updateItem({ participants });
    }

    async function toggleParticipant(userId: string) {
        const participants = [...((quest || role).participants || [])];
        const participantIndex = participants.findIndex((p: any) => p.id === userId);

        if (participantIndex >= 0) {
            participants.splice(participantIndex, 1);
            if (quest) quest.participants = participants;
            if (role) role.participants = participants;
        } else {
            const user = userStore[userId];
            if (user) {
                const newParticipant = {
                    id: userId,
                    first_name: user.first_name,
                    last_name: user.last_name,
                    username: user.username
                };
                participants.push(newParticipant);
                if (quest) quest.participants = participants;
                if (role) role.participants = participants;
            }
        }

        await updateItem({ participants });
        showDropdown = false;
    }

    function isUserParticipant(userId: string) {
        return item.participants?.some((p: any) => p.id === userId);
    }

    async function completeItem() {
        const newStatus = item.status === 'completed' ? 'ongoing' : 'completed';
        await updateItem({ status: newStatus }, true);
    }

    function handleClickOutside(event: MouseEvent) {
        const dropdown = document.querySelector('.user-dropdown');
        if (dropdown && !dropdown.contains(event.target as Node)) {
            showDropdown = false;
        }
    }
</script>

<div 
    class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
    on:click|self={closeModal}
    on:keydown={e => e.key === 'Escape' && closeModal()}
    role="presentation"
    transition:fade
>
    <div 
        class="bg-gray-800 rounded-xl max-w-2xl w-full shadow-xl" 
        transition:scale={{duration: 200, start: 0.95}}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
    >
        <div class="p-6">
            <div class="flex justify-between items-start mb-6">
                <h2 id="modal-title" class="text-2xl font-bold text-white">{item.title}</h2>
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
                {#if item.description}
                    <p class="text-sm">{item.description}</p>
                {/if}

                <div class="space-y-4">
                    <div class="flex justify-between items-center">
                        <h3 class="text-lg font-semibold">Participants</h3>
                        <button 
                            class="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded-full text-sm transition-colors"
                            on:click|stopPropagation={() => showDropdown = !showDropdown}
                        >
                            {showDropdown ? 'Cancel' : '+ Add Participant'}
                        </button>
                    </div>

                    <!-- Current Participants List -->
                    <div class="space-y-2">
                        {#if item.participants?.length}
                            {#each item.participants as participant}
                                <div class="flex items-center justify-between bg-gray-700 p-2 rounded-lg">
                                    <div class="flex items-center gap-2">
                                        <img 
                                            src={`https://gun.holons.io/getavatar?user_id=${participant.id}`}
                                            alt={participant.username || participant.first_name}
                                            class="w-8 h-8 rounded-full object-cover border border-gray-500"
                                            on:error={(e) => {
                                                e.currentTarget.style.display = 'none';
                                                e.currentTarget.nextElementSibling.style.display = 'flex';
                                            }}
                                        />
                                        <div class="w-8 h-8 rounded-full bg-gray-500 flex items-center justify-center text-white text-sm font-bold border border-gray-500" style="display: none;">
                                            {participant.first_name ? participant.first_name[0] : '?'}{participant.last_name ? participant.last_name[0] : ''}
                                        </div>
                                        <span>{participant.username || `${participant.first_name} ${participant.last_name || ''}`}</span>
                                    </div>
                                    <button 
                                        class="text-gray-400 hover:text-red-400 transition-colors"
                                        on:click={() => removeParticipant(participant.id)}
                                        aria-label={`Remove participant ${participant.first_name}`}
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

                    <!-- User Dropdown -->
                    {#if showDropdown}
                        <div class="bg-gray-700 rounded-lg overflow-hidden mt-2 user-dropdown">
                            {#each Object.entries(userStore) as [userId, user]}
                                <button
                                    class="w-full text-left px-4 py-2 hover:bg-gray-600 transition-colors flex items-center gap-2 {isUserParticipant(userId) ? 'bg-gray-600' : ''}"
                                    on:click|stopPropagation={() => toggleParticipant(userId)}
                                >
                                    <div class="flex items-center gap-2 flex-1">
                                        <img 
                                            src={`https://gun.holons.io/getavatar?user_id=${user.id || userId}`}
                                            alt={user.first_name}
                                            class="w-6 h-6 rounded-full object-cover border border-gray-500"
                                            on:error={(e) => {
                                                e.currentTarget.style.display = 'none';
                                                e.currentTarget.nextElementSibling.style.display = 'flex';
                                            }}
                                        />
                                        <div class="w-6 h-6 rounded-full bg-gray-500 flex items-center justify-center text-white text-xs font-bold border border-gray-500" style="display: none;">
                                            {user.first_name ? user.first_name[0] : '?'}{user.last_name ? user.last_name[0] : ''}
                                        </div>
                                        <span>{user.first_name} {user.last_name || ''}</span>
                                    </div>
                                    {#if isUserParticipant(userId)}
                                        <svg class="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                                        </svg>
                                    {/if}
                                </button>
                            {/each}
                        </div>
                    {/if}
                </div>

                {#if item.when}
                    <div class="text-sm">
                        <span class="font-semibold">When:</span> {new Date(item.when).toLocaleString()}
                        {#if item.ends}
                            - {new Date(item.ends).toLocaleTimeString()}
                        {/if}
                    </div>
                {/if}

                <div class="flex justify-between pt-6">
                    <button
                        class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                        on:click={deleteItem}
                    >
                        Delete {itemType.slice(0, -1)}
                    </button>
                    
                    <div class="space-x-2">
                        <button
                            class="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                            on:click={closeModal}
                        >
                            Cancel
                        </button>
                        {#if typeof item.status !== 'undefined'}
                            <button
                                class="px-4 py-2 {item.status === 'completed' ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-green-600 hover:bg-green-700'} text-white rounded-lg transition-colors"
                                on:click={completeItem}
                            >
                                {item.status === 'completed' ? 'Mark Ongoing' : 'Mark Complete'}
                            </button>
                        {/if}
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>

<style>
    .user-dropdown {
        max-height: 200px;
        overflow-y: auto;
    }
</style> 