<script lang="ts">
    import { createEventDispatcher, getContext, onMount } from "svelte";
    import { fade, scale } from "svelte/transition";
    import HoloSphere from "holosphere";

    export let quest: any;
    export let questId: string;
    export let holonId: string;

    interface User {
        id: string;
        first_name: string;
        last_name?: string;
        picture?: string;
        username: string;
        actions?: Array<any>;
        initiated?: Array<string>;
        completed?: Array<string>;
    }

    interface UserStore {
        [key: string]: User;
    }

    const holosphere = getContext("holosphere") as HoloSphere;

    let userStore: UserStore = {};

    let showDatePicker = false;
    let selectedDate = quest.when ? new Date(quest.when) : new Date();
    let selectedTime = quest.when
        ? new Date(quest.when).toTimeString().slice(0, 5)
        : "12:00";

    let editingTitle = false;
    let editedTitle = quest.title;

    let editingDescription = false;
    let tempDescription = quest.description || "";

    let touchedCard: { key: string; quest: any; x: number; y: number } | null =
        null;
    let touchStartX = 0;
    let touchStartY = 0;

    let tempTitle = quest.title;
    let questCards: Array<{ key: string; quest: any; x: number; y: number }> =
        [];
    let canvas: HTMLCanvasElement;
    let viewContainer: HTMLElement;
    let isPanning = false;
    let startPan = { x: 0, y: 0 };
    let pan = { x: 0, y: 0 };
    let zoom = 1;
    const CANVAS_WIDTH = 2000;
    const CANVAS_HEIGHT = 1500;

    onMount(async () => {
        console.log("[TaskModal.svelte] Mounted. Quest ID:", questId, "Holon ID:", holonId);
        console.log("[TaskModal.svelte] Initial quest prop onMount:", JSON.parse(JSON.stringify(quest || {})));
        console.log("[TaskModal.svelte] Initial quest.participants onMount:", JSON.parse(JSON.stringify(quest.participants || [])));

        document.addEventListener("click", handleClickOutside);

        let unsubscribeUsers: (() => void) | undefined;

        if (holosphere && holonId) {
            // Fetch initial users and build a userStore keyed by user.username
            try {
                const initialUsersData = await holosphere.getAll(holonId, "users");
                let usersKeyedByUsername: UserStore = {};
                if (Array.isArray(initialUsersData)) {
                    console.log("[TaskModal.svelte] initialUsersData from getAll is ARRAY. Converting to map using user.username as key.");
                    initialUsersData.forEach(user => {
                        if (user && user.username) { // Ensure user and user.username are valid
                            usersKeyedByUsername[user.username] = user as User;
                        } else {
                            console.warn("[TaskModal.svelte] Invalid user or missing user.username in initialUsersData array item:", user);
                        }
                    });
                } else if (typeof initialUsersData === 'object' && initialUsersData !== null) {
                    console.log("[TaskModal.svelte] initialUsersData from getAll is OBJECT. Iterating to ensure keys are user.username.");
                    Object.values(initialUsersData).forEach((user: any) => {
                        if (user && user.username) { // Ensure user and user.username are valid
                            usersKeyedByUsername[user.username] = user as User;
                        } else {
                            console.warn("[TaskModal.svelte] Invalid user or missing user.username in initialUsersData object value:", user);
                        }
                    });
                } else {
                    console.warn("[TaskModal.svelte] Initial users data for TaskModal is not array or object:", initialUsersData);
                }
                userStore = usersKeyedByUsername;
                console.log("[TaskModal.svelte] userStore after initial getAll (keyed by username):", JSON.parse(JSON.stringify(userStore)));
            } catch (e) {
                console.error("[TaskModal.svelte] Error fetching initial users for TaskModal:", e);
                userStore = {};
            }

            // Subscribe to user updates - key from subscription might be different from username
            try {
                const off = holosphere.subscribe(holonId, "users", (updatedUser: User | null, subKey?: string) => {
                    const subKeyStr = String(subKey); 

                    if (updatedUser && updatedUser.username) { // Prioritize username as the key
                        const actualUserKey = updatedUser.username; // Canonical key is username
                        console.log(`[TaskModal.svelte] User Add/Update. SubKey from Holosphere: '${subKeyStr}', Using actualUserKey (username): '${actualUserKey}'.`);
                        
                        userStore = { ...userStore, [actualUserKey]: updatedUser };

                        // If subKey from Holosphere was different and existed, remove it (if it wasn't another user's username)
                        if (subKeyStr && subKeyStr !== actualUserKey && userStore.hasOwnProperty(subKeyStr) && (!userStore[subKeyStr] || userStore[subKeyStr]?.username !== subKeyStr)) {
                            console.log(`[TaskModal.svelte] Cleaning up old/mismatched subKey '${subKeyStr}'.`);
                            delete userStore[subKeyStr];
                        }

                    } else if (updatedUser === null) { // Deletion
                        // For deletion, if subKey is a username, use it. 
                        // If subKey is some other ID, we need to find the user by that other ID and delete by username.
                        // This part is tricky if subKey is not the username. We'll assume for now subKey might be the username for deletions or we can't reliably delete.
                        if (!subKeyStr || subKeyStr === 'undefined') {
                            console.warn(`[TaskModal.svelte] User Deletion: Received invalid or undefined subKey: '${subKeyStr}'.`);
                        } else if (userStore.hasOwnProperty(subKeyStr)) { // If subKey itself is a username key
                            console.log(`[TaskModal.svelte] User Deletion. Deleting by username key from Holosphere: '${subKeyStr}'.`);
                            delete userStore[subKeyStr];
                        } else {
                            // If subKey was not a username, we might need to iterate userStore to find the user whose original_id matched subKey.
                            // This is complex. For now, we log a warning if direct key deletion fails.
                            console.warn(`[TaskModal.svelte] User Deletion: subKey '${subKeyStr}' not found as a username key. User might exist under a different key or is already deleted.`);
                        }
                    } else {
                        console.warn(`[TaskModal.svelte] User subscription: Unhandled case or invalid data (e.g. user without username). SubKey: '${subKeyStr}', User:`, updatedUser, "Update skipped.");
                        return;
                    }
                    userStore = { ...userStore }; 
                    console.log("[TaskModal.svelte] userStore after subscription update (keyed by username):", JSON.parse(JSON.stringify(userStore)));
                });
                if (typeof off === 'function') {
                    unsubscribeUsers = off;
                }
            } catch (e) {
                console.error("Error subscribing to user updates in TaskModal:", e);
            }
        }

        return () => {
            document.removeEventListener("click", handleClickOutside);
            if (unsubscribeUsers) {
                unsubscribeUsers();
            }
        };
    });

    const dispatch = createEventDispatcher();
    let showAddParticipants = false;
    let showDropdown = false;

    async function fetchUsersAndShowDropdown() {
        console.log("[TaskModal.svelte] fetchUsersAndShowDropdown called.");
        console.log("[TaskModal.svelte] Current quest.participants:", JSON.parse(JSON.stringify(quest.participants || [])));
        console.log("[TaskModal.svelte] Current userStore:", JSON.parse(JSON.stringify(userStore || {})));

        if (!holosphere) {
            console.error("Cannot show user dropdown: holosphere is not available");
            return;
        }
        // userStore should be populated by onMount. This function now just ensures the dropdown is visible.
        // Optional: Add a check or warning if userStore is empty, though onMount should handle population.
        if (Object.keys(userStore).length === 0 && holonId) {
            console.warn("User store in TaskModal is empty when trying to show dropdown. It should have been populated onMount.");
            // As a fallback, you could attempt a one-time fetch here if truly necessary,
            // but ideally, the onMount subscription keeps it live.
        }
        showDropdown = true; 
    }

    async function updateQuest(updates: any, shouldClose = false) {
        if (!holosphere) {
            console.error("[TaskModal.svelte] Cannot update quest: holosphere is not available");
            return;
        }

        const updatedQuest = { ...quest, ...updates };

        // Log the object *before* putting it
        console.log("[TaskModal.svelte] About to call holosphere.put for quest. Quest ID:", questId, "Holon ID:", holonId);
        try {
            console.log("[TaskModal.svelte] updatedQuest object structure:", Object.keys(updatedQuest).join(', '));
            console.log("[TaskModal.svelte] updatedQuest.participants before put:", JSON.parse(JSON.stringify(updatedQuest.participants || [])));
            // Avoid logging the entire quest if it's huge and causing console lag, focus on participants
            // For more detail if needed: console.log("[TaskModal.svelte] updatedQuest object being sent (full):", JSON.parse(JSON.stringify(updatedQuest)));
        } catch (e) {
            console.error("[TaskModal.svelte] Error logging updatedQuest before put:", e);
        }

        await holosphere.put(holonId, "quests", updatedQuest); // This line triggers the loop for quests
        
        console.log("[TaskModal.svelte] holosphere.put for quest completed. Quest ID:", questId);
        quest = updatedQuest; // Update local quest state

        if (shouldClose) {
            dispatch("close");
        }
    }

    async function deleteQuest() {
        if (!questId || !holonId) {
            console.error("Cannot delete quest: missing parameters", {
                questId,
                holonId,
            });
            return;
        }

        if (confirm("Are you sure you want to delete this task?")) {
            try {
                await holosphere.delete(holonId, "quests", questId);
                dispatch("close", { deleted: true, questId });
            } catch (error) {
                console.error("Error deleting quest:", error);
            }
        }
    }

    function closeModal() {
        dispatch("close");
    }

    async function removeParticipant(participantId: string) {
        const participants = quest.participants.filter(
            (p: { id: string }) => p.id !== participantId,
        );
        await updateQuest({ participants });
    }

    function isUserParticipant(usernameToTest: string): boolean {
        // usernameToTest is a key from our userStore (now user.username)
        if (!quest.participants || quest.participants.length === 0) return false;
        // quest.participants now stores { id: ACTUAL_USER_ID, username: USERNAME_STRING, firstName: ..., lastName: ... }
        return quest.participants.some(
            (p: { id: string; username?: string }) => p.username === usernameToTest 
        );
    }

    async function completeQuest() {
        const newStatus =
            quest.status === "completed" ? "ongoing" : "completed";

        if (newStatus === "completed") {
            // Track initiator action
            if (quest.initiator) {
                const initiatorData = await holosphere.get(
                    holonId,
                    "users",
                    quest.initiator.id,
                );
                if (initiatorData) {
                    await holosphere.put(holonId, "users", {
                        ...initiatorData,
                        initiated: [
                            ...(Array.isArray(initiatorData.initiated) ? initiatorData.initiated : []),
                            quest.title,
                        ],
                        actions: [
                            ...(Array.isArray(initiatorData.actions) ? initiatorData.actions : []),
                            {
                                type: "initiated",
                                action: quest.title,
                                amount: 0,
                                timestamp: new Date(),
                            },
                        ],
                    });
                }
            }

            // Track participant completions
            if (quest.participants) {
                for (const participant of quest.participants) {
                    const userData = await holosphere.get(
                        holonId,
                        "users",
                        participant.id,
                    );
                    if (!userData) {
                        console.error(`User data not found for participant ID: ${participant.id}`);
                        continue;
                    }
                    await holosphere.put(holonId, "users", {
                        ...userData,
                        completed: [...(Array.isArray(userData.completed) ? userData.completed : []), quest.title],
                        actions: [
                            ...(Array.isArray(userData.actions) ? userData.actions : []),
                            {
                                type: "completed",
                                action: quest.title,
                                amount: 0,
                                timestamp: new Date(),
                            },
                        ],
                    });
                }
            }
        }

        await updateQuest({ status: newStatus }, true);
    }

    async function toggleParticipant(usernameToAdd: string) {
        // usernameToAdd is a key from our userStore (now user.username)
        const user = userStore[usernameToAdd];
        if (!user || !user.username) { 
            console.error("User not found in userStore or user.username is missing, for key (username):", usernameToAdd, "User object:", user);
            return;
        }

        // Check if user is already a participant using their username
        if (isUserParticipant(user.username)) {
            console.log(`[TaskModal.svelte] User ${user.username} is already a participant.`);
            showDropdown = false;
            return;
        }

        const newParticipant = {
            id: user.id, // Store the actual user ID
            firstName: user.first_name, // Map to firstName
            lastName: user.last_name,   // Map to lastName
            username: user.username, 
        };

        const newParticipantsArray = [...(quest.participants || []), newParticipant];

        // When updating user data (actions), use the canonical ID that holosphere.get/put expects for users.
        // This might be user.id (the original UUID-like ID) if it exists and is different from username.
        const canonicalUserIdForHolosphere = user.id || user.username; // Choose appropriately
        const userData = (await holosphere.get(holonId, "users", canonicalUserIdForHolosphere)) || {
            id: user.id,
            actions: [],
        };

        await holosphere.put(holonId, "users", {
            ...userData,
            id: user.id,
            actions: [
                ...(Array.isArray(userData.actions) ? userData.actions : []),
                {
                    type: "joined",
                    action: quest.title,
                    category: quest.category || "",
                    amount: 1,
                    timestamp: Date.now(),
                },
            ],
        });

        // Update quest with new participants
        await updateQuest({ participants: newParticipantsArray });
        showDropdown = false;
    }

    function handleClickOutside(event: MouseEvent) {
        const dropdown = document.querySelector(".user-dropdown");
        if (dropdown && !dropdown.contains(event.target as Node)) {
            showDropdown = false;
        }
    }

    async function scheduleTask() {
        const dateTime = new Date(selectedDate);
        const [hours, minutes] = selectedTime.split(":");
        dateTime.setHours(parseInt(hours), parseInt(minutes));

        await updateQuest({
            when: dateTime.toISOString(),
        });
        showDatePicker = false;
    }

    async function saveTitle() {
        if (editedTitle.trim() !== quest.title) {
            await updateQuest({ title: editedTitle.trim() });
        }
        editingTitle = false;
    }

    function handleTouchStart(event: TouchEvent) {
        event.preventDefault();

        // Get the card element that was touched (if any)
        const cardElement = (event.target as HTMLElement).closest(".task-card");
        if (cardElement) {
            // Find the card data that matches this element
            const cardId = cardElement.getAttribute("data-card-id");
            touchedCard =
                questCards.find(
                    (card: { key: string; quest: any; x: number; y: number }) =>
                        card.key === cardId,
                ) || null;

            if (touchedCard && canvas) { // Added canvas check
                const touch = event.touches[0];
                const rect = canvas.getBoundingClientRect();

                // Calculate touch offset relative to card position
                touchStartX =
                    (touch.clientX - rect.left - pan.x) / zoom - touchedCard.x;
                touchStartY =
                    (touch.clientY - rect.top - pan.y) / zoom - touchedCard.y;
                return;
            }
        }

        // If no card was touched, handle canvas panning
        if (event.touches.length === 1) {
            isPanning = true;
            const touch = event.touches[0];
            startPan = {
                x: touch.clientX - pan.x,
                y: touch.clientY - pan.y,
            };
        }
    }

    function handleTouchMove(event: TouchEvent) {
        event.preventDefault();

        if (touchedCard && canvas) { // Added canvas check
            // Move the touched card
            const touch = event.touches[0];
            const rect = canvas.getBoundingClientRect();
            const newX =
                (touch.clientX - rect.left - pan.x) / zoom - touchStartX;
            const newY =
                (touch.clientY - rect.top - pan.y) / zoom - touchStartY;

            questCards = questCards.map(
                (card: { key: string; quest: any; x: number; y: number }) =>
                    card.key === touchedCard?.key
                        ? {
                              ...card,
                              x: Math.min(
                                  Math.max(newX, 0),
                                  CANVAS_WIDTH - 300,
                              ),
                              y: Math.min(
                                  Math.max(newY, 0),
                                  CANVAS_HEIGHT - 200,
                              ),
                          }
                        : card,
            );
        } else if (isPanning && event.touches.length === 1) {
            // Handle canvas panning
            const touch = event.touches[0];
            pan = {
                x: Math.min(
                    Math.max(
                        touch.clientX - startPan.x,
                        viewContainer ? -CANVAS_WIDTH * zoom + viewContainer.clientWidth : -CANVAS_WIDTH * zoom, // Added viewContainer check
                    ),
                    0,
                ),
                y: Math.min(
                    Math.max(
                        touch.clientY - startPan.y,
                        viewContainer ? -CANVAS_HEIGHT * zoom + viewContainer.clientHeight : -CANVAS_HEIGHT * zoom, // Added viewContainer check
                    ),
                    0,
                ),
            };
        }
    }

    function handleTouchEnd(event: TouchEvent) {
        if (touchedCard) {
            // Save the card's new position
            const card = questCards.find(
                (c: { key: string; quest: any; x: number; y: number }) =>
                    c.key === touchedCard?.key,
            );
            if (card) {
                const updatedQuest = {
                    ...card.quest,
                    position: { x: card.x, y: card.y },
                };

                holosphere
                    .put(holonId, "quests", {
                        ...updatedQuest,
                        id: card.key,
                    })
                    .catch((error) =>
                        console.error("Error updating quest position:", error),
                    );
            }
            touchedCard = null;
        }

        isPanning = false;
    }

    // Add this focus action
    function focusOnMount(node: HTMLElement) {
        node.focus();
    }

    function handleTitleEdit() {
        saveTitle();
    }

    function handleTitleKeydown(event: KeyboardEvent) {
        if (event.key === "Enter") {
            saveTitle();
        } else if (event.key === "Escape") {
            tempTitle = quest.title;
            editingTitle = false;
        }
    }

    async function saveDescription() {
        const newDescription = tempDescription.trim();
        const oldDescription = (quest.description || "").trim();

        if (newDescription !== oldDescription) {
            await updateQuest({ description: newDescription });
        }
        editingDescription = false;
    }

    function handleDescriptionKeydown(event: KeyboardEvent) {
        if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            saveDescription();
        } else if (event.key === "Escape") {
            tempDescription = quest.description || "";
            editingDescription = false;
        }
    }

    // Reactive logging for dropdown state
    $: {
        if (showDropdown) {
            const availableUsers = Object.entries(userStore).filter(([userId]) => !isUserParticipant(userId));
            const allUsers = Object.entries(userStore);
            console.log("[TaskModal.svelte] Dropdown Opened - User Store (cloned):", JSON.parse(JSON.stringify(userStore))); 
            console.log("[TaskModal.svelte] Dropdown Opened - Quest Participants (cloned):", JSON.parse(JSON.stringify(quest.participants || [])));
            console.log("[TaskModal.svelte] Dropdown Opened - All Users in Store (from entries):", allUsers.map(u=>u[1].first_name));
            console.log("[TaskModal.svelte] Dropdown Opened - Available Users (Filtered for dropdown):", availableUsers.map(u=>u[1].first_name));
        }
    }
