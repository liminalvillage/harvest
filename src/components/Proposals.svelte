<script lang="ts">
    import { onMount, getContext } from "svelte";
    import { ID } from "../dashboard/store";
    import type HoloSphere from "holosphere";
    import ProposalChart from './ProposalChart.svelte';

    interface Proposal {
        id: string;
        type: string;
        title: string;
        description: string;
        participants: string[];  // Array of user IDs who agreed
        stoppers: string[];  // Array of user IDs who blocked
        date: number;  // Unix timestamp
        creator: string;
    }

    const holosphere = getContext("holosphere") as HoloSphere;
    
    $: holonID = $ID;
    let proposals: Record<string, Proposal> = {};
    let selectedProposal: Proposal | null = null;
    let showModal = false;
    
    // Computed property to sort proposals by date and then agreement count
    $: sortedProposals = Object.values(proposals)
        .filter(p => p.type === "proposal")
        .sort((a, b) => {
            // Sort by date descending (newest first)
            const dateComparison = b.date - a.date;
            // If dates are equal, sort by participant count
            if (dateComparison === 0) {
                return b.participants.length - a.participants.length;
            }
            return dateComparison;
        });

    onMount(() => {
        ID.subscribe((value) => {
            holonID = value;
            subscribeToProposals();
        });
    });

    function subscribeToProposals(): void {
        proposals = {};
        if (holosphere) {
            holosphere.subscribe(
                holonID,
                "quests",
                (newItem: Proposal, key: string) => {
                    if (newItem) {
                        if (newItem.type === "proposal") {
                            proposals[key] = newItem;
                        }
                    } else {
                        delete proposals[key];
                    }
                    proposals = proposals;
                }
            );
        }
    }

    function addProposal(title: string, description: string): void {
        const newProposal: Proposal = {
            id: crypto.randomUUID(),
            type: "proposal",
            title,
            description,
            participants: [],
            stoppers: [],
            date: Math.floor(Date.now() / 1000), // Current Unix timestamp
            creator: "Dashboard User", // You might want to get the actual user
        };
        
        holosphere.put(holonID, "quests", newProposal);
    }

    function toggleBlock(proposalId: string): void {
        const proposal = proposals[proposalId];
        if (!proposal) return;

        const userId = "current-user"; // Replace with actual user ID
        const updatedProposal = { ...proposal };
        
        if (!updatedProposal.stoppers) {
            updatedProposal.stoppers = [];
        }
        
        if (updatedProposal.stoppers.includes(userId)) {
            updatedProposal.stoppers = updatedProposal.stoppers.filter(id => id !== userId);
        } else {
            updatedProposal.stoppers = [...updatedProposal.stoppers, userId];
            // Remove from participants if blocking
            updatedProposal.participants = updatedProposal.participants.filter(id => id !== userId);
        }
        
        holosphere.put(holonID, "quests", updatedProposal);
    }

    function toggleAgree(proposalId: string): void {
        const proposal = proposals[proposalId];
        if (!proposal) return;

        const userId = "current-user"; // Replace with actual user ID
        const updatedProposal = { ...proposal };
        
        if (proposal.participants.includes(userId)) {
            updatedProposal.participants = proposal.participants.filter(id => id !== userId);
        } else {
            updatedProposal.participants = [...proposal.participants, userId];
            // Remove from stoppers if agreeing
            if (updatedProposal.stoppers) {
                updatedProposal.stoppers = updatedProposal.stoppers.filter(id => id !== userId);
            }
        }
        
        holosphere.put(holonID, "quests", updatedProposal);
    }

    let showAddDialog = false;
    let newTitle = "";
    let newDescription = "";

    function handleSubmit() {
        if (newTitle.trim() && newDescription.trim()) {
            addProposal(newTitle.trim(), newDescription.trim());
            newTitle = "";
            newDescription = "";
            showAddDialog = false;
        }
    }
</script>

