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

    onMount(() => {
        document.addEventListener("click", handleClickOutside);

        if (holosphere) {
            holosphere.subscribe(
                holonId,
                "users",
                (newUser: User | string | null, key: string) => {
                    if (newUser) {
                        const parsedUser = newUser;
                        userStore = {
                            ...userStore,
                            [key]: parsedUser,
                        };
                    } else {
                        const { [key]: _, ...rest } = userStore;
                        userStore = rest;
                    }
                },
            );
        }

        return () => {
            document.removeEventListener("click", handleClickOutside);
        };
    });

    const dispatch = createEventDispatcher();
    let showAddParticipants = false;
    let showDropdown = false;

    async function updateQuest(updates: any, shouldClose = false) {
        if (!holosphere) {
            console.error("Cannot update quest: holosphere is not available");
            return;
        }

        const updatedQuest = { ...quest, ...updates };
        await holosphere.put(holonId, "quests", updatedQuest);
        quest = updatedQuest;
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

    function isUserParticipant(userId: string) {
        const user = userStore[userId];
        if (!user) return false;

        return (
            quest.participants?.some(
                (p: { username: string }) => p.username === user.username,
            ) ?? false
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
                            ...(initiatorData.initiated || []),
                            quest.title,
                        ],
                        actions: [
                            ...(initiatorData.actions || []),
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
                    await holosphere.put(holonId, "users", {
                        ...userData,
                        completed: [...(userData.completed || []), quest.title],
                        actions: [
                            ...(userData.actions || []),
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

    async function toggleParticipant(userId: string) {
        const user = userStore[userId];
        if (!user) {
            console.error("User not found:", userId);
            return;
        }

        // Check if user is already a participant by username
        if (
            quest.participants?.some(
                (p: { username: string }) => p.username === user.username,
            )
        ) {
            showDropdown = false;
            return;
        }

        // Create new participant object
        const newParticipant = {
            id: user.id,
            first_name: user.first_name,
            last_name: user.last_name,
            username: user.username,
        };

        const participants = [...(quest.participants || []), newParticipant];

        // Update user data
        const userData = (await holosphere.get(holonId, "users", user.id)) || {
            id: user.id,
            actions: [],
        };

        await holosphere.put(holonId, "users", {
            ...userData,
            id: user.id,
            actions: [
                ...userData.actions,
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
        await updateQuest({ participants });
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

            if (touchedCard) {
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

        if (touchedCard) {
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
                        -CANVAS_WIDTH * zoom + viewContainer.clientWidth,
                    ),
                    0,
                ),
                y: Math.min(
                    Math.max(
                        touch.clientY - startPan.y,
                        -CANVAS_HEIGHT * zoom + viewContainer.clientHeight,
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
        class="bg-gray-800 rounded-xl max-w-2xl w-full shadow-xl"
        transition:scale={{ duration: 200, start: 0.95 }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
    >
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
                <button
                    class="text-gray-400 hover:text-white"
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
            </div>

            <div class="space-y-6 text-gray-300">
                <!-- Description -->
                {#if quest.description}
                    <div class="bg-gray-700/50 p-4 rounded-lg">
                        <p class="text-sm">{quest.description}</p>
                    </div>
                {/if}

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
                            on:click|stopPropagation={() =>
                                (showDropdown = !showDropdown)}
                        >
                            {showDropdown ? "Cancel" : "+ Add Participant"}
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
                                            alt={`${participant.first_name} ${participant.last_name || ""}`}
                                            class="w-8 h-8 rounded-full"
                                        />
                                        <span
                                            >{participant.first_name}
                                            {participant.last_name || ""}</span
                                        >
                                    </div>
                                    <button
                                        class="text-gray-400 hover:text-red-400 transition-colors"
                                        on:click={() =>
                                            removeParticipant(participant.id)}
                                        aria-label={`Remove participant ${participant.first_name}`}
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
                        <div
                            class="bg-gray-700 rounded-lg overflow-hidden mt-2 user-dropdown border border-gray-600"
                        >
                            {#each Object.entries(userStore).filter(([userId]) => !isUserParticipant(userId)) as [userId, user]}
                                <button
                                    class="w-full text-left px-4 py-2 transition-colors flex items-center gap-2 hover:bg-gray-600 text-gray-200"
                                    on:click|stopPropagation={() =>
                                        toggleParticipant(userId)}
                                >
                                    <img
                                        src={`https://gun.holons.io/getavatar?user_id=${userId}`}
                                        alt={user.first_name}
                                        class="w-6 h-6 rounded-full"
                                    />
                                    <span
                                        >{user.first_name}
                                        {user.last_name || ""}</span
                                    >
                                </button>
                            {/each}
                            {#if Object.entries(userStore).filter(([userId]) => !isUserParticipant(userId)).length === 0}
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
