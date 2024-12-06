<script lang="ts">
    import { onDestroy, getContext } from "svelte";
    import { formatDate, formatTime } from "../utils/date";
    import type { Writable } from "svelte/store";
    import { ID } from "../dashboard/store";
    import SchemaForm from './SchemaForm.svelte';
    import { schemas, type SchemaName } from '../lib/schemas';

    // Update schema options to use imported schemas
    const schemaOptions = [
        { 
            value: 'quests', 
            label: '✅ Tasks & Quests', 
            schema: 'quests_schema_v0.0.1' as SchemaName
        },
        { 
            value: 'needs', 
            label: '🔍 Local Needs', 
            schema: 'offers_wants_prototype-v0.0.2' as SchemaName
        },
        { 
            value: 'offers', 
            label: '🎁 Available Offers', 
            schema: 'offers_wants_prototype-v0.0.2' as SchemaName
        },
        { 
            value: 'communities', 
            label: '👥 Communities', 
            schema: 'communities_schema-v0.1.0' as SchemaName
        },
        { 
            value: 'organizations', 
            label: '🏢 Organizations', 
            schema: 'organizations_schema-v1.0.0' as SchemaName
        },
        { 
            value: 'projects', 
            label: '📋 Projects', 
            schema: 'projects_schema-v0.1.0' as SchemaName
        },
        { 
            value: 'currencies', 
            label: '💰 Currencies', 
            schema: 'complementary_currencies-v2.0.0' as SchemaName
        },
        { 
            value: 'people', 
            label: '👤 People', 
            schema: 'person_schema-v0.2.0' as SchemaName
        },
        { 
            value: 'holons', 
            label: '🔄 Holons', 
            schema: 'holons_schema-v0.0.1' as SchemaName
        }
    ];

    interface Quest {
        id?: string;
        title: string;
        description?: string;
        when?: string;
        category?: string;
        status?: 'ongoing' | 'completed' | 'cancelled' | 'scheduled';
        participants?: Array<{ id: string; username: string }>;
        appreciation?: string[];
        location?: string;
        date?: number;
    }

    interface Need {
        id?: string;
        title: string;
        description?: string;
        category?: string;
        exchange_type?: string;
        transaction_type?: string[];
        tags?: string[];
        geographic_scope?: string;
        contact_details?: {
            email?: string;
            contact_form?: string;
        };
        date?: number;
    }

    interface Offer {
        id?: string;
        title: string;
        description?: string;
        category?: string;
        exchange_type?: string;
        transaction_type?: string[];
        tags?: string[];
        geographic_scope?: string;
        contact_details?: {
            email?: string;
            contact_form?: string;
        };
        date?: number;
    }

    interface Hub {
        id?: string;
        name: string;
        description?: string;
        location?: string;
        category?: string;
        primary_url?: string;
        tags?: string[];
        date?: number;
    }


    export let selectedLens: string;
    export let hexId: string | null;
    let holosphere = getContext('holosphere');
    let content: Record<string, any> | null = null;
    let subscription: { off: () => void } | null = null;
    let isListView = false;
    let showForm = false;
    let formData: Record<string, any> = {};

    $: if (hexId && selectedLens) {
        unsubscribe();
        subscribe();
    }

    function subscribe() {
        if (!hexId || !selectedLens) return;

        subscription = holosphere.subscribe(hexId, selectedLens, (data: string | Content | null) => {
            if (data) {
                content = typeof data === 'string' ? JSON.parse(data) : data;
            } else {
                content = null;
            }
        });
    }

    function unsubscribe() {
        if (subscription) {
            subscription.off();
            subscription = null;
        }
        content = null;
    }

    onDestroy(unsubscribe);


    function getQuestData(quest: unknown): Quest {
        return quest as Quest;
    }

    function getNeedData(need: unknown): Need {
        return need as Need;
    }

    function getOfferData(offer: unknown): Offer {
        return offer as Offer;
    }

    function getHubData(hub: unknown): Hub {
        return hub as Hub;
    }

    function handleLensChange(event: Event) {
        const select = event.target as HTMLSelectElement;
        selectedLens = select.value;
        formData = {};
    }

    function toggleForm() {
        showForm = !showForm;
        if (!showForm) {
            formData = {};
        }
    }

    async function handleFormSubmit(event: CustomEvent) {
        const formData = event.detail;
        
        if (!hexId) {
            console.error('No hexagon selected');
            return;
        }

        try {
            // ID is handled by the form component
            const updatedContent = {
                ...formData
                
            };

            // Store the updated content
            await holosphere.put(hexId, selectedLens, updatedContent);
            
            // Update local content
            content = updatedContent;
            
            // Hide form after successful submission
            showForm = false;
            
            console.log('Successfully stored new entry:', updatedContent);
        } catch (error) {
            console.error('Failed to store entry:', error);
        }
    }

    // Add color function from Tasks component
    function getColorFromCategory(category: string | undefined): string {
        if (!category) return "#E5E7EB"; // Light gray (gray-200) for items without category

        // Simple string hash function
        let hash = 0;
        for (let i = 0; i < category.length; i++) {
            hash = (hash << 5) - hash + category.charCodeAt(i);
            hash = hash & hash;
        }

        // Generate HSL color with consistent saturation and lightness
        const hue = Math.abs(hash % 360);
        return `hsl(${hue}, 70%, 85%)`; // Pastel colors with good contrast for text
    }

  

    function getSchemaForLens(lens: string): Record<string, any> | null {
        const schemaName = schemaOptions.find(opt => opt.value === lens)?.schema;
        return schemaName ? schemas[schemaName] : null;
    }

</script>

<div class="w-full lg:w-4/12 pl-4">
    <div class="bg-gray-800 rounded-3xl p-6">
        <div class="mb-6">
            <div class="flex items-center justify-between gap-4">
                <select 
                    class="flex-1 bg-gray-700 text-white rounded-lg p-2 border border-gray-600"
                    value={selectedLens}
                    on:change={handleLensChange}
                >
                    <option value="" disabled>Select a lens type...</option>
                    {#each schemaOptions as option}
                        <option value={option.value}>
                            {option.label}
                        </option>
                    {/each}
                </select>
                {#if selectedLens}
                    <button
                        class="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                        on:click={toggleForm}
                    >
                        {#if showForm}
                            <span class="text-lg">×</span> Cancel
                        {:else}
                            <span class="text-lg">+</span> Add New
                        {/if}
                    </button>
                {/if}
            </div>
        </div>

        {#if showForm}
            <div class="mb-6 p-4 bg-gray-700 rounded-lg transition-all">
                {#key selectedLens}
                    <h3 class="text-white font-medium mb-4">
                        Add New {schemaOptions.find(opt => opt.value === selectedLens)?.label.split(' ').slice(1).join(' ')}
                    </h3>
                    {#if selectedLens}
                        <SchemaForm 
                            schema={schemaOptions.find(opt => opt.value === selectedLens)?.schema || ''} 
                            schemaDefinition={getSchemaForLens(selectedLens)}
                            {hexId}
                            initialData={formData}
                            on:submit={handleFormSubmit}
                        />
                    {/if}
                {/key}
            </div>
        {/if}

        {#if !hexId}
            <div class="text-white text-center py-8">
                <p class="text-lg opacity-70">Select a hexagon on the map to view details</p>
            </div>
        {:else if !content}
            <div class="text-white">
                <p class="text-center py-8 opacity-70">No {selectedLens} data available for this area</p>
            </div>    
        {/if}
    </div>
</div>

<style>
 
</style>
  