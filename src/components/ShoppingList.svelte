<script lang="ts">
    import { onMount, getContext } from "svelte";
    import { ID } from "../dashboard/store";
    import { formatDate } from "../utils/date";
    import HoloSphere from "holosphere";
    import type { ShoppingItem } from "../types/shoppingItem";

    const holosphere = getContext("holosphere");

    $: holonID = $ID;
    let store: Record<string, ShoppingItem> = {};
    $: shoppingItems = Object.entries(store);

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
                (newItem: string, key: string) => {
                    if (newItem) {
                        store[key] = JSON.parse(newItem);
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
            store[key].completed = !store[key].completed;
            holosphere.put(
                holonID,
                `shopping/${key}`,
                JSON.stringify(store[key])
            );
        }
    }

    // function addItem(): void {
    //     const newItem: ShoppingItem = {
    //         id: '',
    //         name: '',
    //         quantity: 1,
    //         done: false,
    //         addedBy: 'Current User', // Replace with actual user info
    //         addedOn: new Date().toISOString()
    //     };
    //     const newKey = holosphere.put(holonID, 'shopping', JSON.stringify(newItem));
    //     store[newKey] = newItem;
    //     store = store;
    // }
</script>

<div class="flex flex-wrap">
    <div class="w-full lg:w-8/12 bg-gray-800 py-6 px-6 rounded-3xl">
        <div class="flex justify-between text-white items-center mb-8">
            <p class="text-2xl font-bold">Shopping List</p>
            <!-- <button on:click={addItem} class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
                Add Item
            </button> -->
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

        <div class="flex flex-wrap">
            {#each shoppingItems as [key, item]}
                <div id={key} class="w-full">
                    <div class="p-1">
                        <div
                            class="p-3 rounded-3xl flex items-center justify-between {item.done
                                ? 'bg-green-200'
                                : 'bg-gray-300'}"
                        >
                            <div class="flex items-center space-x-4">
                                <div>
                                    <!-- <span class="text-sm">{formatDate(item.addedOn)}</span> -->
                                    <div class="text-center mb-2">
                                        <p
                                            class="text-base font-bold opacity-70"
                                        >
                                            {item.id}
                                        </p>
                                        <!-- <p class="text-sm opacity-70 mt-1">Quantity: {item.quantity}</p> -->
                                    </div>
                                    <!-- <div class="text-sm opacity-70 mb-2">
                                        Added by: {item.addedBy}
                                    </div> -->
                                </div>
                            </div>
                            <input
                                type="checkbox"
                                checked={item.done}
                                on:change={() => toggleItemStatus(key)}
                                class="form-checkbox h-4 w-4 text-blue-600"
                            />
                        </div>
                    </div>
                </div>
            {/each}
        </div>
    </div>
</div>
