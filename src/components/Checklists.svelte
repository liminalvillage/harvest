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
            
            checklists = {
                ...checklists,
                [checklistId]: checklist
            };

            holosphere?.put(
                holonID,
                `checklists/${checklistId}`,
                JSON.stringify(checklist)
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
            
            checklists = {
                ...checklists,
                [checklistId]: checklist
            };

            holosphere?.put(
                holonID,
                `checklists/${checklistId}`,
                JSON.stringify(checklist)
            );
        }
    }
</script>

<div class="flex flex-wrap">
    <div class="w-full lg:w-8/12 bg-gray-800 py-6 px-6 rounded-3xl">
        <div class="flex justify-between text-white items-center mb-8">
            <p class="text-2xl font-bold">Checklists</p>
        </div>

        {#if !selectedChecklist}
            <!-- Show list of checklists -->
            <div class="flex flex-wrap">
                {#each checklistEntries as [key, checklist]}
                    <div id={key} class="w-full">
                        <div class="p-1">
                            <div
                                on:click={() => selectChecklist(key)}
                                class="p-3 rounded-3xl flex items-center justify-between cursor-pointer bg-gray-300 hover:bg-gray-400"
                            >
                                <div class="flex items-center space-x-4">
                                    <div class="text-center">
                                        <p class="text-base font-bold opacity-70">
                                            {checklist.id}
                                        </p>
                                        <p class="text-sm opacity-70">
                                            {checklist.items.filter(item => item.checked).length}/{checklist.items.length} completed
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                {/each}
            </div>
        {:else}
            <!-- Show items of selected checklist -->
            <div class="mb-4">
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

            {#if checklists[selectedChecklist]}
                <div class="flex flex-wrap">
                    {#each checklists[selectedChecklist].items as item, index}
                        <div class="w-full">
                            <div class="p-1">
                                <div
                                    on:click={() => toggleItemStatus(selectedChecklist, index)}
                                    class="p-3 rounded-3xl flex items-center justify-between cursor-pointer {item.checked
                                        ? 'bg-green-200 hover:bg-green-300'
                                        : 'bg-gray-300 hover:bg-gray-400'}"
                                >
                                    <div class="flex items-center space-x-4">
                                        <div>
                                            <div class="text-center mb-2">
                                                <p class="text-base font-bold opacity-70">
                                                    {item.text}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                    <input
                                        type="checkbox"
                                        checked={item.checked}
                                        on:click|stopPropagation
                                        on:change={() => toggleItemStatus(selectedChecklist, index)}
                                        class="form-checkbox h-4 w-4 text-blue-600"
                                    />
                                </div>
                            </div>
                        </div>
                    {/each}
                </div>
            {/if}
        {/if}
    </div>
</div>
