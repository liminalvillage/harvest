<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { fade, scale } from 'svelte/transition';
    
    export let quest: any;
    export let questId: string;
    export let userStore: Record<string, any>;
    export let holosphere: any;
    export let holonId: string;

    const dispatch = createEventDispatcher();
    let showAddParticipants = false;

    async function updateQuest(updates: any, shouldClose = false) {
        const updatedQuest = { ...quest, ...updates };
        await holosphere.put(holonId, 'quests', updatedQuest);
        quest = updatedQuest;
        if (shouldClose) {
            dispatch('close');
        }
    }

    async function deleteQuest() {
        if (confirm('Are you sure you want to delete this task?')) {
            await holosphere.delete(holonId, 'quests', questId);
            dispatch('close');
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
            participants.push({
                id: userId,
                username: user.first_name + (user.last_name ? ' ' + user.last_name : ''),
                picture: `http://gun.holons.io/getavatar?user_id=${userId}`
            });
            await updateQuest({ participants });
        }
        showAddParticipants = false;
    }

    function isUserParticipant(userId: string) {
        return quest.participants?.some((p: { id: string }) => p.id === userId);
    }

    async function completeQuest() {
        const newStatus = quest.status === 'completed' ? 'ongoing' : 'completed';
        await updateQuest({ status: newStatus }, true);
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
        tabindex="-1"
    >
        <div class="p-6" role="document">
            <div class="flex justify-between items-start mb-6">
                <h2 id="modal-title" class="text-2xl font-bold text-white">{quest.title}</h2>
                <button 
                    class="text-gray-400 hover:text-white"
                    on:click={closeModal}
                    aria-label="Close modal"
                >
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            <div class="space-y-6 text-gray-300">
                {#if quest.description}
                    <p class="text-sm" id="modal-description">{quest.description}</p>
                {/if}

                <div class="space-y-4" role="region" aria-label="Participants">
                    <div class="flex justify-between items-center">
                        <h3 class="text-lg font-semibold" id="participants-heading">Participants</h3>
                        <button 
                            class="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded-full text-sm transition-colors"
                            on:click={() => showAddParticipants = !showAddParticipants}
                            aria-expanded={showAddParticipants}
                            aria-controls="participants-dropdown"
                        >
                            {showAddParticipants ? 'Cancel' : '+ Add Participant'}
                        </button>
                    </div>

                    <!-- Current Participants List -->
                    <div class="space-y-2">
                        {#if quest.participants?.length}
                            {#each quest.participants as participant}
                                <div class="flex items-center justify-between bg-gray-700 p-2 rounded-lg">
                                    <div class="flex items-center gap-2">
                                        <img 
                                            src={`http://gun.holons.io/getavatar?user_id=${participant.id}`}
                                            alt={participant.username}
                                            class="w-8 h-8 rounded-full"
                                        />
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
                        class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                        on:click={deleteQuest}
                    >
                        Delete Task
                    </button>
                    
                    <div class="space-x-2">
                        <button
                            class="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                            on:click={closeModal}
                        >
                            Cancel
                        </button>
                        <button
                            class="px-4 py-2 {quest.status === 'completed' ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-green-600 hover:bg-green-700'} text-white rounded-lg transition-colors"
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