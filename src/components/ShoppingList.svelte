<script lang="ts">
    import { onMount, getContext } from "svelte";
    import { ID } from "../dashboard/store";
    import HoloSphere from "holosphere";

    interface ShoppingItem {
        id: string;
        quantity: number;
        done: boolean;
        from: string;
        addedOn: string;
    }

    const holosphere = getContext("holosphere") as HoloSphere;

    $: holonID = $ID;
    let store: Record<string, ShoppingItem> = {};
    let newItemText = "";
    $: shoppingItems = Object.entries(store);

    let showInput = false;
    let inputText = "";

    onMount(() => {
        ID.subscribe((value) => {
            holonID = value;
            subscribeToShoppingItems();
        });
    });

    function subscribeToShoppingItems(): void {
        store = {};
        if (holosphere) {
            holosphere.subscribe(
                holonID,
                "shopping",
                (newItem: object | string, key: string) => {
                    if (newItem) {
                        store[key] = typeof newItem === 'string' ? JSON.parse(newItem) : newItem;
                    } else {
                        delete store[key];
                    }
                    store = store;
                }
            );
        }
    }

    function toggleItemStatus(key: string): void {
        if (store[key]) {
            const item = { ...store[key], done: !store[key].done };

            holosphere.put(
                holonID,
                "shopping",
                item
            );
        }
    }

    function showAddInput() {
        inputText = "";
        showInput = true;
    }

    function handleAdd() {
        if (!inputText.trim()) return;
        
        const newItem: ShoppingItem = {
            id: inputText.trim(),
            quantity: 1,
            done: false,
            from: 'Dashboard User',
            addedOn: new Date().toISOString()
        };

        holosphere.put(
            holonID,
            "shopping",
            newItem
        );
        
        showInput = false;
        inputText = "";
    }

    function removeChecked(): void {
        const checkedItems = Object.entries(store)
            .filter(([_, item]) => item.done)
            .map(([key]) => key);

        checkedItems.forEach(key => {
            holosphere.delete(
                holonID,
                "shopping",
                key
            );
        });
    }
</script>

<div class="flex flex-wrap">
    <div class="w-full lg:w-8/12 bg-gray-800 py-6 px-6 rounded-3xl">
        <div class="flex justify-between text-white items-center mb-8">
            <p class="text-2xl font-bold">Shopping List</p>
        </div>

        <div class="flex flex-wrap justify-between items-center pb-8">
            <div class="flex flex-wrap text-white">
                <div class="pr-10">
                    <div class="text-2xl font-bold">
                        {shoppingItems.filter(([_, item]) => !item.done).length}
                    </div>
                    <div class="">Pending</div>
                </div>
                <div class="pr-10">
                    <div class="text-2xl font-bold">
                        {shoppingItems.filter(([_, item]) => item.done).length}
                    </div>
                    <div class="">Completed</div>
                </div>
                <div>
                    <div class="text-2xl font-bold">{shoppingItems.length}</div>
                    <div class="">Total Items</div>
                </div>
            </div>
        </div>

        <div class="mb-4">
            <div class="flex justify-end items-center">
                <button 
                    on:click={removeChecked}
                    class="text-white hover:underline flex items-center"
                >
                    Remove Checked
                    <svg 
                        class="w-4 h-4 ml-2" 
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                    >
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

        <div class="flex flex-wrap">
            {#each shoppingItems as [key, item]}
                <div id={key} class="w-full">
                    <div class="p-1">
                        <div
                            class="p-3 rounded-3xl flex items-center justify-between cursor-pointer {item.done
                                ? 'bg-green-200 hover:bg-green-300'
                                : 'bg-gray-300 hover:bg-gray-400'}"
                            role="button"
                            tabindex="0"
                            on:click={() => toggleItemStatus(item.id)}
                            on:keypress={(e) => e.key === 'Enter' && toggleItemStatus(item.id)}
                        >
                            <div class="flex items-center justify-between flex-grow mr-4">
                                <div class="flex items-center">
                                    {#if item.quantity}
                                    <p class="text-base font-bold opacity-70 mr-2">
                                        {item.quantity}×
                                    </p>
                                    {/if}
                                    <p class="text-base font-bold opacity-70 w-48">
                                        {item.id}
                                    </p>
                                </div>
                                <p class="text-sm opacity-70">Added by: {item.from}</p>
                            </div>
                            <input
                                type="checkbox"
                                checked={item.done}
                                on:click|stopPropagation
                                on:change={() => toggleItemStatus(item.id)}
                                class="form-checkbox h-4 w-4 text-blue-600"
                            />
                        </div>
                    </div>
                </div>
            {/each}
        </div>

        <div class="flex justify-center mt-4">
            <button 
                on:click={showAddInput}
                class="w-12 h-12 rounded-full bg-gray-700 hover:bg-gray-600 text-white text-3xl font-bold flex items-center justify-center focus:outline-none"
            >
                +
            </button>
        </div>
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
                    Add New Item
                </h3>
            </div>
            <div class="flex">
                <input
                    type="text"
                    bind:value={inputText}
                    placeholder="Item name..."
                    class="w-full px-3 py-2 text-sm rounded-l-md focus:outline-none bg-gray-700 text-white placeholder-gray-400 border-gray-600"
                    on:keydown={(e) => {
                        if (e.key === 'Enter') {
                            handleAdd();
                        } else if (e.key === 'Escape') {
                            showInput = false;
                        }
                    }}
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