<div class="w-full lg:w-8/12 bg-gray-800 py-6 px-6 rounded-3xl ml-0">
    <div class="flex justify-between text-white items-center mb-8">
        <p class="text-2xl font-bold">Proposals</p>
        <button
            on:click={() => showAddDialog = true}
            class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
        >
            New Proposal
        </button>
    </div>

    <ProposalChart 
        proposals={Object.values(proposals)} 
        quorum={5}
    />

    <div class="space-y-4 mt-8">
        {#each sortedProposals as proposal}
            <div 
                class="bg-gray-700 rounded-lg p-4 cursor-pointer hover:bg-gray-600 transition-colors"
                on:click={() => {
                    selectedProposal = proposal;
                    showModal = true;
                }}
            >
                <div class="flex justify-between items-start mb-2">
                    <h3 class="text-lg font-semibold text-white">{proposal.title}</h3>
                    <div class="flex space-x-2">
                        <button
                            on:click|stopPropagation={() => toggleBlock(proposal.id)}
                            class="px-3 py-1 rounded-full {proposal.stoppers?.includes('current-user') 
                                ? 'bg-red-600 hover:bg-red-700' 
                                : 'bg-gray-600 hover:bg-gray-500'} text-white text-sm"
                        >
                            {proposal.stoppers?.includes('current-user') ? 'Blocked' : 'Block'}
                        </button>
                        <button
                            on:click|stopPropagation={() => toggleAgree(proposal.id)}
                            class="px-3 py-1 rounded-full {proposal.participants.includes('current-user') 
                                ? 'bg-green-600 hover:bg-green-700' 
                                : 'bg-gray-600 hover:bg-gray-500'} text-white text-sm"
                            disabled={proposal.stoppers?.includes('current-user')}
                        >
                            {proposal.participants.includes('current-user') ? 'Agreed' : 'Agree'}
                        </button>
                    </div>
                </div>
                <p class="text-gray-300 mb-3">{proposal.description}</p>
                <div class="w-full bg-gray-600 rounded-full h-2.5">
                    <div
                        class="bg-{proposal.stoppers?.length ? 'red' : 'blue'}-600 h-2.5 rounded-full"
                        style="width: {(proposal.participants.length / 10) * 100}%"
                    ></div>
                </div>
                <div class="flex justify-between text-sm text-gray-400 mt-2">
                    <div class="space-x-4">
                        <span>{proposal.participants.length} agreements</span>
                        {#if proposal.stoppers?.length}
                            <span class="text-red-400">{proposal.stoppers.length} stoppers</span>
                        {/if}
                    </div>
                    <span>Created {new Date(proposal.date).toLocaleDateString()}</span>
                </div>
            </div>
        {/each}
    </div>
</div>

{#if showAddDialog}
    <dialog
        class="fixed inset-0 bg-black bg-opacity-50 z-50"
        open
    >
        <div class="fixed inset-0 flex items-center justify-center">
            <form
                on:submit|preventDefault={handleSubmit}
                class="bg-gray-800 p-6 rounded-lg shadow-lg w-96"
            >
                <div class="relative">
                    <div 
                        class="absolute -top-2 -right-2 text-gray-400 hover:text-white cursor-pointer"
                        on:click={() => showAddDialog = false}
                        role="button"
                        tabindex="0"
                    >
                        <svg
                            class="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M6 18L18 6M6 6l12 12"
                            />
                        </svg>
                    </div>
                    <h3 class="text-white text-lg font-bold mb-4">New Proposal</h3>
                </div>
                
                <div class="space-y-4">
                    <div>
                        <input
                            type="text"
                            bind:value={newTitle}
                            placeholder="Proposal title"
                            class="w-full px-3 py-2 rounded-md bg-gray-700 text-white placeholder-gray-400 border-gray-600"
                            required
                        />
                    </div>
                    <div>
                        <textarea
                            bind:value={newDescription}
                            placeholder="Proposal description"
                            class="w-full px-3 py-2 rounded-md bg-gray-700 text-white placeholder-gray-400 border-gray-600 h-32"
                            required
                        ></textarea>
                    </div>
                    <div class="flex justify-end space-x-2">
                        <button
                            type="button"
                            on:click={() => showAddDialog = false}
                            class="px-4 py-2 rounded-md bg-gray-600 text-white hover:bg-gray-500"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            class="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700"
                        >
                            Submit
                        </button>
                    </div>
                </div>
            </form>
        </div>
    </dialog>
{/if} 