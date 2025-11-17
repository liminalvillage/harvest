<script lang="ts">
    import { getContext } from 'svelte';
    import { ID } from '$lib/stores';
    import type { PublicityLevel } from '../types/Quest';
    import type { CalendarPublicitySettings } from '../types/CalendarPublicity';

    export let isOpen = false;

    const holosphere = getContext('holosphere');

    let publicitySettings: CalendarPublicitySettings = {
        id: $ID,
        defaultPublicity: 'internal',
        parentSubscriptions: [],
        childHolons: [],
        globalPublic: false,
        updated: new Date().toISOString()
    };

    let childHolonInput = '';
    let parentHolonInput = '';
    let parentHolonName = '';
    let saving = false;

    // Load current settings
    async function loadSettings() {
        try {
            const settings = await holosphere.get($ID, 'settings', 'calendar_publicity');
            if (settings) {
                publicitySettings = {
                    ...publicitySettings,
                    ...settings
                };
            }
        } catch (error) {
            console.error('Error loading calendar publicity settings:', error);
        }
    }

    // Save settings
    async function saveSettings() {
        saving = true;
        try {
            publicitySettings.updated = new Date().toISOString();
            await holosphere.put($ID, 'settings', {
                id: 'calendar_publicity',
                ...publicitySettings
            });
        } catch (error) {
            console.error('Error saving calendar publicity settings:', error);
        } finally {
            saving = false;
        }
    }

    // Set default publicity level
    async function setDefaultPublicity(level: PublicityLevel) {
        publicitySettings.defaultPublicity = level;
        await saveSettings();
    }

    // Toggle global publicity
    async function toggleGlobalPublicity() {
        publicitySettings.globalPublic = !publicitySettings.globalPublic;
        await saveSettings();
    }

    // Add child holon
    async function addChildHolon() {
        if (!childHolonInput.trim()) return;

        const holonId = childHolonInput.trim();
        if (!publicitySettings.childHolons.includes(holonId)) {
            publicitySettings.childHolons = [...publicitySettings.childHolons, holonId];
            await saveSettings();
        }

        childHolonInput = '';
    }

    // Remove child holon
    async function removeChildHolon(holonId: string) {
        publicitySettings.childHolons = publicitySettings.childHolons.filter(
            id => id !== holonId
        );
        await saveSettings();
    }

    // Subscribe to parent holon
    async function subscribeToParent() {
        if (!parentHolonInput.trim()) return;

        const holonId = parentHolonInput.trim();
        const name = parentHolonName.trim() || holonId;

        // Check if already subscribed
        const existingIndex = publicitySettings.parentSubscriptions.findIndex(
            sub => sub.holonId === holonId
        );

        if (existingIndex >= 0) {
            publicitySettings.parentSubscriptions[existingIndex].subscribed = true;
        } else {
            publicitySettings.parentSubscriptions = [
                ...publicitySettings.parentSubscriptions,
                {
                    holonId,
                    holonName: name,
                    subscribed: true,
                    lastSync: new Date().toISOString()
                }
            ];
        }

        await saveSettings();
        parentHolonInput = '';
        parentHolonName = '';
    }

    // Unsubscribe from parent holon
    async function unsubscribeFromParent(holonId: string) {
        publicitySettings.parentSubscriptions = publicitySettings.parentSubscriptions.filter(
            sub => sub.holonId !== holonId
        );
        await saveSettings();
    }

    // Toggle subscription
    async function toggleSubscription(holonId: string) {
        const sub = publicitySettings.parentSubscriptions.find(s => s.holonId === holonId);
        if (sub) {
            sub.subscribed = !sub.subscribed;
            await saveSettings();
        }
    }

    // Get subscription URL for a parent holon
    function getSubscriptionUrl(holonId: string): string {
        if (typeof window === 'undefined') return '';
        return `${window.location.origin}/${holonId}/calendar/feed.ics?subscriber=${$ID}`;
    }

    // Copy URL to clipboard
    async function copyUrl(url: string) {
        try {
            await navigator.clipboard.writeText(url);
        } catch (error) {
            console.error('Error copying URL:', error);
        }
    }

    $: if (isOpen) {
        loadSettings();
    }
</script>

