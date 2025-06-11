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
        _meta?: {
            resolvedFromHologram?: boolean;
            hologramSoul?: string;
        };
    }

    const holosphere = getContext("holosphere") as HoloSphere;

    $: holonID = $ID;
    let store: Record<string, ShoppingItem> = {};
    let newItemText = "";
    $: shoppingItems = Object.entries(store);
    $: filteredItems = shoppingItems.filter(([_, item]) => {
        // Filter holograms if showHolograms is false
        if (!showHolograms && item._meta?.resolvedFromHologram) {
            return false;
        }
        return true;
    });

    let showInput = false;
    let inputText = "";
    let showHolograms = true;

    // Holon name cache
    let holonNameCache = new Map<string, string>();

    onMount(() => {
        ID.subscribe((value) => {
            holonID = value;
            subscribeToShoppingItems();
        });

        // Load preferences
        try {
            const storedShowHolograms = localStorage.getItem("shoppingShowHolograms");
            if (storedShowHolograms !== null) {
                showHolograms = storedShowHolograms === "true";
            }
        } catch (error) {
            console.error('Error loading preferences:', error);
        }
    });

    // Save showHolograms preference to localStorage
    $: if (typeof localStorage !== 'undefined') {
        localStorage.setItem("shoppingShowHolograms", showHolograms.toString());
    }

    // Add function to fetch holon name
    async function fetchHolonName(holonId: string): Promise<string> {
        if (holonNameCache.has(holonId)) {
            return holonNameCache.get(holonId)!;
        }

        try {
            const settings = await holosphere.get(holonId, "settings", holonId);
            const holonName = settings?.name || `Holon ${holonId}`;
            holonNameCache.set(holonId, holonName);
            return holonName;
        } catch (error) {
            console.error(`Error fetching holon name for ${holonId}:`, error);
            const fallbackName = `Holon ${holonId}`;
            holonNameCache.set(holonId, fallbackName);
            return fallbackName;
        }
    }

    // Add function to extract hologram source
    function getHologramSource(hologramSoul: string | undefined): string {
        if (!hologramSoul) return '';
        // Extract the holon ID from path like "Holons/-1002593778587/shopping/380"
        const match = hologramSoul.match(/Holons\/([^\/]+)/);
        if (!match) return 'External Source';
        
        const holonId = match[1];
        // Return cached name if available, otherwise return ID and fetch name
        if (holonNameCache.has(holonId)) {
            return holonNameCache.get(holonId)!;
        }
        
        // Fetch name asynchronously and trigger reactivity
        fetchHolonName(holonId).then(() => {
            // Trigger reactivity by updating shoppingItems
            shoppingItems = [...shoppingItems];
        });
        
        return `Holon ${holonId}`; // Temporary fallback while loading
    }

    function subscribeToShoppingItems(): void {
        store = {};
        if (holosphere) {
            holosphere.subscribe(
                holonID,
                "shopping",
                (newItem: ShoppingItem | null, key?: string) => {
                    if (newItem && key) {
                        store[key] = newItem;
                    } else if (key) {
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

<div class="space-y-8">
    <!-- Header Section -->
    <div class="bg-gradient-to-r from-gray-800 to-gray-700 py-8 px-8 rounded-3xl shadow-2xl">
        <div class="flex flex-col md:flex-row justify-between items-center">
            <div class="text-center md:text-left mb-4 md:mb-0">
                <h1 class="text-4xl font-bold text-white mb-2">Shopping List</h1>
                <p class="text-gray-300 text-lg">{new Date().toDateString()}</p>
            </div>
        </div>
    </div>

    <!-- Main Content Container -->
    <div class="bg-gray-800 rounded-3xl shadow-xl min-h-[600px]">
        <div class="p-8">
            <!-- Stats Section -->
            <div class="grid grid-cols-3 gap-4 mb-8">
                <div class="bg-gray-700/50 rounded-2xl p-4 text-center">
                    <div class="text-2xl font-bold text-white mb-1">
                        {filteredItems.filter(([_, item]) => !item.done).length}
                    </div>
                    <div class="text-sm text-gray-400">Pending</div>
                </div>
                <div class="bg-gray-700/50 rounded-2xl p-4 text-center">
                    <div class="text-2xl font-bold text-white mb-1">
                        {filteredItems.filter(([_, item]) => item.done).length}
                    </div>
                    <div class="text-sm text-gray-400">Completed</div>
                </div>
                <div class="bg-gray-700/50 rounded-2xl p-4 text-center">
                    <div class="text-2xl font-bold text-white mb-1">{filteredItems.length}</div>
                    <div class="text-sm text-gray-400">Total Items</div>
                </div>
            </div>

            <!-- Controls Section -->
            <div class="mb-6 space-y-4">
                <!-- Show Holograms Toggle -->
                <div class="flex justify-center">
                    <label class="flex items-center cursor-pointer">
                        <div class="relative">
                            <input
                                type="checkbox"
                                class="sr-only"
                                bind:checked={showHolograms}
                            />
                            <div class="w-11 h-6 bg-gray-600 rounded-full shadow-inner border border-gray-500"></div>
                            <div
                                class="dot absolute w-4 h-4 bg-white rounded-full transition-transform duration-300 ease-in-out left-1 top-1"
                                class:translate-x-5={showHolograms}
                            ></div>
                        </div>
                        <div class="ml-3 text-sm font-medium text-white whitespace-nowrap">
                            <span class="hidden sm:inline">Show Holograms</span>
                            <span class="sm:hidden" aria-label="Show hologram items">🔮</span>
                        </div>
                    </label>
                </div>
            </div>

            <!-- Add Item Button -->
            <div class="flex justify-center mb-6">
                <button
                    on:click={showAddInput}
                    class="group flex items-center gap-3 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-medium transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl"
                    aria-label="Add new item"
                >
                    <div class="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center group-hover:bg-white/30 transition-colors">
                        <span class="text-lg font-bold leading-none">+</span>
                    </div>
                    <span>Add New Item</span>
                </button>
            </div>

            <!-- Remove Checked Button -->
            <div class="flex justify-center mb-6">
                <button 
                    on:click={removeChecked}
                    class="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium transition-colors shadow-lg"
                    aria-label="Remove checked items"
                >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                    </svg>
                    Remove Checked
                </button>
            </div>

            <!-- Shopping Items -->
            <div class="space-y-3">
                {#each filteredItems as [key, item]}
                    <div id={key} class="w-full">
                        <button
                            class="w-full text-left group relative"
                            on:click={() => toggleItemStatus(item.id)}
                            aria-label={`Toggle ${item.id} - ${item.done ? 'completed' : 'pending'}`}
                        >
                            <div
                                class="p-4 rounded-xl transition-all duration-300 border border-transparent hover:border-gray-600 hover:shadow-md transform hover:scale-[1.005]"
                                style="background-color: {item.done ? '#374151' : '#E5E7EB'}; 
                                       opacity: {item.done ? '0.7' : item._meta?.resolvedFromHologram ? '0.75' : '1'};
                                       {item._meta?.resolvedFromHologram ? 'border: 2px solid #00BFFF; box-sizing: border-box; box-shadow: 0 0 20px rgba(0, 191, 255, 0.4), inset 0 0 20px rgba(0, 191, 255, 0.1);' : ''}"
                            >
                                <div class="flex items-center justify-between gap-3">
                                    <div class="flex items-center gap-3 flex-1 min-w-0">
                                        <!-- Item Icon -->
                                        <div class="flex-shrink-0 w-8 h-8 rounded-lg bg-black/20 flex items-center justify-center">
                                            <span class="text-sm">{item.done ? '✅' : '🛒'}</span>
                                        </div>

                                        <!-- Main Content -->
                                        <div class="flex-1 min-w-0">
                                            <div class="flex items-center gap-2 mb-1">
                                                {#if item.quantity && item.quantity > 1}
                                                    <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-black/10 text-gray-700 flex-shrink-0">
                                                        {item.quantity}×
                                                    </span>
                                                {/if}
                                                <h3 class="text-base font-bold text-gray-800 truncate">
                                                    {item.id}
                                                </h3>
                                                {#if item._meta?.resolvedFromHologram}
                                                    <button 
                                                        class="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-500/20 text-blue-800 flex-shrink-0 hover:bg-blue-500/30 transition-colors" 
                                                        title="Navigate to source holon: {getHologramSource(item._meta.hologramSoul)}"
                                                        on:click|stopPropagation={() => {
                                                            const match = item._meta?.hologramSoul?.match(/Holons\/([^\/]+)/);
                                                            if (match) {
                                                                window.location.href = `/${match[1]}/shopping`;
                                                            }
                                                        }}
                                                    >
                                                        <svg class="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                                                            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                                                        </svg>
                                                        {getHologramSource(item._meta.hologramSoul)}
                                                        <svg class="w-2 h-2" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
                                                        </svg>
                                                    </button>
                                                {/if}
                                            </div>
                                            <p class="text-sm text-gray-700">
                                                Added by: {item.from}
                                            </p>
                                        </div>
                                    </div>

                                    <!-- Right Side - Checkbox -->
                                    <div class="flex items-center gap-3 flex-shrink-0">
                                        <div class="flex items-center">
                                            <input
                                                type="checkbox"
                                                checked={item.done}
                                                on:click|stopPropagation
                                                on:change={() => toggleItemStatus(item.id)}
                                                class="w-5 h-5 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </button>
                    </div>
                {/each}

                {#if filteredItems.length === 0}
                    <div class="text-center py-12">
                        <div class="w-16 h-16 mx-auto mb-4 bg-gray-700 rounded-full flex items-center justify-center">
                            <svg class="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                            </svg>
                        </div>
                        <h3 class="text-lg font-medium text-white mb-2">No items found</h3>
                        <p class="text-gray-400 mb-4">Get started by adding your first item</p>
                        <button
                            on:click={showAddInput}
                            class="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors"
                        >
                            Add Item
                        </button>
                    </div>
                {/if}
            </div>
        </div>
    </div>
</div>

{#if showInput}
    <div 
        class="fixed inset-0 z-50 overflow-auto bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
        on:click|self={() => showInput = false}
        on:keydown|self={(e) => e.key === 'Escape' && (showInput = false)}
        role="dialog"
        aria-modal="true"
        tabindex="-1"
    >
        <div 
            class="bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md relative border border-gray-700"
            aria-labelledby="item-input-title"
        >
            <div class="p-6">
                <div class="flex items-center justify-between mb-6">
                    <h3 id="item-input-title" class="text-white text-xl font-bold">Add New Item</h3>
                    <button
                        on:click={() => showInput = false}
                        class="text-gray-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-gray-700"
                        aria-label="Close item input dialog"
                    >
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                    </button>
                </div>
                
                <form 
                    on:submit|preventDefault={async (e) => {
                        handleAdd();
                    }}
                    class="space-y-4"
                >
                    <div>
                        <label for="item-name" class="block text-sm font-medium text-gray-300 mb-2">Item Name</label>
                        <input
                            id="item-name"
                            type="text"
                            bind:value={inputText}
                            placeholder="Enter item name..."
                            class="w-full px-4 py-3 rounded-xl bg-gray-700 text-white placeholder-gray-400 border border-gray-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none transition-colors"
                            required
                        />
                    </div>
                    <div class="flex justify-end gap-3 pt-4">
                        <button
                            type="button"
                            on:click={() => showInput = false}
                            class="px-6 py-2.5 text-sm font-medium rounded-xl bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white transition-colors"
                            aria-label="Cancel adding item"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            class="px-6 py-2.5 text-sm font-medium rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg"
                            disabled={!inputText.trim()}
                            aria-label="Add new item"
                        >
                            Add Item
                        </button>
                    </div>
                </form>
            </div>
        </div>
    </div>
{/if}

<style>
    /* Toggle switch styling */
    .dot {
        transition: transform 0.3s ease-in-out;
    }
    .translate-x-5 {
        transform: translateX(1.25rem);
    }
</style>
