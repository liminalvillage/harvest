<script lang="ts">
    import { onMount, getContext } from "svelte";
    import { ID } from "../dashboard/store";
    import HoloSphere from "holosphere";

    interface ChecklistItem {
        text: string;
        checked: boolean;
    }

    interface Checklist {
        id: string;
        items: ChecklistItem[];
        creator?: string;
        created?: Date;
    }

    const holosphere = getContext("holosphere") as HoloSphere;

    $: holonID = $ID;
    let checklists: Record<string, Checklist> = {};
    let selectedChecklist: string | null = null;
    
    $: checklistEntries = Object.entries(checklists);

    let showInput = false;
    let inputText = "";
    let isAddingChecklist = false;

    onMount(() => {
        ID.subscribe((value) => {
            holonID = value;
            subscribeToChecklists();
        });
    });

    function subscribeToChecklists(): void {
        checklists = {};
        if (holosphere) {
            holosphere.subscribe(
                holonID,
                "checklists",
                (newItem: string, key: string) => {
                    if (newItem) {
                        checklists[key] = JSON.parse(newItem);
                    } else {
                        delete checklists[key];
                    }
                    checklists = checklists;
                }
            );
        }
    }

    function toggleItemStatus(checklistId: string, itemIndex: number): void {
        if (checklists[checklistId]) {
            const checklist = {...checklists[checklistId]};
            checklist.items = [...checklist.items];
            checklist.items[itemIndex] = {
                ...checklist.items[itemIndex],
                checked: !checklist.items[itemIndex].checked
            };
            
            holosphere.put(
                holonID,
                "checklists",
                checklist
            );
        }
    }

    function selectChecklist(checklistId: string): void {
        selectedChecklist = checklistId;
    }

    function clearChecklist(checklistId: string | null): void {
        if (checklistId && checklists[checklistId]) {
            const checklist = {...checklists[checklistId]};
            checklist.items = checklist.items.map(item => ({
                ...item,
                checked: false
            }));
            
            holosphere.put(
                holonID,
                "checklists",
                checklist
            );
        }
    }

    function showAddInput(forChecklist: boolean) {
        isAddingChecklist = forChecklist;
        inputText = "";
        showInput = true;
    }

    function handleAdd() {
        if (!inputText.trim()) return;
        
        if (isAddingChecklist) {
            const newChecklist = {
                id: inputText.trim(),
                items: [],
                creator: 'Dashboard User',
                created: new Date().toISOString()
            };
            holosphere.put(
                holonID,
                "checklists",
                newChecklist
            );
        } else if (selectedChecklist) {
            const checklist = {...checklists[selectedChecklist]};
            checklist.items = [
                ...checklist.items,
                {
                    text: inputText.trim(),
                    checked: false
                }
            ];
            holosphere.put(
                holonID,
                "checklists",
                checklist
            );
        }
        
        showInput = false;
        inputText = "";
    }

    function deleteChecklist(checklistId: string): void {
        holosphere.delete(
            holonID,
            "checklists",
            checklistId
        );
    }

    function removeItem(checklistId: string, itemIndex: number): void {
        if (checklistId && checklists[checklistId]) {
            const checklist = {...checklists[checklistId]};
            checklist.items = checklist.items.filter((_, index) => index !== itemIndex);
            
            holosphere.put(
                holonID,
                "checklists",
                checklist
            );
        }
    }
</script>

