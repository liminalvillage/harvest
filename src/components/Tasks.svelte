<script lang="ts">
	
	import { onMount, getContext } from "svelte";
	import { ID } from "../dashboard/store";
	import { formatDate, formatTime } from "../utils/date";
	import HoloSphere from "holosphere";
	import Schedule from "./ScheduleWidget.svelte";
	import TaskModal from "./TaskModal.svelte";
	import CanvasView from "./CanvasView.svelte";
	import { writable } from 'svelte/store';

	interface Quest {
		id: string;
		title: string;
		description?: string;
		date?: string;
		when?: string;
		status: 'ongoing' | 'completed';
		category?: string;
		participants: Array<{ id: string; username: string }>;
		appreciation: string[];
		location?: string;
		ends?: string;
		type: 'task' | 'quest' | 'event';
		position?: {
			x: number;
			y: number;
		};
	}

	interface Store {
		[key: string]: Quest;
	}


	let holosphere = getContext("holosphere") as HoloSphere;

	$: holonID = $ID;
	let store: Store = {};
	$: quests = Object.entries(store);

	// Fix viewMode initialization
	let viewMode: 'list' | 'canvas' = 'list';

	// Initialize viewMode to 'list' by default
	if (typeof window !== 'undefined') {
		const storedViewMode = localStorage.getItem('taskViewMode');
		viewMode = (storedViewMode === 'list' || storedViewMode === 'canvas') ? storedViewMode : 'list';
	}

	// Add a reactive statement to save viewMode changes
	$: if (typeof window !== 'undefined') {
		localStorage.setItem('taskViewMode', viewMode);
	}

	// Initialize preferences with default values
	let showCompleted = false;

	// Load preferences immediately if we're in the browser
	if (typeof window !== 'undefined') {
		showCompleted = localStorage.getItem("kanbanShowCompleted") === "true";
	}

	// Add these variables after the existing let declarations
	let showTaskInput = false;
	let newTask: Quest = {
		id: generateId(),
		title: '',
		description: '',
		category: '',
		status: 'ongoing',
		type: 'task',
		participants: [],
		appreciation: []
	};

	onMount(() => {
		// Subscribe to ID changes
		ID.subscribe((value: string) => {
			holonID = value;
			subscribe();
		});
	});

	// Create separate reactive statements for localStorage updates
	$: {
		if (typeof window !== 'undefined') {
			localStorage.setItem("kanbanShowCompleted", showCompleted.toString());
		}
	}

	// Add this function near the top of the <script> section, after the imports
	function getColorFromCategory(category: string | undefined, type: string = 'task') {
		if (!category) {
			// Default colors based on type
			switch (type) {
				case 'event':
					return "hsl(280, 70%, 85%)"; // Purple for events
				case 'quest':
					return "hsl(200, 70%, 85%)"; // Blue for quests
				default:
					return "#E5E7EB"; // Gray for tasks
			}
		}

		// For items with categories, generate color but adjust based on type
		let hash = 0;
		for (let i = 0; i < category.length; i++) {
			hash = (hash << 5) - hash + category.charCodeAt(i);
			hash = hash & hash;
		}

		const hue = Math.abs(hash % 360);
		// Adjust saturation and lightness based on type
		switch (type) {
			case 'event':
				return `hsl(${hue}, 85%, 80%)`; // More saturated for events
			case 'quest':
				return `hsl(${hue}, 75%, 82%)`; // Slightly saturated for quests
			default:
				return `hsl(${hue}, 70%, 85%)`; // Original for tasks
		}
	}

	// Add these new variables
	let selectedCategory = "all";

	// Compute unique categories from quests
	$: categories = [
		"all",
		...new Set(
			Object.values(store)
				.filter((quest: any) => quest.category)
				.map((quest: any) => quest.category)
		),
	];
	// Add this variable to track the selected task
	let selectedTask: any = null;

	// Add these near the top of the script section, after the interface definitions
	let sortField: 'x' | 'y' = 'x';
	let sortDirection: 'asc' | 'desc' = 'desc';

	// Add a store to track updates
	const updateTrigger = writable(0);

	// Update the sorting logic to be more precise
	$: sortedQuests = quests.sort(([_, a], [__, b]) => {
		const posA = a.position?.[sortField] ?? 0;
		const posB = b.position?.[sortField] ?? 0;
		return sortDirection === 'desc' ? posB - posA : posA - posB;
	});

	// Update filtered quests to react to sort changes
	$: filteredQuests = sortedQuests.filter(([_, quest]) => {
		if (selectedCategory !== "all" && quest.category !== selectedCategory) return false;
		if (!['task', 'quest', 'event'].includes(quest.type)) return false;
		return quest.status === "ongoing" || (showCompleted && quest.status === "completed");
	});

	// Modify the toggle function to handle both field and direction
	function toggleSort() {
		if (sortDirection === 'desc') {
			sortDirection = 'asc';
		} else {
			sortDirection = 'desc';
			sortField = sortField === 'x' ? 'y' : 'x';
		}
	}

	onMount(async () => {
		// Fetch all quests from holon
		ID.subscribe((value) => {
			holonID = value;
			subscribe();
		});

		viewMode = localStorage.getItem("kanbanViewMode") || "list";
		showCompleted =
			localStorage.getItem("kanbanShowCompleted") === "true" || false;
		//quests = data.filter((quest) => (quest.status === 'ongoing' || quest.status === 'scheduled') && (quest.type === 'task' || quest.type === 'quest'));
	});

	$: update(holonID);

	function subscribe() {
		store = {};

		if (holosphere) {
			holosphere.subscribe(holonID, "quests", (newquest, key) => {
				if (newquest) {
					store = {
						...store,
						[key]:newquest,
					};
				} else {
					const { [key]: _, ...rest } = store;
					store = rest;
				}
			});
		}
	}

	function update(holonID: string) {
		// Filter ongoing and scheduled quests
		const filteredQuests = quests.filter(
			([_, quest]) =>
				quest.status === "ongoing" 
		);
		
		// Sort quests by date field, falling back to when if date doesn't exist
		const sortedQuests = filteredQuests.sort(([_, a], [__, b]) => {
			const dateA = new Date(a.date || a.when || 0);
			const dateB = new Date(b.date || b.when || 0);
			return dateB.getTime() - dateA.getTime(); // Newest first
		});

		return sortedQuests;
	}

	// Fix handleTaskClick type
	function handleTaskClick(key: string, quest: Quest) {
		if (!key) {
			console.error("Cannot select task: missing key");
			return;
		}
		selectedTask = { key, quest };
	}

	// Add this helper function after the existing functions
	function generateId() {
		return ''+ Date.now() + Math.random().toString(36).substr(2, 9);
	}

	// Update the handleAddTask function
	function handleAddTask() {
		if (!newTask.title.trim()) return;

		const task = {
			...newTask,
			id: generateId(), // Add unique id
			title: newTask.title.trim(),
			description: newTask.description?.trim(),
			created: new Date().toISOString(),
			position: {  // Add default position for canvas view
				x: Math.random() * 800,
				y: Math.random() * 600
			}
		};

		holosphere.put(holonID, "quests", task);
		showTaskInput = false;
	}

	// Add drag and drop state
	const dragState = writable<{
		dragging: boolean;
		draggedId: string | null;
		dragOverId: string | null;
	}>({
		dragging: false,
		draggedId: null,
		dragOverId: null
	});

	// Add drag and drop handlers
	function handleDragStart(event: DragEvent, key: string) {
		event.dataTransfer?.setData('text/plain', key);
		dragState.set({
			dragging: true,
			draggedId: key,
			dragOverId: null
		});
	}

	function handleDragOver(event: DragEvent, key: string) {
		event.preventDefault();
		dragState.update(state => ({
			...state,
			dragOverId: key
		}));
	}

	function handleDragEnd() {
		dragState.set({
			dragging: false,
			draggedId: null,
			dragOverId: null
		});
	}

	async function handleDrop(event: DragEvent, targetKey: string) {
		event.preventDefault();
		const sourceKey = event.dataTransfer?.getData('text/plain') || '';
		if (!sourceKey || sourceKey === targetKey) return;

		// Find the indices in the sorted and filtered list
		const sourceIndex = filteredQuests.findIndex(([key]) => key === sourceKey);
		const targetIndex = filteredQuests.findIndex(([key]) => key === targetKey);
		if (sourceIndex === -1 || targetIndex === -1) return;

		// Get the quests in their sorted order
		const targetQuest = filteredQuests[targetIndex][1];
		const prevQuest = targetIndex > 0 ? filteredQuests[targetIndex - 1][1] : null;
		const nextQuest = targetIndex < filteredQuests.length - 1 ? filteredQuests[targetIndex + 1][1] : null;
		const sourceQuest = filteredQuests[sourceIndex][1];

		// Calculate new position based on current sort field
		const currentPosition = sourceQuest.position || { x: 0, y: 0 };
		let newPosition = { ...currentPosition };

		// Get the positions for calculation
		const targetPos = targetQuest.position?.[sortField] ?? 0;
		const prevPos = prevQuest?.position?.[sortField] ?? (targetPos - 2000);
		const nextPos = nextQuest?.position?.[sortField] ?? (targetPos + 2000);

		// Calculate the new position value
		let newValue;
		if (targetIndex === 0) {
			// Dropping at the start
			newValue = targetPos - 1000;
		} else if (targetIndex === filteredQuests.length - 1) {
			// Dropping at the end
			newValue = targetPos + 1000;
		} else if (sourceIndex < targetIndex) {
			// Moving down - position after target
			newValue = targetPos + (nextPos - targetPos) / 2;
		} else {
			// Moving up - position before target
			newValue = prevPos + (targetPos - prevPos) / 2;
		}

		// Update only the sorted field, preserve the other coordinate
		newPosition[sortField] = newValue;

		// Update the quest in holosphere
		const updatedQuest = {
			...sourceQuest,
			position: newPosition
		};

		// Update in holosphere and force a store update to trigger re-render
		store = {
			...store,
			[sourceKey]: updatedQuest
		};
		await holosphere.put(holonID, `quests/${sourceKey}`, updatedQuest);
		
		handleDragEnd();
	}

	// Add dialog element reference
	let dialogElement: HTMLDialogElement;
	let open = false;