</script>

<div
    data-component="TaskModal"
    class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
    on:click|self={closeModal}
    on:keydown={(e) => e.key === "Escape" && closeModal()}
    role="presentation"
    transition:fade
>
    <div
        class="bg-gray-800 rounded-xl max-w-2xl w-full shadow-xl relative"
        transition:scale={{ duration: 200, start: 0.95 }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
    >
        <button
            class="absolute top-4 right-4 text-gray-400 hover:text-white z-10"
            on:click={closeModal}
            aria-label="Close modal"
        >
            <svg
                class="w-6 h-6"
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
        </button>

        <div class="p-6">
            <!-- Header -->
            <div class="flex justify-between items-start mb-6">
                <div>
                    {#if editingTitle}
                        <!-- Editable title input -->
                        <input
                            type="text"
                            bind:value={tempTitle}
                            class="text-2xl font-bold text-white bg-gray-700 rounded px-2 py-1 w-full"
                            on:blur={handleTitleEdit}
                            on:keydown={handleTitleKeydown}
                            use:focusOnMount
                        />
                    {:else}
                        <!-- Clickable title -->
                        <button
                            type="button"
                            id="modal-title"
                            class="text-2xl font-bold text-white text-left hover:text-gray-300"
                            on:click={() => (editingTitle = true)}
                        >
                            {quest.title}
                        </button>
                    {/if}
                    {#if quest.category}
                        <span
                            class="inline-flex items-center mt-2 text-sm text-gray-400"
                        >
                            <svg
                                class="w-4 h-4 mr-1"
                                viewBox="0 0 24 24"
                                fill="currentColor"
                            >
                                <path
                                    d="M11.03 8h-6.06l-3 8h6.06l3-8zm1.94 0l3 8h6.06l-3-8h-6.06zm1.03-2h4.03l3-2h-4.03l-3 2zm-8 0h4.03l-3-2h-4.03l3 2z"
                                />
                            </svg>
                            {quest.category}
                        </span>
                    {/if}
                </div>
            </div>

            <div class="space-y-6 text-gray-300">
                <!-- Description -->
                <div class="bg-gray-700/50 p-4 rounded-lg">
                    {#if editingDescription}
                        <textarea
                            bind:value={tempDescription}
                            class="text-sm text-white bg-gray-700 rounded px-2 py-1 w-full resize-none border border-gray-600 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                            rows="4"
                            placeholder="Add a description..."
                            on:blur={saveDescription}
                            on:keydown={handleDescriptionKeydown}
                            use:focusOnMount
                        ></textarea>
                    {:else}
                        {#if quest.description}
                            <button  
                                id="modal-description"
                                class="text-sm whitespace-pre-wrap cursor-pointer hover:bg-gray-700 p-1 rounded-md" 
                                on:click={() => {
                                    tempDescription = quest.description || '';
                                    editingDescription = true;
                                }}
            
                                on:keydown={(e) => (e.key === 'Enter' || e.key === ' ') && (tempDescription = quest.description || '', editingDescription = true)}
                            >
                                {quest.description}
                            </button>
                        {:else}
                            <button 
                                class="text-sm text-gray-400 hover:text-white px-2 py-1 rounded-md hover:bg-gray-700"
                                on:click={() => {
                                    tempDescription = ''; // Start with empty for new description
                                    editingDescription = true;
                                }}>
                                + Add description
                            </button>
                        {/if}
                    {/if}
                </div>

                <!-- Schedule Section -->
                <div class="bg-gray-700/30 p-4 rounded-lg space-y-4">
                    <div class="flex justify-between items-center">
                        <h3
                            class="text-lg font-semibold flex items-center gap-2"
                        >
                            <svg
                                class="w-5 h-5 text-gray-400"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                            >
                                <rect
                                    x="3"
                                    y="4"
                                    width="18"
                                    height="18"
                                    rx="2"
                                    ry="2"
                                />
                                <line x1="16" y1="2" x2="16" y2="6" />
                                <line x1="8" y1="2" x2="8" y2="6" />
                                <line x1="3" y1="10" x2="21" y2="10" />
                            </svg>
                            Schedule
                        </h3>
                        <button
                            class="px-3 py-1.5 bg-gray-700 text-gray-200 rounded-lg hover:bg-gray-600 border border-gray-600 transition-colors text-sm"
                            on:click={() => (showDatePicker = !showDatePicker)}
                        >
                            {quest.when ? "Reschedule" : "Schedule Task"}
                        </button>
                    </div>

                    {#if showDatePicker}
                        <div
                            class="bg-gray-700 p-4 rounded-lg border border-gray-600 space-y-4"
                        >
                            <div class="grid grid-cols-2 gap-4">
                                <div class="space-y-2">
                                    <label
                                        for="task-date"
                                        class="block text-sm font-medium text-gray-300"
                                        >Date</label
                                    >
                                    <input
                                        id="task-date"
                                        type="date"
                                        class="w-full bg-gray-800 text-white rounded-lg border border-gray-600 p-2"
                                        bind:value={selectedDate}
                                    />
                                </div>
                                <div class="space-y-2">
                                    <label
                                        for="task-time"
                                        class="block text-sm font-medium text-gray-300"
                                        >Time</label
                                    >
                                    <input
                                        id="task-time"
                                        type="time"
                                        class="w-full bg-gray-800 text-white rounded-lg border border-gray-600 p-2"
                                        bind:value={selectedTime}
                                    />
                                </div>
                            </div>
                            <div class="flex justify-end space-x-2">
                                <button
                                    class="px-3 py-1.5 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-600 border border-gray-600 transition-colors text-sm"
                                    on:click={() => (showDatePicker = false)}
                                >
                                    Cancel
                                </button>
                                <button
                                    class="px-3 py-1.5 bg-gray-800 text-blue-400 rounded-lg hover:bg-gray-600 border border-blue-500 transition-colors text-sm"
                                    on:click={scheduleTask}
                                >
                                    Save Schedule
                                </button>
                            </div>
                        </div>
                    {/if}

                    {#if quest.when}
                        <div
                            class="bg-gray-700/50 p-3 rounded-lg border border-gray-600/50"
                        >
                            <div class="flex items-center justify-between">
                                <div class="flex items-center gap-2">
                                    <span class="text-gray-300">
                                        {new Date(
                                            quest.when,
                                        ).toLocaleDateString()} at {new Date(
                                            quest.when,
                                        ).toLocaleTimeString([], {
                                            hour: "2-digit",
                                            minute: "2-digit",
                                        })}
                                    </span>
                                </div>
                                <button
                                    class="text-gray-400 hover:text-red-400 transition-colors"
                                    on:click={() =>
                                        updateQuest({
                                            when: null,
                                            status: "ongoing",
                                        })}
                                    aria-label="Remove schedule"
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
                                </button>
                            </div>
                        </div>
                    {/if}
                </div>

                <!-- Participants Section -->
                <div class="bg-gray-700/30 p-4 rounded-lg space-y-4">
                    <div class="flex justify-between items-center">
                        <h3
                            class="text-lg font-semibold flex items-center gap-2"
                        >
                            <svg
                                class="w-5 h-5 text-gray-400"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                            >
                                <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="2"
                                    d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                                />
                            </svg>
                            Participants
                        </h3>
                        <button
                            class="px-3 py-1.5 bg-gray-700 text-gray-200 rounded-lg hover:bg-gray-600 border border-gray-600 transition-colors text-sm"
                            on:click|stopPropagation={fetchUsersAndShowDropdown}
                            disabled={!holosphere}
                        >
                            + Add Participant
                        </button>
                    </div>

                    <!-- Current Participants List -->
                    <div class="space-y-2">
                        {#if quest.participants?.length}
                            {#each quest.participants as participant}
                                <div
                                    class="flex items-center justify-between bg-gray-700/50 p-2 rounded-lg border border-gray-600/50"
                                >
                                    <div class="flex items-center gap-2">
                                        <img
                                            src={`https://gun.holons.io/getavatar?user_id=${participant.id}`}
                                            alt={`${participant.firstName} ${participant.lastName || ""}`}
                                            class="w-8 h-8 rounded-full"
                                        />
                                        <span
                                            >{participant.firstName}
                                            {participant.lastName || ""}</span
                                        >
                                    </div>
                                    <button
                                        class="text-gray-400 hover:text-red-400 transition-colors"
                                        on:click={() =>
                                            removeParticipant(participant.id)}
                                        aria-label={`Remove participant ${participant.firstName}`}
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
                                    </button>
                                </div>
                            {/each}
                        {:else}
                            <p class="text-gray-500 text-sm">
                                No participants yet
                            </p>
                        {/if}
                    </div>

                    <!-- User Dropdown -->
                    {#if showDropdown}
                        {@const availableUsers = Object.entries(userStore).filter(([userId]) => !isUserParticipant(userId))}
                        {@const allUsers = Object.entries(userStore)}
                        <div
                            class="bg-gray-700 rounded-lg overflow-hidden mt-2 user-dropdown border border-gray-600"
                        >
                            {#each availableUsers as [userId, user]}
                                <button
                                    class="w-full text-left px-4 py-2 transition-colors flex items-center gap-2 hover:bg-gray-600 text-gray-200"
                                    on:click|stopPropagation={() =>
                                        toggleParticipant(userId)}
                                >
                                    <img
                                        src={`https://gun.holons.io/getavatar?user_id=${user.id}`}
                                        alt={user.first_name}
                                        class="w-6 h-6 rounded-full"
                                    />
                                    <span
                                        >{user.first_name}
                                        {user.last_name || ""}</span
                                    >
                                </button>
                            {/each}
                            {#if availableUsers.length === 0}
                                <div class="px-4 py-2 text-gray-400 text-sm">
                                    No more users available
                                </div>
                            {/if}
                        </div>
                    {/if}
                </div>

                <!-- Action Buttons -->
                <div class="flex gap-2 pt-4">
                    <button
                        class="px-4 py-2 bg-gray-700/50 text-red-400 rounded-lg hover:bg-gray-600 border border-red-500/50 transition-colors"
                        on:click={deleteQuest}
                    >
                        Delete Task
                    </button>

                    <button
                        class="px-4 py-2 bg-gray-700/50 {quest.status ===
                        'completed'
                            ? 'text-yellow-400 border-yellow-500/50'
                            : 'text-green-400 border-green-500/50'} rounded-lg border hover:bg-gray-600 transition-colors"
                        on:click={completeQuest}
                    >
                        {quest.status === "completed"
                            ? "Mark Ongoing"
                            : "Mark Complete"}
                    </button>
                </div>
            </div>
        </div>
    </div>
</div>
