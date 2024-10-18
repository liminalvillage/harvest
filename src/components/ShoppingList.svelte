<script>
    import { onMount, getContext } from 'svelte';
    import { ID } from '../dashboard/store.ts';
    import { formatDate } from '../utils/date';
    import HoloSphere from 'holosphere';

    let holosphere = getContext('holosphere') || new HoloSphere('Holons');

    $: holonID = $ID;
    let store = {};
    $: shoppingItems = Object.entries(store);

    onMount(async () => {
        subscribeToShoppingItems();
    });

    ID.subscribe((value) => {
        holonID = value;
        subscribeToShoppingItems();
    });

    $: update(holonID);

    function subscribeToShoppingItems() {
        store = {};
        if (holosphere) {
            holosphere.subscribe(holonID, 'shoppingItems', (newItem, key) => {
                if (newItem) {
                    store[key] = JSON.parse(newItem);
                } else {
                    delete store[key];
                    store = store;
                }
            });
        }
    }

    function toggleItemStatus(key) {
        if (store[key]) {
            store[key].completed = !store[key].completed;
            holosphere.set(holonID, `shoppingItems/${key}`, JSON.stringify(store[key]));
        }
    }

    function addItem() {
        const newItem = {
            name: '',
            quantity: 1,
            completed: false,
            addedBy: 'Current User', // Replace with actual user info
            addedOn: new Date().toISOString()
        };
        const newKey = holosphere.push(holonID, 'shoppingItems', JSON.stringify(newItem));
        store[newKey] = newItem;
        store = store;
    }

    function update(hex) {
        // You can add any additional logic here if needed
        return shoppingItems;
    }
</script>

<div class="flex flex-wrap">
    <div class="w-full lg:w-8/12 bg-gray-800 py-6 px-6 rounded-3xl">
        <div class="flex justify-between text-white items-center mb-8">
            <p class="text-2xl font-bold">Shopping List</p>
            <button on:click={addItem} class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
                Add Item
            </button>
        </div>

        <div class="flex flex-wrap justify-between items-center pb-8">
            <div class="flex flex-wrap text-white">
                <div class="pr-10">
                    <div class="text-2xl font-bold">
                        {shoppingItems.filter(([_, item]) => !item.completed).length}
                    </div>
                    <div class="">Pending</div>
                </div>
                <div class="pr-10">
                    <div class="text-2xl font-bold">
                        {shoppingItems.filter(([_, item]) => item.completed).length}
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
                <div id={key} class="w-full md:w-6/12 lg:w-4/12">
                    <div class="p-2">
                        <div class="p-4 rounded-3xl {item.completed ? 'bg-green-200' : 'bg-gray-300'}">
                            <div class="flex items-center justify-between mb-2">
                                <span class="text-sm">{formatDate(item.addedOn)}</span>
                                <input
                                    type="checkbox"
                                    checked={item.completed}
                                    on:change={() => toggleItemStatus(key)}
                                    class="form-checkbox h-5 w-5 text-blue-600"
                                />
                            </div>
                            <div class="text-center mb-4">
                                <p class="text-base font-bold opacity-70">{item.name}</p>
                                <p class="text-sm opacity-70 mt-2">Quantity: {item.quantity}</p>
                            </div>
                            <div class="text-sm opacity-70 mb-4">
                                Added by: {item.addedBy}
                            </div>
                        </div>
                    </div>
                </div>
            {/each}
        </div>
    </div>
</div>
