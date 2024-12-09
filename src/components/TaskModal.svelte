<script lang="ts">
    import { createEventDispatcher, getContext, onMount } from 'svelte';
    import { fade, scale } from 'svelte/transition';
    import HoloSphere from 'holosphere';
  
    
    export let quest: any;
    export let questId: string;
    export let holonId: string;


    interface User {
        id: string;
        first_name: string;
        last_name?: string;
        picture?: string;
        username: string;
    }

    interface UserStore {
        [key: string]: User;
    }

    const holosphere = getContext("holosphere") as HoloSphere;
    
    let userStore: UserStore = {};

    onMount(() => {
        document.addEventListener('click', handleClickOutside);
        
        if (holosphere) {
            holosphere.subscribe(holonId, "users", (newUser: User | string | null, key: string) => {
                if (newUser) {
                    const parsedUser = typeof newUser === "string" ? JSON.parse(newUser) : newUser;
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
    let showAddParticipants = false;
    let showDropdown = false;

    async function updateQuest(updates: any, shouldClose = false) {
    
        if (!holosphere) {
            console.error("Cannot update quest: holosphere is not available");
            return;
        }
        
        const updatedQuest = { ...quest, ...updates };
        await holosphere.put(holonId, 'quests', updatedQuest);
        quest = updatedQuest;
        if (shouldClose) {
            dispatch('close');
        }
    }

    async function deleteQuest() {
        if (!questId || !holonId) {
            console.error('Cannot delete quest: missing parameters', { questId, holonId });
            return;
        }

        if (confirm('Are you sure you want to delete this task?')) {
            try {
                await holosphere.delete(holonId, 'quests', questId);
                dispatch('close', { deleted: true, questId });
            } catch (error) {
                console.error('Error deleting quest:', error);
            }
        }
    }

    function closeModal() {
        dispatch('close');
    }

    async function removeParticipant(participantId: string) {
        const participants = quest.participants.filter((p: { id: string }) => p.id !== participantId);
        await updateQuest({ participants });
    }

    async function addParticipant(userId: string) {
        const user = userStore[userId];
        const participants = [...(quest.participants || [])];
        
        if (!participants.some((p: { id: string }) => p.id === userId)) {
            participants.push(user);
            await updateQuest({ participants });
        }
        showAddParticipants = false;
    }

    function isUserParticipant(userId: string) {
        return quest.participants?.some((p: { id: string }) => p.id === userId);
    }

    async function completeQuest() {
        const newStatus = quest.status === 'completed' ? 'ongoing' : 'completed';
        
        if (newStatus === 'completed') {
            // Track initiator action
            const initiatorData = await holosphere.get(holonId, 'users', quest.initiator.id);
            await holosphere.put(holonId, 'users', {
                ...initiatorData,
                initiated: [...(initiatorData.initiated || []), quest.title],
                actions: [...(initiatorData.actions || []), {
                    type: 'initiated',
                    action: quest.title,
                    amount: 0,
                    timestamp: new Date()
                }]
            });

            // Track participant completions
            if (quest.participants) {
                for (const participant of quest.participants) {
                    const userData = await holosphere.get(holonId, 'users', participant.id);
                    await holosphere.put(holonId, 'users', {
                        ...userData,
                        completed: [...(userData.completed || []), quest.title],
                        actions: [...(userData.actions || []), {
                            type: 'completed',
                            action: quest.title,
                            amount: 0,
                            timestamp: new Date()
                        }]
                    });
                }
            }
        }
        
        await updateQuest({ status: newStatus }, true);
    }

    async function toggleParticipant(userId: string) {
        const participants = [...(quest.participants || [])];
        const participantIndex = participants.findIndex(p => p.id === userId);

        if (participantIndex >= 0) {
            participants.splice(participantIndex, 1);
        } else {
            const user = userStore[userId];
            if (user) {
                participants.push({
                    id: user.id,
                    first_name: user.first_name,
                    last_name: user.last_name,
                    username: user.username
                });

                const userData = await holosphere.get(holonId, 'users', user.id) || {
                    id: user.id,
                    actions: []
                };
                
                await holosphere.put(holonId, 'users', {
                    ...userData,
                    id: user.id,
                    actions: [...userData.actions, {
                        type: 'joined',
                        action: quest.title,
                        category: quest.category || '',
                        amount: 1,
                        timestamp: Date.now()
                    }]
                });
            }
        }

        await updateQuest({ participants });
        showDropdown = false;
    }

    function handleClickOutside(event: MouseEvent) {
        const dropdown = document.querySelector('.user-dropdown');
        if (dropdown && !dropdown.contains(event.target as Node)) {
            showDropdown = false;
        }
    }
</script>

<div data-component="TaskModal"
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
                <h2 id="modal-title" class="text-2xl font-bold text-white">{quest.title}</h2>
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
                {#if quest.description}
                    <p class="text-sm">{quest.description}</p>
                {/if}

                <div class="space-y-4">
                    <div class="flex justify-between items-center">
                        <h3 class="text-lg font-semibold">Participants</h3>
                        <button 
                            class="px-3 py-1 bg-gray-700 text-gray-200 rounded-lg hover:bg-gray-600 border border-gray-600 transition-colors text-sm"
                            on:click|stopPropagation={() => showDropdown = !showDropdown}
                        >
                            {showDropdown ? 'Cancel' : '+ Add Participant'}
                        </button>
                    </div>

                    <!-- Current Participants List -->
                    <div class="space-y-2">
                        {#if quest.participants?.length}
                            {#each quest.participants as participant}
                                <div class="flex items-center justify-between bg-gray-700 p-2 rounded-lg border border-gray-600">
                                    <div class="flex items-center gap-2">
                                        <img 
                                            src={`http://gun.holons.io/getavatar?user_id=${participant.id}`}
                                            alt={participant.username}
                                            class="w-8 h-8 rounded-full"
                                        />
                                        <span>{participant.username}</span>
                                    </div>
                                    <div class="flex items-center gap-2">
                                        <button 
                                            class="text-gray-400 hover:text-red-400 transition-colors"
                                            on:click={() => removeParticipant(participant.id)}
                                        >
                                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                            {/each}
                        {:else}
                            <p class="text-gray-500 text-sm">No participants yet</p>
                        {/if}
                    </div>

                    <!-- User Dropdown -->
                    {#if showDropdown}
                        <div class="bg-gray-700 rounded-lg overflow-hidden mt-2 user-dropdown border border-gray-600">
                            {#each Object.entries(userStore) as [userId, user]}
                                {#if !isUserParticipant(userId)}
                                    <button
                                        class="w-full text-left px-4 py-2 hover:bg-gray-600 transition-colors flex items-center gap-2 text-gray-200"
                                        on:click|stopPropagation={() => toggleParticipant(userId)}
                                    >
                                        <img 
                                            src={`http://gun.holons.io/getavatar?user_id=${userId}`}
                                            alt={user.first_name}
                                            class="w-6 h-6 rounded-full"
                                        />
                                        <span>{user.first_name} {user.last_name || ''}</span>
                                    </button>
                                {/if}
                            {/each}
                        </div>
                    {/if}
                </div>

                <div class="flex justify-between pt-6">
                    <button
                        class="px-4 py-2 bg-gray-700 text-red-400 rounded-lg hover:bg-gray-600 border border-red-500 transition-colors"
                        on:click={deleteQuest}
                    >
                        Delete Task
                    </button>
                    
                    <div class="space-x-2">
                        <button
                            class="px-4 py-2 bg-gray-700 text-gray-200 rounded-lg hover:bg-gray-600 border border-gray-600 transition-colors"
                            on:click={closeModal}
                        >
                            Cancel
                        </button>
                        <button
                            class="px-4 py-2 bg-gray-700 {quest.status === 'completed' ? 'text-yellow-400 border-yellow-500 hover:bg-gray-600' : 'text-green-400 border-green-500 hover:bg-gray-600'} rounded-lg border transition-colors"
                            on:click={completeQuest}
                        >
                            {quest.status === 'completed' ? 'Mark Ongoing' : 'Mark Complete'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div> 