</script>

<div class="flex flex-wrap">
	<div class="w-full lg:w-8/12 bg-gray-800 py-6 px-6 rounded-3xl">
		<div class="flex justify-between text-white items-center mb-8">
			<div>
				<p class="text-lg mt-1">Tasks Today</p>
			</div>
			<p class="">{new Date().toDateString()}</p>
		</div>

		<div class="flex flex-wrap justify-between items-center pb-8">
			<div class="flex flex-wrap text-white">
				<div class="pr-10">
					<div class="text-2xl font-bold">
						{quests.filter(
							([_, quest]) =>
								!quest.participants?.length &&
								quest.status !== "completed"
						).length}
					</div>
					<div class="">Unassigned</div>
				</div>
				<div class="pr-10">
					<div class="text-2xl font-bold">
						{quests.filter(
							([_, quest]) => quest.status === "ongoing"
						).length}
					</div>
					<div class="">Ongoing</div>
				</div>
				<div class="pr-10">
					<div class="text-2xl font-bold">
						{quests.filter(
							([_, quest]) => quest.status === "completed"
						).length}
					</div>
					<div class="">Completed</div>
				</div>
				<div>
					<div class="text-2xl font-bold">{quests.length}</div>
					<div class="">Total Tasks</div>
				</div>
			</div>
			<div class="flex items-center mt-4 md:mt-0">
				<button
					class="text-white {viewMode === 'list'
						? 'bg-gray-700'
						: 'bg-transparent'} p-2"
					title="List View"
					on:click={() => (viewMode = "list")}
					aria-label="Switch to list view"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="24"
						height="24"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<line x1="8" y1="6" x2="21" y2="6" />
						<line x1="8" y1="12" x2="21" y2="12" />
						<line x1="8" y1="18" x2="21" y2="18" />
						<line x1="3" y1="6" x2="3.01" y2="6" />
						<line x1="3" y1="12" x2="3.01" y2="12" />
						<line x1="3" y1="18" x2="3.01" y2="18" />
					</svg>
				</button>
				<button
					class="text-white {viewMode === 'canvas'
						? 'bg-gray-700'
						: 'bg-transparent'} p-2 ml-2"
					title="Canvas View"
					on:click={() => (viewMode = "canvas")}
					aria-label="Switch to canvas view"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="20"
						height="20"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<path d="M5 9l-3 3 3 3"></path>
						<path d="M9 5l3-3 3 3"></path>
						<path d="M9 19l3 3 3-3"></path>
						<path d="M19 9l3 3-3 3"></path>
						<path d="M2 12h20"></path>
						<path d="M12 2v20"></path>
					</svg>
				</button>
			</div>
		</div>

		<div class="flex flex-col sm:flex-row sm:justify-end mb-4 items-center gap-4">
			<!-- Category Filter -->
			<div class="relative w-full sm:w-auto">
				<select
					bind:value={selectedCategory}
					class="w-full sm:w-auto appearance-none bg-gray-600 text-white px-4 py-1.5 pr-8 rounded-full cursor-pointer text-sm"
				>
					{#each categories as category}
						<option value={category}>
							{category === "all" ? "All Categories" : category}
						</option>
					{/each}
				</select>
				<div
					class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-white"
				>
					<svg
						class="fill-current h-4 w-4"
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 20 20"
					>
						<path
							d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
						/>
					</svg>
				</div>
			</div>

			<div class="flex w-full sm:w-auto justify-between sm:justify-end items-center gap-4">
				<!-- Sort Button -->
				<button
					class="flex items-center gap-1 px-3 py-1.5 bg-gray-600 text-white rounded-full text-sm hover:bg-gray-500 transition-colors"
					on:click={toggleSort}
					aria-label="Toggle sort order"
				>
					Sort
					<svg
						class="w-4 h-4 transform transition-transform"
						style="transform: rotate({sortField === 'x' 
							? (sortDirection === 'desc' ? '90' : '270') 
							: (sortDirection === 'desc' ? '180' : '0')}deg)"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<path d="M12 5v14M19 12l-7 7-7-7"></path>
					</svg>
				</button>

				<!-- Show Completed Toggle -->
				<label class="flex items-center cursor-pointer">
					<div class="relative">
						<input
							type="checkbox"
							class="sr-only"
							bind:checked={showCompleted}
						/>
						<div class="w-10 h-6 bg-gray-600 rounded-full shadow-inner"></div>
						<div
							class="dot absolute w-4 h-4 bg-white rounded-full transition left-1 top-1"
							class:translate-x-4={showCompleted}
						></div>
					</div>
					<div class="ml-3 text-sm font-medium text-white whitespace-nowrap">
						Show Completed
					</div>
				</label>
			</div>
		</div>

		{#if viewMode === "canvas"}
			<CanvasView
				{filteredQuests}
				{holonID}
				{showCompleted}
				on:taskClick={(e) => handleTaskClick(e.detail.key, e.detail.quest)}
			/>
		{:else}
			<div class="space-y-2">
				{#each filteredQuests as [key, quest]}
					{#if quest.status === "ongoing" || (showCompleted && quest.status === "completed")}
						<button
							id={key}
							class="w-full task-card relative text-left"
							on:click|stopPropagation={() => handleTaskClick(key, quest)}
							draggable="true"
							on:dragstart={(e) => handleDragStart(e, key)}
							on:dragover={(e) => handleDragOver(e, key)}
							on:drop={(e) => handleDrop(e, key)}
							on:dragend={handleDragEnd}
							aria-label={`Open task: ${quest.title}`}
							class:dragging={$dragState.draggedId === key}
							class:drag-over={$dragState.dragOverId === key}
						>
							<div
								class="p-3 rounded-lg transition-colors"
								style="background-color: {quest.status === 'completed'
									? '#9CA3AF'
									: getColorFromCategory(quest.category, quest.type)}; 
									   opacity: {quest.status === 'completed' ? '0.6' : '1'}"
							>
								<div
									class="flex justify-between items-center gap-4"
								>
									<div class="flex-1 min-w-0">
										<h3
											class="text-base font-bold opacity-70 truncate flex items-center gap-2"
										>
											<span class="text-sm px-2 py-0.5 rounded-full bg-black/20">
												{quest.type === 'event' ? '📅' : quest.type === 'quest' ? '⚔️' : '✓'}
												{quest.type}
											</span>
											{quest.title}
										</h3>
										{#if quest.description}
											<p
												class="text-sm opacity-70 truncate"
											>
												{quest.description}
											</p>
										{/if}
										{#if quest.category}
											<p class="text-sm opacity-70 mt-1">
												<span
													class="inline-flex items-center"
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
											</p>
										{/if}
									</div>

									<div
										class="flex items-center gap-4 text-sm whitespace-nowrap"
									>
										{#if quest.location}
											<div class="opacity-70">
												📍 {quest.location.split(
													","
												)[0]}
											</div>
										{/if}

										<div class="flex items-center gap-1">
											<span
												class="opacity-70 font-bold text-base"
												>🙋‍♂️ {quest.participants
													.length}</span
											>
											<div
												class="flex -space-x-2 relative group"
											>
												{#each quest.participants.slice(0, 3) as participant}
													<div class="relative">
														<img
															class="w-6 h-6 rounded-full border-2 border-gray-300"
															src={`https://gun.holons.io/getavatar?user_id=${participant.id}`}
															alt={participant.username}
														/>
														<div
															class="absolute invisible group-hover:visible bg-gray-900 text-white text-xs rounded py-1 px-2 -bottom-8 left-1/2 transform -translate-x-1/2 whitespace-nowrap z-10"
														>
															{participant.username}
														</div>
													</div>
												{/each}
												{#if quest.participants.length > 3}
													<div
														class="w-6 h-6 rounded-full bg-gray-400 flex items-center justify-center text-xs border-2 border-gray-300 relative group"
													>
														<span>+{quest.participants.length - 3}</span>
														<div
															class="absolute invisible group-hover:visible bg-gray-900 text-white text-xs rounded py-1 px-2 -bottom-8 left-1/2 transform -translate-x-1/2 whitespace-nowrap z-10"
														>
															{quest.participants
																.slice(3)
																.map(
																	(p) =>
																		p.username
																)
																.join(", ")}
														</div>
													</div>
												{/if}
											</div>
										</div>

										{#if quest.when}
											<div class="text-sm font-medium">
												{formatTime(quest.when)}
												{#if quest.ends}- {formatTime(
														quest.ends
													)}{/if}
											</div>
										{/if}

										<div
											class="opacity-70 font-bold text-base"
										>
											👍 {quest.appreciation.length}
										</div>
									</div>
								</div>
							</div>
						</button>
					{/if}
				{/each}
			</div>
		{/if}
		<div class="flex justify-center mt-4">
			<button
				on:click={() => showTaskInput = true}
				class="w-12 h-12 rounded-full bg-gray-700 hover:bg-gray-600 text-white text-3xl font-bold flex items-center justify-center focus:outline-none"
				aria-label="Add new task"
			>
				+
			</button>
		</div>
	
	</div>
	<Schedule />

	{#if selectedTask}
		<TaskModal
			quest={selectedTask.quest}
			questId={selectedTask.key}
			holonId={holonID}
			on:close={() => (selectedTask = null)}
		/>
	{/if}

	
	<!-- Add Task Modal -->
	{#if showTaskInput}
		<dialog
			class="bg-transparent w-full h-full fixed inset-0 z-50"
			bind:this={dialogElement}
			on:close={() => showTaskInput = false}
			{open}
		>
			<div 
				class="bg-black bg-opacity-50 w-full h-full flex items-center justify-center"
				role="presentation"
			>
				<div 
					class="bg-gray-800 p-6 rounded-lg shadow-lg w-96" 
					role="dialog"
					aria-modal="true"
					aria-labelledby="task-input-title"
				>
					<div class="relative">
						<button
							on:click={() => (showTaskInput = false)}
							class="absolute -top-2 -right-2 text-gray-400 hover:text-white"
							aria-label="Close task input dialog"
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
								></path>
							</svg>
						</button>
						<h3 id="task-input-title" class="text-white text-lg font-bold mb-4">Add New Task</h3>
					</div>
					<div class="space-y-4">
						<div>
							<label for="task-title" class="sr-only">Task title</label>
							<input
								id="task-title"
								type="text"
								bind:value={newTask.title}
								placeholder="Task title..."
								class="w-full px-3 py-2 text-sm rounded-md focus:outline-none bg-gray-700 text-white placeholder-gray-400 border-gray-600"
							/>
						</div>
						<div>
							<label for="task-description" class="sr-only">Task description</label>
							<textarea
								id="task-description"
								bind:value={newTask.description}
								placeholder="Description..."
								class="w-full px-3 py-2 text-sm rounded-md focus:outline-none bg-gray-700 text-white placeholder-gray-400 border-gray-600 resize-none"
								rows="3"
							></textarea>
						</div>
						<div>
							<label for="task-category" class="sr-only">Task category</label>
							<select
								id="task-category"
								bind:value={newTask.category}
								class="w-full px-3 py-2 text-sm rounded-md focus:outline-none bg-gray-700 text-white border-gray-600"
							>
								<option value="">Select category...</option>
								{#each categories.filter(cat => cat !== 'all') as category}
									<option value={category}>{category}</option>
								{/each}
							</select>
						</div>
						<div class="flex justify-end gap-2">
							<button
								on:click={() => showTaskInput = false}
								class="px-4 py-2 text-sm rounded-md bg-gray-700 text-white hover:bg-gray-600"
								aria-label="Cancel adding task"
							>
								Cancel
							</button>
							<button
								on:click={handleAddTask}
								class="px-4 py-2 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-500"
								disabled={!newTask.title.trim()}
								aria-label="Add new task"
							>
								Add Task
							</button>
						</div>
					</div>
				</div>
			</div>
		</dialog>
	{/if}
</div>

<style>
	/* Add smooth transition for the toggle switch dot */
	.dot {
		transition: transform 0.3s ease-in-out;
	}
	.translate-x-4 {
		transform: translateX(1rem);
	}

	.task-card {
		position: relative;
		transition: transform 0.2s ease;
		cursor: grab;
	}

	.task-card.dragging {
		opacity: 0.5;
		cursor: grabbing;
		z-index: 10;
	}

	.task-card.drag-over {
		transform: translateY(10px);
	}

	.task-card.drag-over::before {
		content: '';
		position: absolute;
		top: -5px;
		left: 0;
		right: 0;
		height: 2px;
		background-color: #4F46E5;
		border-radius: 2px;
	}

	@keyframes slideDown {
		from {
			opacity: 0;
			transform: translateY(-10px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	/* Add tooltip arrow */
	.group-hover\:visible {
		position: absolute;
		pointer-events: none;
	}

	.group-hover\:visible::before {
		content: "";
		position: absolute;
		top: -4px;
		left: 50%;
		transform: translateX(-50%);
		border-width: 0 4px 4px 4px;
		border-style: solid;
		border-color: transparent transparent #1f2937 transparent;
	}

	/* Update transform styles */
	.transform {
		transform-origin: center;
		transition: transform 0.3s ease;
	}
</style>