<div class="flex flex-wrap">
    <div class="w-full lg:w-8/12 bg-gray-800 py-6 px-6 rounded-3xl">
        <div class="flex justify-between text-white items-center mb-8">
            <p class="text-2xl font-bold">
                {#if selectedChecklist && checklists[selectedChecklist]}
                    {checklists[selectedChecklist].id}
                {:else}
                    Checklists
                {/if}
            </p>
        </div>

        {#if !selectedChecklist}
            <!-- Show list of checklists -->
            <div class="flex flex-wrap">
                {#each checklistEntries as [key, checklist]}
                    <div id={key} class="w-full">
                        <div class="p-1">
                            <div
                                class="p-3 rounded-3xl flex items-center justify-between cursor-pointer bg-gray-300 hover:bg-gray-400"
                            >
                                <div
                                    on:click={() => selectChecklist(key)}
                                    class="flex items-center space-x-4 flex-grow"
                                >
                                    <div>
                                        <p class="text-base font-bold opacity-70">
                                            {checklist.id}
                                        </p>
                                        <p class="text-sm opacity-70">
                                            {checklist.items.filter(item => item.checked).length}/{checklist.items.length} completed
                                        </p>
                                    </div>
                                </div>
                                <button 
                                    on:click|stopPropagation={() => deleteChecklist(key)}
                                    class="text-gray-600 hover:text-red-600"
                                >
                                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    </div>
                {/each}
            </div>
            <div class="flex justify-center mt-4">
                <button 
                    on:click={() => showAddInput(true)}
                    class="w-12 h-12 rounded-full bg-gray-700 hover:bg-gray-600 text-white text-3xl font-bold flex items-center justify-center focus:outline-none"
                >
                    +
                </button>
            </div>
        {:else if checklists[selectedChecklist]}
            <!-- Show items of selected checklist -->
            <div class="mb-4">
                <div class="flex justify-between items-center">
                    <div>
                        <button 
                            on:click={() => selectedChecklist = null}
                            class="text-white hover:underline"
                        >
                            ← Back to Checklists
                        </button>
                        <button 
                            on:click={() => clearChecklist(selectedChecklist)}
                            class="ml-4 text-white hover:underline"
                        >
                            Clear All
                        </button>
                    </div>
                </div>
            </div>

            <div class="flex flex-wrap">
                {#each checklists[selectedChecklist].items as item, index}
                    <div class="w-full">
                        <div class="p-1">
                            <div
                                class="p-3 rounded-3xl flex items-center justify-between cursor-pointer {item.checked
                                    ? 'bg-green-200 hover:bg-green-300'
                                    : 'bg-gray-300 hover:bg-gray-400'}"
                            >
                                <div
                                    on:click={() => toggleItemStatus(selectedChecklist, index)}
                                    class="flex items-center space-x-4 flex-grow"
                                >
                                    <div>
                                        <div class="mb-2">
                                            <p class="text-base font-bold opacity-70">
                                                {item.text}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                <div class="flex items-center space-x-2">
                                    <input
                                        type="checkbox"
                                        checked={item.checked}
                                        on:click|stopPropagation
                                        on:change={() => toggleItemStatus(selectedChecklist, index)}
                                        class="form-checkbox h-4 w-4 text-blue-600"
                                    />
                                    <button 
                                        on:click|stopPropagation={() => removeItem(selectedChecklist, index)}
                                        class="text-gray-600 hover:text-red-600"
                                    >
                                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path 
                                                stroke-linecap="round" 
                                                stroke-linejoin="round" 
                                                stroke-width="2" 
                                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                            />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                {/each}
            </div>

            <div class="flex justify-center mt-4">
                <button 
                    on:click={() => showAddInput(false)}
                    class="w-12 h-12 rounded-full bg-gray-700 hover:bg-gray-600 text-white text-3xl font-bold flex items-center justify-center focus:outline-none"
                >
                    +
                </button>
            </div>
        {/if}
    </div>
</div>

{#if showInput}
    <div 
        class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center"
        on:click|self={() => showInput = false}
    >
        <div class="bg-gray-800 p-6 rounded-lg shadow-lg w-96">
            <div class="relative">
                <button
                    on:click={() => showInput = false}
                    class="absolute -top-2 -right-2 text-gray-400 hover:text-white"
                >
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
                <h3 class="text-white text-lg font-bold mb-4">
                    {isAddingChecklist ? 'Add New Checklist' : 'Add New Item'}
                </h3>
            </div>
            <div class="flex">
                <input
                    type="text"
                    bind:value={inputText}
                    placeholder={isAddingChecklist ? "Checklist name..." : "Item text..."}
                    class="w-full px-3 py-2 text-sm rounded-l-md focus:outline-none bg-gray-700 text-white placeholder-gray-400 border-gray-600"
                    on:keydown={(e) => {
                        if (e.key === 'Enter') {
                            handleAdd();
                        } else if (e.key === 'Escape') {
                            showInput = false;
                        }
                    }}
                    autofocus
                />
                <button
                    on:click={handleAdd}
                    class="bg-gray-600 hover:bg-gray-500 text-white px-4 py-2 rounded-r-md"
                >
                    Add
                </button>
            </div>
        </div>
    </div>
{/if}