{#if isOpen}
    <div class="modal-overlay" on:click={() => isOpen = false}>
        <div class="modal-content" on:click|stopPropagation>
            <div class="modal-header">
                <h2>Calendar Publicity Settings</h2>
                <button class="close-btn" on:click={() => isOpen = false}>×</button>
            </div>

            <div class="modal-body">
                <!-- Default Publicity Level -->
                <section class="settings-section">
                    <h3>Default Publicity for New Events</h3>
                    <p class="description">Choose the default publicity level for newly created events.</p>

                    <div class="publicity-options">
                        <button
                            class="publicity-btn"
                            class:active={publicitySettings.defaultPublicity === 'internal'}
                            on:click={() => setDefaultPublicity('internal')}
                        >
                            <span class="icon">🔒</span>
                            <span class="label">Internal</span>
                            <span class="desc">Only visible within this holon</span>
                        </button>

                        <button
                            class="publicity-btn"
                            class:active={publicitySettings.defaultPublicity === 'children'}
                            on:click={() => setDefaultPublicity('children')}
                        >
                            <span class="icon">👥</span>
                            <span class="label">Children</span>
                            <span class="desc">Child holons can subscribe</span>
                        </button>

                        <button
                            class="publicity-btn"
                            class:active={publicitySettings.defaultPublicity === 'network'}
                            on:click={() => setDefaultPublicity('network')}
                        >
                            <span class="icon">🌐</span>
                            <span class="label">Network</span>
                            <span class="desc">Globally visible to all</span>
                        </button>
                    </div>
                </section>

                <!-- Global Publicity Toggle -->
                <section class="settings-section">
                    <h3>Global Calendar Publicity</h3>
                    <p class="description">Make all events publicly visible regardless of individual event settings.</p>

                    <label class="toggle-label">
                        <input
                            type="checkbox"
                            checked={publicitySettings.globalPublic}
                            on:change={toggleGlobalPublicity}
                        />
                        <span>Enable global publicity</span>
                    </label>
                </section>

                <!-- Child Holons -->
                <section class="settings-section">
                    <h3>Child Holons (Can Subscribe)</h3>
                    <p class="description">Add child holons that can subscribe to your calendar events.</p>

                    <div class="input-group">
                        <input
                            type="text"
                            placeholder="Child holon ID"
                            bind:value={childHolonInput}
                            on:keydown={(e) => e.key === 'Enter' && addChildHolon()}
                        />
                        <button on:click={addChildHolon} disabled={!childHolonInput.trim()}>
                            Add
                        </button>
                    </div>

                    <ul class="holon-list">
                        {#each publicitySettings.childHolons as holonId}
                            <li>
                                <span class="holon-id">{holonId}</span>
                                <button class="remove-btn" on:click={() => removeChildHolon(holonId)}>
                                    Remove
                                </button>
                            </li>
                        {:else}
                            <li class="empty">No child holons added</li>
                        {/each}
                    </ul>
                </section>

                <!-- Parent Subscriptions -->
                <section class="settings-section">
                    <h3>Parent Calendar Subscriptions</h3>
                    <p class="description">Subscribe to calendar events from parent holons.</p>

                    <div class="input-group">
                        <input
                            type="text"
                            placeholder="Parent holon ID"
                            bind:value={parentHolonInput}
                        />
                        <input
                            type="text"
                            placeholder="Name (optional)"
                            bind:value={parentHolonName}
                        />
                        <button on:click={subscribeToParent} disabled={!parentHolonInput.trim()}>
                            Subscribe
                        </button>
                    </div>

                    <ul class="holon-list">
                        {#each publicitySettings.parentSubscriptions as subscription}
                            <li>
                                <div class="subscription-info">
                                    <span class="holon-name">{subscription.holonName}</span>
                                    <span class="holon-id">{subscription.holonId}</span>
                                    {#if subscription.lastSync}
                                        <span class="last-sync">
                                            Last sync: {new Date(subscription.lastSync).toLocaleString()}
                                        </span>
                                    {/if}
                                </div>
                                <div class="subscription-actions">
                                    <label class="toggle-label">
                                        <input
                                            type="checkbox"
                                            checked={subscription.subscribed}
                                            on:change={() => toggleSubscription(subscription.holonId)}
                                        />
                                        <span>Active</span>
                                    </label>
                                    <button
                                        class="copy-btn"
                                        on:click={() => copyUrl(getSubscriptionUrl(subscription.holonId))}
                                        title="Copy subscription URL"
                                    >
                                        📋
                                    </button>
                                    <button
                                        class="remove-btn"
                                        on:click={() => unsubscribeFromParent(subscription.holonId)}
                                    >
                                        Remove
                                    </button>
                                </div>
                            </li>
                        {:else}
                            <li class="empty">No parent subscriptions</li>
                        {/each}
                    </ul>
                </section>
            </div>

            <div class="modal-footer">
                {#if saving}
                    <span class="saving-indicator">Saving...</span>
                {/if}
                <button class="close-btn-footer" on:click={() => isOpen = false}>
                    Close
                </button>
            </div>
        </div>
    </div>
{/if}

<style>
    .modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
    }

    .modal-content {
        background: white;
        border-radius: 8px;
        max-width: 800px;
        max-height: 90vh;
        width: 90%;
        display: flex;
        flex-direction: column;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }

    .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 1.5rem;
        border-bottom: 1px solid #e5e7eb;
    }

    .modal-header h2 {
        margin: 0;
        font-size: 1.5rem;
        color: #111827;
    }

    .close-btn {
        background: none;
        border: none;
        font-size: 2rem;
        cursor: pointer;
        color: #6b7280;
        line-height: 1;
    }

    .close-btn:hover {
        color: #111827;
    }

    .modal-body {
        padding: 1.5rem;
        overflow-y: auto;
        flex: 1;
    }

    .settings-section {
        margin-bottom: 2rem;
    }

    .settings-section h3 {
        margin: 0 0 0.5rem 0;
        font-size: 1.125rem;
        color: #111827;
    }

    .description {
        margin: 0 0 1rem 0;
        font-size: 0.875rem;
        color: #6b7280;
    }

    .publicity-options {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 1rem;
    }

    .publicity-btn {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 1rem;
        border: 2px solid #e5e7eb;
        border-radius: 8px;
        background: white;
        cursor: pointer;
        transition: all 0.2s;
    }

    .publicity-btn:hover {
        border-color: #3b82f6;
        background: #eff6ff;
    }

    .publicity-btn.active {
        border-color: #3b82f6;
        background: #dbeafe;
    }

    .publicity-btn .icon {
        font-size: 2rem;
        margin-bottom: 0.5rem;
    }

    .publicity-btn .label {
        font-weight: 600;
        color: #111827;
        margin-bottom: 0.25rem;
    }

    .publicity-btn .desc {
        font-size: 0.75rem;
        color: #6b7280;
        text-align: center;
    }

    .toggle-label {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        cursor: pointer;
    }

    .toggle-label input[type="checkbox"] {
        width: 1.25rem;
        height: 1.25rem;
        cursor: pointer;
    }

    .input-group {
        display: flex;
        gap: 0.5rem;
        margin-bottom: 1rem;
    }

    .input-group input {
        flex: 1;
        padding: 0.5rem;
        border: 1px solid #d1d5db;
        border-radius: 4px;
        font-size: 0.875rem;
    }

    .input-group button {
        padding: 0.5rem 1rem;
        background: #3b82f6;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 0.875rem;
    }

    .input-group button:hover:not(:disabled) {
        background: #2563eb;
    }

    .input-group button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .holon-list {
        list-style: none;
        padding: 0;
        margin: 0;
    }

    .holon-list li {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0.75rem;
        border: 1px solid #e5e7eb;
        border-radius: 4px;
        margin-bottom: 0.5rem;
    }

    .holon-list li.empty {
        color: #6b7280;
        font-style: italic;
        justify-content: center;
    }

    .holon-id {
        font-family: monospace;
        font-size: 0.875rem;
        color: #6b7280;
    }

    .holon-name {
        font-weight: 600;
        color: #111827;
    }

    .subscription-info {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
    }

    .last-sync {
        font-size: 0.75rem;
        color: #9ca3af;
    }

    .subscription-actions {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }

    .copy-btn,
    .remove-btn {
        padding: 0.25rem 0.75rem;
        font-size: 0.875rem;
        border: none;
        border-radius: 4px;
        cursor: pointer;
    }

    .copy-btn {
        background: #f3f4f6;
        color: #374151;
    }

    .copy-btn:hover {
        background: #e5e7eb;
    }

    .remove-btn {
        background: #fee2e2;
        color: #dc2626;
    }

    .remove-btn:hover {
        background: #fecaca;
    }

    .modal-footer {
        display: flex;
        justify-content: flex-end;
        align-items: center;
        gap: 1rem;
        padding: 1.5rem;
        border-top: 1px solid #e5e7eb;
    }

    .saving-indicator {
        font-size: 0.875rem;
        color: #6b7280;
    }

    .close-btn-footer {
        padding: 0.5rem 1.5rem;
        background: #6b7280;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 0.875rem;
    }

    .close-btn-footer:hover {
        background: #4b5563;
    }
</style>
