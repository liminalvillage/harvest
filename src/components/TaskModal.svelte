<script lang="ts">
    import { createEventDispatcher, getContext, onMount } from "svelte";
    import { fade, scale } from "svelte/transition";
    import HoloSphere from "holosphere";
    import { getHologramSourceName } from "../utils/holonNames";
    import { formatDate } from "../utils/date";

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
    let canvas: HTMLCanvasElement | undefined;
    let viewContainer: HTMLElement | undefined;
    let isPanning = false;
    let startPan = { x: 0, y: 0 };
    let pan = { x: 0, y: 0 };
    let zoom = 1;
    const CANVAS_WIDTH = 2000;
    const CANVAS_HEIGHT = 1500;

    // Function to get hologram source name using centralized service
    function getHologramSource(hologramSoul: string | undefined): string {
        if (!hologramSoul) return '';
        
        // Use the centralized service to get hologram source name
        // Don't use callback to avoid reactive loops - just return cached value
        return getHologramSourceName(holosphere, hologramSoul);
    }

    // Add function to navigate to hologram source
    function navigateToHologramSource() {
        if (!quest._meta?.hologramSoul) return;
        
        const match = quest._meta.hologramSoul.match(/Holons\/([^\/]+)/);
        if (match) {
            const sourceHolonId = match[1];
            // Navigate to the source holon
            window.location.href = `/${sourceHolonId}`;
        }
    }

    onMount(() => {
        document.addEventListener("click", handleClickOutside);

        let unsubscribeUsers: (() => void) | undefined;

        if (holosphere && holonId) {
            // Fetch initial users and build a userStore keyed by user.username
            (async () => {
                try {
                    const initialUsersData = await holosphere.getAll(holonId, "users");
                    let usersKeyedByUsername: UserStore = {};
                    if (Array.isArray(initialUsersData)) {
                        initialUsersData.forEach(user => {
                            if (user && user.username) { // Ensure user and user.username are valid
                                usersKeyedByUsername[user.username] = user as User;
                            } else {
                                console.warn("[TaskModal.svelte] Invalid user or missing user.username in initialUsersData array item:", user);
                            }
                        });
                    } else if (typeof initialUsersData === 'object' && initialUsersData !== null) {
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
                } catch (e) {
                    console.error("[TaskModal.svelte] Error fetching initial users for TaskModal:", e);
                    userStore = {};
                }
            })();

            // Subscribe to user updates - key from subscription might be different from username
            try {
                const off = holosphere.subscribe(holonId, "users", (updatedUser: User | null, subKey?: string) => {
                    const subKeyStr = String(subKey); 

                    if (updatedUser && updatedUser.username) { // Prioritize username as the key
                        const actualUserKey = updatedUser.username; // Canonical key is username
                        
                        userStore = { ...userStore, [actualUserKey]: updatedUser };

                        // If subKey from Holosphere was different and existed, remove it (if it wasn't another user's username)
                        if (subKeyStr && subKeyStr !== actualUserKey && userStore.hasOwnProperty(subKeyStr) && (!userStore[subKeyStr] || userStore[subKeyStr]?.username !== subKeyStr)) {
                            delete userStore[subKeyStr];
                        }

                    } else if (updatedUser === null) { // Deletion
                        // For deletion, if subKey is a username, use it. 
                        // If subKey is some other ID, we need to find the user by that other ID and delete by username.
                        // This part is tricky if subKey is not the username. We'll assume for now subKey might be the username for deletions or we can't reliably delete.
                        if (!subKeyStr || subKeyStr === 'undefined') {
                            console.warn(`[TaskModal.svelte] User Deletion: Received invalid or undefined subKey: '${subKeyStr}'.`);
                        } else if (userStore.hasOwnProperty(subKeyStr)) { // If subKey itself is a username key
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

        await holosphere.put(holonId, "quests", updatedQuest); // This line triggers the loop for quests
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
        
        // Also reset time tracking for the removed participant
        const updatedTimeTracking = { ...quest.timeTracking };
        if (updatedTimeTracking[participantId]) {
            delete updatedTimeTracking[participantId];
        }
        
        await updateQuest({ 
            participants,
            timeTracking: updatedTimeTracking
        });
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

            // Create expense entries for all time tracked
            if (quest.timeTracking) {
                for (const [userID, hours] of Object.entries(quest.timeTracking)) {
                    const hoursAsNumber = hours as number;
                    if (hoursAsNumber > 0) {
                        // Create expense entry for the time logged, using chatID for splitWith
                        try {
                            const messageID = `${questId}_time_${userID}_${Date.now()}`; // Unique ID for this expense
                            await holosphere.put(holonId, "expenses", {
                                id: messageID,
                                chatID: holonId,
                                amount: hoursAsNumber, // Total hours logged
                                unit: 'hour',
                                description: quest.title,
                                paidBy: userID,
                                splitWith: [holonId], // Split with the current holon (chatID)
                                timestamp: new Date().toISOString(),
                                fromTimeTracking: true, // Flag to identify expenses from time tracking
                                questId: questId
                            });
                        } catch (error) {
                            console.error(`Error adding time tracking expense for user ${userID}:`, error);
                        }
                    }
                }
            }

            await updateQuest({ status: newStatus, completed_at: new Date().toISOString() });
            dispatch("taskCompleted", { questId });
            dispatch("close");
        } else {
            await updateQuest({ status: newStatus, completed_at: null });
        }
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
    
    // Create a hologram of the task in the participant's personal holon
    try {
        const hologram = holosphere.createHologram(holonId, 'quests', quest);
        await holosphere.put(user.id, 'quests', hologram);
    } catch (error) {
        console.error(`[TaskModal.svelte] Error creating hologram in participant's holon (${user.id}):`, error);
    }
    
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
        if (tempTitle.trim() !== quest.title) {
            await updateQuest({ title: tempTitle.trim() });
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

    // Add touch handling for buttons
    function handleButtonTouchStart(event: TouchEvent) {
        // Add visual feedback for touch
        const button = event.currentTarget as HTMLElement;
        button.style.transform = 'scale(0.95)';
        button.style.transition = 'transform 0.1s ease';
    }

    function handleButtonTouchEnd(event: TouchEvent) {
        // Remove visual feedback
        const button = event.currentTarget as HTMLElement;
        button.style.transform = 'scale(1)';
        
        // Prevent default to avoid double-triggering with click
        event.preventDefault();
        
        // Get the button's click handler and call it
        const buttonElement = event.currentTarget as HTMLButtonElement;
        if (buttonElement && !buttonElement.disabled) {
            // Trigger the click event programmatically
            buttonElement.click();
        }
    }

    function handleButtonTouchCancel(event: TouchEvent) {
        // Remove visual feedback if touch is cancelled
        const button = event.currentTarget as HTMLElement;
        button.style.transform = 'scale(1)';
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



    // Add time tracking functionality
    async function updateTimeTracking(userId: string, hoursToAdd: number) {
        if (!userId) return;
        
        const currentTimeTracking = quest.timeTracking || {};
        const currentHours = currentTimeTracking[userId] || 0;
        const newHours = Math.max(0, currentHours + hoursToAdd); // Don't allow negative hours
        
        const updatedTimeTracking = {
            ...currentTimeTracking,
            [userId]: newHours
        };

        // Remove entries with 0 hours to keep the object clean
        if (newHours === 0) {
            delete updatedTimeTracking[userId];
        }

        await updateQuest({ timeTracking: updatedTimeTracking });
    }

    function formatTime(hours: number): string {
        if (hours === 0) return "0h";
        if (hours < 1) {
            const minutes = Math.round(hours * 60);
            return `${minutes}m`;
        }
        return `${hours.toFixed(2)}h`;
    }

    function getAllTimeTrackingParticipants() {
        const participants = [...(quest.participants || [])];
        
        // Add initiator if not already in participants
        if (quest.initiator && !participants.find(p => p.id === quest.initiator.id)) {
            participants.unshift({
                id: quest.initiator.id,
                firstName: quest.initiator.firstName || quest.initiator.first_name,
                lastName: quest.initiator.lastName || quest.initiator.last_name,
                username: quest.initiator.username
            });
        }
        
        return participants;
    }

    // Add publish functionality
    let isPublishing = false;
    let publishStatus = '';

    async function publishToFederatedChats() {
        if (!holosphere || !holonId || !questId) {
            console.error("Cannot publish: missing holosphere, holonId, or questId");
            return;
        }

        isPublishing = true;
        publishStatus = 'Checking federation...';

        try {
            // First check if there are any federated chats available
            const fedInfo = await holosphere.getFederation(holonId);
            
            // Check if we have either federated chats OR if this is a hex-based holon that can propagate to parents
            const hasFederatedChats = fedInfo && fedInfo.notify && fedInfo.notify.length > 0;
            
            publishStatus = 'Publishing...';

            // Create a hologram for the quest to propagate
            // Use the full quest data instead of just the ID reference
            const hologram = holosphere.createHologram(holonId, 'quests', quest);

            // Use federation propagation to publish to federated spaces
            // Explicitly enable parent propagation for hex-based holons
            const propagationResult = await holosphere.propagate(holonId, 'quests', hologram, {
                useHolograms: true,
                propagateToParents: true,
                maxParentLevels: 1  // Only propagate to immediate parent (1 level up)
            });

            if (propagationResult.success > 0 || (propagationResult.parentPropagation?.success || 0) > 0) {
                const totalSuccess = (propagationResult.success || 0) + (propagationResult.parentPropagation?.success || 0);
                publishStatus = `Published to ${totalSuccess} location(s)`;
                
                // Update the quest to show it's been published
                await updateQuest({ 
                    published: true,
                    publishedAt: new Date().toISOString(),
                    publishedTo: totalSuccess
                });
                
                // Show success message briefly
                setTimeout(() => {
                    publishStatus = '';
                }, 3000);
            } else {
                const errorMessage = propagationResult.message || propagationResult.parentPropagation?.messages?.join(', ') || 'Unknown propagation error';
                publishStatus = `Failed to publish: ${errorMessage}`;
                console.error('Propagation failed:', propagationResult);
                
                // Show error message briefly
                setTimeout(() => {
                    publishStatus = '';
                }, 5000);
            }
        } catch (error) {
            console.error("[TaskModal.svelte] Error publishing quest:", error);
            publishStatus = `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
            
            // Show error message briefly
            setTimeout(() => {
                publishStatus = '';
            }, 5000);
        } finally {
            isPublishing = false;
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
            class="absolute top-4 right-4 text-gray-400 hover:text-white z-10 touch-manipulation min-h-[44px] min-w-[44px] flex items-center justify-center p-2"
            on:click={closeModal}
            on:touchstart={handleButtonTouchStart}
            on:touchend={handleButtonTouchEnd}
            on:touchcancel={handleButtonTouchCancel}
            aria-label="Close modal"
            type="button"
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
                            class="text-2xl font-bold text-white text-left hover:text-gray-300 touch-manipulation min-h-[44px] min-w-[44px] flex items-center"
                            on:click={() => {
                                tempTitle = quest.title;
                                editingTitle = true;
                            }}
                            on:touchstart={handleButtonTouchStart}
                            on:touchend={handleButtonTouchEnd}
                            on:touchcancel={handleButtonTouchCancel}
                        >
                            {quest.title}
                        </button>
                    {/if}
                    <div class="flex items-center gap-3 mt-2">
                        {#if quest._meta?.resolvedFromHologram}
                            <button
                                class="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-500/20 text-blue-300 rounded-lg text-sm font-medium hover:bg-blue-500/30 transition-colors border border-blue-500/50 touch-manipulation min-h-[44px] min-w-[44px] flex items-center justify-center"
                                on:click={navigateToHologramSource}
                                on:touchstart={handleButtonTouchStart}
                                on:touchend={handleButtonTouchEnd}
                                on:touchcancel={handleButtonTouchCancel}
                                title="Navigate to source holon: {getHologramSource(quest._meta.hologramSoul)}"
                                type="button"
                            >
                                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                                </svg>
                                <span>Hologram from {getHologramSource(quest._meta.hologramSoul)}</span>
                                <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
                                </svg>
                            </button>
                        {/if}
                        {#if quest.published}
                            <span
                                class="inline-flex items-center gap-2 px-3 py-1.5 bg-green-500/20 text-green-300 rounded-lg text-sm font-medium border border-green-500/50"
                                title="Cast to {quest.publishedTo || 'federated'} chat(s) on {new Date(quest.publishedAt).toLocaleDateString()}"
                                style="display: none"
                            >
                                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z"/>
                                </svg>
                                <span>Cast</span>
                            </span>
                        {/if}
                        {#if quest.created}
                        <span
                            class="inline-flex items-center text-sm text-gray-400"
                        >
                            <svg
                                class="w-4 h-4 mr-1"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                            >
                                <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="2"
                                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                                />
                            </svg>
                            Created: {formatDate(quest.created)}
                        </span>
                    {/if}
                    {#if quest.category}
                        <span
                            class="inline-flex items-center text-sm text-gray-400"
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
                                class="text-sm whitespace-pre-wrap cursor-pointer hover:bg-gray-700 p-1 rounded-md touch-manipulation min-h-[44px] min-w-[44px] flex items-center" 
                                on:click={() => {
                                    tempDescription = quest.description || '';
                                    editingDescription = true;
                                }}
                                on:touchstart={handleButtonTouchStart}
                                on:touchend={handleButtonTouchEnd}
                                on:touchcancel={handleButtonTouchCancel}
                                on:keydown={(e) => (e.key === 'Enter' || e.key === ' ') && (tempDescription = quest.description || '', editingDescription = true)}
                                type="button"
                            >
                                {quest.description}
                            </button>
                        {:else}
                            <button 
                                class="text-sm text-gray-400 hover:text-white px-2 py-1 rounded-md hover:bg-gray-700 touch-manipulation min-h-[44px] min-w-[44px] flex items-center justify-center"
                                on:click={() => {
                                    tempDescription = ''; // Start with empty for new description
                                    editingDescription = true;
                                }}
                                on:touchstart={handleButtonTouchStart}
                                on:touchend={handleButtonTouchEnd}
                                on:touchcancel={handleButtonTouchCancel}
                                type="button">
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
                            class="px-3 py-1.5 bg-gray-700 text-gray-200 rounded-lg hover:bg-gray-600 border border-gray-600 transition-colors text-sm touch-manipulation min-h-[44px] min-w-[44px] flex items-center justify-center"
                            on:click={() => (showDatePicker = !showDatePicker)}
                            on:touchstart={handleButtonTouchStart}
                            on:touchend={handleButtonTouchEnd}
                            on:touchcancel={handleButtonTouchCancel}
                            type="button"
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
                                    class="px-3 py-1.5 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-600 border border-gray-600 transition-colors text-sm touch-manipulation min-h-[44px] min-w-[44px] flex items-center justify-center"
                                    on:click={() => (showDatePicker = false)}
                                    on:touchstart={handleButtonTouchStart}
                                    on:touchend={handleButtonTouchEnd}
                                    on:touchcancel={handleButtonTouchCancel}
                                    type="button"
                                >
                                    Cancel
                                </button>
                                <button
                                    class="px-3 py-1.5 bg-gray-800 text-blue-400 rounded-lg hover:bg-gray-600 border border-blue-500 transition-colors text-sm touch-manipulation min-h-[44px] min-w-[44px] flex items-center justify-center"
                                    on:click={scheduleTask}
                                    on:touchstart={handleButtonTouchStart}
                                    on:touchend={handleButtonTouchEnd}
                                    on:touchcancel={handleButtonTouchCancel}
                                    type="button"
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
                                    class="text-gray-400 hover:text-red-400 transition-colors touch-manipulation min-h-[44px] min-w-[44px] flex items-center justify-center p-2"
                                    on:click={() =>
                                        updateQuest({
                                            when: null,
                                            status: "ongoing",
                                        })}
                                    on:touchstart={handleButtonTouchStart}
                                    on:touchend={handleButtonTouchEnd}
                                    on:touchcancel={handleButtonTouchCancel}
                                    aria-label="Remove schedule"
                                    type="button"
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
                            class="px-3 py-1.5 bg-gray-700 text-gray-200 rounded-lg hover:bg-gray-600 border border-gray-600 transition-colors text-sm touch-manipulation min-h-[44px] min-w-[44px] flex items-center justify-center"
                            on:click|stopPropagation={fetchUsersAndShowDropdown}
                            on:touchstart={handleButtonTouchStart}
                            on:touchend={handleButtonTouchEnd}
                            on:touchcancel={handleButtonTouchCancel}
                            disabled={!holosphere}
                            type="button"
                        >
                            + Add Participant
                        </button>
                    </div>

                    <!-- Current Participants List -->
                    <div class="space-y-2">
                        {#if quest.participants?.length}
                            {#each quest.participants as participant}
                                {@const currentTime = quest.timeTracking?.[participant.id] || 0}
                                <div
                                    class="flex items-center justify-between bg-gray-700/50 p-3 rounded-lg border border-gray-600/50"
                                >
                                    <div class="flex items-center gap-2">
                                        <img
                                            src={`https://gun.holons.io/getavatar?user_id=${participant.id}`}
                                            alt={`${participant.firstName} ${participant.lastName || ""}`}
                                            class="w-8 h-8 rounded-full"
                                        />
                                        <div class="flex flex-col">
                                            <span class="text-sm font-medium">
                                                {participant.firstName} {participant.lastName || ""}
                                            </span>
                                            <span class="text-xs text-gray-400">
                                                {formatTime(currentTime)}
                                            </span>
                                        </div>
                                    </div>
                                    
                                    <div class="flex items-center gap-1">
                                        <!-- Time tracking buttons -->
                                        <button
                                            class="px-2 py-1 bg-red-500/20 text-red-400 rounded border border-red-500/50 hover:bg-red-500/30 transition-colors text-xs font-medium touch-manipulation min-h-[32px] min-w-[32px] flex items-center justify-center"
                                            on:click={() => updateTimeTracking(participant.id, -1)}
                                            on:touchstart={handleButtonTouchStart}
                                            on:touchend={handleButtonTouchEnd}
                                            on:touchcancel={handleButtonTouchCancel}
                                            disabled={currentTime === 0}
                                            title="Remove 1 hour"
                                            type="button"
                                        >
                                            -1h
                                        </button>
                                        <button
                                            class="px-2 py-1 bg-red-500/20 text-red-400 rounded border border-red-500/50 hover:bg-red-500/30 transition-colors text-xs font-medium touch-manipulation min-h-[32px] min-w-[32px] flex items-center justify-center"
                                            on:click={() => updateTimeTracking(participant.id, -0.25)}
                                            on:touchstart={handleButtonTouchStart}
                                            on:touchend={handleButtonTouchEnd}
                                            on:touchcancel={handleButtonTouchCancel}
                                            disabled={currentTime === 0}
                                            title="Remove 15 minutes"
                                            type="button"
                                        >
                                            -15m
                                        </button>
                                        <button
                                            class="px-2 py-1 bg-green-500/20 text-green-400 rounded border border-green-500/50 hover:bg-green-500/30 transition-colors text-xs font-medium touch-manipulation min-h-[32px] min-w-[32px] flex items-center justify-center"
                                            on:click={() => updateTimeTracking(participant.id, 0.25)}
                                            on:touchstart={handleButtonTouchStart}
                                            on:touchend={handleButtonTouchEnd}
                                            on:touchcancel={handleButtonTouchCancel}
                                            title="Add 15 minutes"
                                            type="button"
                                        >
                                            +15m
                                        </button>
                                        <button
                                            class="px-2 py-1 bg-green-500/20 text-green-400 rounded border border-green-500/50 hover:bg-green-500/30 transition-colors text-xs font-medium touch-manipulation min-h-[32px] min-w-[32px] flex items-center justify-center"
                                            on:click={() => updateTimeTracking(participant.id, 1)}
                                            on:touchstart={handleButtonTouchStart}
                                            on:touchend={handleButtonTouchEnd}
                                            on:touchcancel={handleButtonTouchCancel}
                                            title="Add 1 hour"
                                            type="button"
                                        >
                                            +1h
                                        </button>
                                        
                                        <!-- Remove participant button -->
                                        <button
                                            class="text-gray-400 hover:text-red-400 transition-colors touch-manipulation min-h-[32px] min-w-[32px] flex items-center justify-center p-1 ml-2"
                                            on:click={() =>
                                                removeParticipant(participant.id)}
                                            on:touchstart={handleButtonTouchStart}
                                            on:touchend={handleButtonTouchEnd}
                                            on:touchcancel={handleButtonTouchCancel}
                                            aria-label={`Remove participant ${participant.firstName}`}
                                            title="Remove participant"
                                            type="button"
                                        >
                                            <svg
                                                class="w-4 h-4"
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
                            {/each}
                        {:else}
                            <p class="text-gray-500 text-sm">
                                No participants yet
                            </p>
                        {/if}

                        <!-- Total time summary -->
                        {#if quest.timeTracking && Object.keys(quest.timeTracking).length > 0}
                            {@const totalHours = Object.values(quest.timeTracking).reduce((sum: number, hours: any) => sum + (hours as number), 0)}
                            {#if totalHours > 0}
                                <div class="bg-gray-700/30 p-3 rounded-lg border border-gray-600/30 mt-3">
                                    <div class="flex items-center justify-between">
                                        <span class="text-sm font-medium text-gray-300">Total Time Logged:</span>
                                        <span class="text-sm font-bold text-white">{formatTime(totalHours as number)}</span>
                                    </div>
                                </div>
                            {/if}
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
                                    class="w-full text-left px-4 py-2 transition-colors flex items-center gap-2 hover:bg-gray-600 text-gray-200 touch-manipulation min-h-[44px]"
                                    on:click|stopPropagation={() =>
                                        toggleParticipant(userId)}
                                    on:touchstart={handleButtonTouchStart}
                                    on:touchend={handleButtonTouchEnd}
                                    on:touchcancel={handleButtonTouchCancel}
                                    type="button"
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
                        class="px-4 py-2 bg-gray-700/50 text-red-400 rounded-lg hover:bg-gray-600 border border-red-500/50 transition-colors touch-manipulation min-h-[44px] min-w-[44px] flex items-center justify-center"
                        on:click={deleteQuest}
                        on:touchstart={handleButtonTouchStart}
                        on:touchend={handleButtonTouchEnd}
                        on:touchcancel={handleButtonTouchCancel}
                        type="button"
                    >
                        Delete Task
                    </button>

                    <button
                        class="px-4 py-2 bg-gray-700/50 {quest.status ===
                        'completed'
                            ? 'text-yellow-400 border-yellow-500/50'
                            : 'text-green-400 border-green-500/50'} rounded-lg border hover:bg-gray-600 transition-colors touch-manipulation min-h-[44px] min-w-[44px] flex items-center justify-center"
                        on:click={completeQuest}
                        on:touchstart={handleButtonTouchStart}
                        on:touchend={handleButtonTouchEnd}
                        on:touchcancel={handleButtonTouchCancel}
                        type="button"
                    >
                        {quest.status === "completed"
                            ? "Mark Ongoing"
                            : "Mark Complete"}
                    </button>

                    <button
                        class="px-4 py-2 bg-gray-700/50 text-blue-400 rounded-lg hover:bg-gray-600 border border-blue-500/50 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation min-h-[44px] min-w-[44px] justify-center"
                        on:click={publishToFederatedChats}
                        on:touchstart={handleButtonTouchStart}
                        on:touchend={handleButtonTouchEnd}
                        on:touchcancel={handleButtonTouchCancel}
                        disabled={isPublishing}
                        title={quest.published ? 
                            `Cast to ${quest.publishedTo || 'federated'} chat(s) on ${new Date(quest.publishedAt).toLocaleDateString()}` : 
                            'Cast this task to federated chats'
                        }
                        type="button"
                        style="display: none"
                    >
                        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z"/>
                        </svg>
                        {#if isPublishing}
                            <span class="text-sm">{publishStatus}</span>
                        {:else if quest.published}
                            <span class="text-sm">Cast</span>
                        {:else}
                            <span class="text-sm">Cast</span>
                        {/if}
                    </button>
                </div>
            </div>
        </div>
    </div>
</div>
