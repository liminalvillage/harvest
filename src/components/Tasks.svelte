<script lang="ts">
	
	import { onMount, getContext } from "svelte";
	import { ID } from "../dashboard/store";
	import { formatDate, formatTime } from "../utils/date";
	import HoloSphere from "holosphere";
	import Schedule from "./ScheduleWidget.svelte";
	import TaskModal from "./TaskModal.svelte";
	import CanvasView from "./CanvasView.svelte";
	import { writable } from 'svelte/store';
	import Fireworks from "./Fireworks.svelte";
	import Confetti from "./Confetti.svelte";

	interface Quest {
		id: string;
		title: string;
		description?: string;
		date?: string;
		when?: string;
		status: 'ongoing' | 'completed' | 'recurring' | 'repeating';
		category?: string;
		participants: Array<{ 
			id: string; 
			username: string;
			firstName?: string;
			lastName?: string;
		}>;
		appreciation: string[];
		location?: string;
		ends?: string;
		type?: 'task' | 'quest' | 'event' | 'proposal' | 'recurring';
		orderIndex?: number;
		position?: { x: number; y: number };
		dependsOn?: string[];
		initiator?: {
			id: string;
			username: string;
			firstName?: string;
			lastName?: string;
		};
		created?: string;
		_meta?: {
			resolvedFromHologram?: boolean;
			hologramSoul?: string;
		};
	}

	interface Store {
		[key: string]: Quest;
	}


	let holosphere = getContext("holosphere") as HoloSphere;

	$: holonID = $ID;
	let store: Store = {};
	$: quests = Object.entries(store);

	// Initialize with safe defaults
	let viewMode: 'list' | 'canvas' = 'list';
	let showCompleted = false;
	let showHolograms = true;
	let sortedQuests: [string, Quest][] = [];
	let filteredQuests: [string, Quest][] = [];

	// Initialize preferences with default values
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

	let questsUnsubscribe: (() => void) | undefined;

	// Add initialization state tracking
	let isInitialized = false;
	let isSubscribed = false;

	// Add subscription state tracking
	let subscriptionState = {
		currentHolonID: null as string | null,
		batchTimeout: null as NodeJS.Timeout | null,
		pendingUpdates: new Map<string, Quest>()
	};

	// Add state for animations
	let showFireworks = false;
	let showConfetti = false;

	// Holon name cache
	let holonNameCache = new Map<string, string>();

	// Sort state variables
	type SortCriteria = 'orderIndex' | 'positionX' | 'positionY';
	let sortCriteria: SortCriteria = 'orderIndex';
	let sortDirection: 'asc' | 'desc' = 'asc';
	let sortButtonIconRotation = 0; 

	// SVG Paths for sort icons
	const orderIndexIconPath = "M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"; // Heroicons bars-3
	const directionalSortIconPath = "M12 5v14M19 12l-7 7-7-7"; // Current arrow
	let currentIconPath = orderIndexIconPath; // Initial icon

	// Add these variables after the existing let declarations
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
	// let sortField: 'x' | 'y' = 'x'; // Removed
	// let sortDirection: 'asc' | 'desc' = 'desc'; // Removed

	// Add a store to track updates
	// const updateTrigger = writable(0); // Removed

	// Modify the reactive statement for sorting
	$: {
		let currentFilteredQuests = quests.filter(([_, quest]) => {
			if (selectedCategory !== "all" && quest.category !== selectedCategory) {
				return false;
			}

			// Show tasks and recurring tasks (default to 'task' if type is missing)
			const type = quest.type || 'task'; 
			if (type !== 'task' && type !== 'recurring') {
				return false;
			}

			// Default to 'ongoing' if status is missing.
			const status = quest.status || 'ongoing';
			if (status === "completed" && !showCompleted) {
				return false;
			}

			// Filter holograms if showHolograms is false
			if (!showHolograms && quest._meta?.resolvedFromHologram) {
				return false;
			}

			return true; // Quest passes all filters
		});

		// Sort by orderIndex, undefined/null values go to the end
		currentFilteredQuests.sort(([keyA, a], [keyB, b]) => {
			let valA: number, valB: number;

			switch (sortCriteria) {
				case 'positionX':
					valA = a.position?.x ?? Infinity;
					valB = b.position?.x ?? Infinity;
					break;
				case 'positionY':
					valA = a.position?.y ?? Infinity;
					valB = b.position?.y ?? Infinity;
					break;
				case 'orderIndex':
				default:
					valA = a.orderIndex ?? Infinity;
					valB = b.orderIndex ?? Infinity;
					// If orderIndex is the same, sort by key (ID) as a stable secondary sort.
					// This is always ascending for orderIndex mode.
					if (valA === valB) {
						return keyA.localeCompare(keyB);
					}
					// For orderIndex, primary sort is always ascending, handled by the main return
					break;
			}

			// General comparison for asc/desc.
			// For orderIndex, sortDirection will always be 'asc' due to handleSortButtonClick logic.
			if (sortDirection === 'asc') {
				if (valA === Infinity && valB === Infinity) return 0;
				if (valA === Infinity) return 1;
				if (valB === Infinity) return -1;
				return valA - valB;
			} else { // sortDirection === 'desc'
				if (valA === Infinity && valB === Infinity) return 0;
				if (valA === Infinity) return 1; 
				if (valB === Infinity) return -1;
				return valB - valA;
			}
		});
		filteredQuests = currentFilteredQuests;

		// Original sorting and normalization logic removed.
		// sortedQuests = filtered.sort(([_, a], [__, b]) => {
		// 	const posA = a.position?.[sortField] ?? 0;
		// 	const posB = b.position?.[sortField] ?? 0;
		// 	return sortDirection === 'desc' ? posB - posA : posA - posB;
		// });

		// // Normalize positions if needed
		// if (sortedQuests.some(([_, quest]) => !quest.position)) {
		// 	sortedQuests = normalizePositions(sortedQuests);
		// 	// Update positions in holosphere
		// 	sortedQuests.forEach(([key, quest]) => {
		// 		if (holosphere && holonID) {
		// 			holosphere.put(holonID, `quests/${key}`, quest).catch(console.error);
		// 		}
		// 	});
		// }

		// filteredQuests = sortedQuests; // Now filteredQuests is directly assigned above
	}

	// Placeholder function for the sort button
	function handleSortButtonClick() {
		if (sortCriteria === 'orderIndex') {
			sortCriteria = 'positionX';
			sortDirection = 'asc';
			currentIconPath = directionalSortIconPath;
			sortButtonIconRotation = 270; // Arrow left for X asc (reversed from typical right)
		} else if (sortCriteria === 'positionX' && sortDirection === 'asc') {
			sortDirection = 'desc';
			currentIconPath = directionalSortIconPath;
			sortButtonIconRotation = 90; // Arrow right for X desc (reversed from typical left)
		} else if (sortCriteria === 'positionX' && sortDirection === 'desc') {
			sortCriteria = 'positionY';
			sortDirection = 'asc';
			currentIconPath = directionalSortIconPath;
			sortButtonIconRotation = 0; // Arrow down for Y asc
		} else if (sortCriteria === 'positionY' && sortDirection === 'asc') {
			sortDirection = 'desc';
			currentIconPath = directionalSortIconPath;
			sortButtonIconRotation = 180; // Arrow up for Y desc
		} else { // Was positionY, desc or any other combo, reset to orderIndex
			sortCriteria = 'orderIndex';
			sortDirection = 'asc'; // orderIndex is always ascending
			currentIconPath = orderIndexIconPath;
			sortButtonIconRotation = 0; // No rotation for list icon
		}
		console.log(`Sorting by: ${sortCriteria}` + (sortCriteria !== 'orderIndex' ? `, Direction: ${sortDirection}` : ' (Ascending)') + `, Icon: ${sortButtonIconRotation}°`);
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
		return ''+ Date.now();
	}

	// Modify handleAddTask to use a default 'Dashboard User' initiator if user data fetch fails or returns no data, instead of throwing an error.
	async function handleAddTask() {
		if (!holosphere || !holonID || !newTask.title.trim()) return;

		try {
			let initiatorInfo;
			try {
				// Attempt to get user data
				const userData = await holosphere.get(holonID, 'users', holonID);

				if (userData && typeof userData === 'object' && userData !== null) {
					initiatorInfo = {
						id: holonID,
						username: userData.username || "Unknown User",
						firstName: userData.first_name || "",
						lastName: userData.last_name || ""
					};
				} else {
					// User data not found or not in expected format, use default
					console.warn(`User data not found or in unexpected format for holonID: ${holonID}. Using default "Dashboard User" as initiator.`);
					initiatorInfo = {
						id: holonID, 
						username: "Dashboard User",
						firstName: "Dashboard", 
						lastName: "User"      
					};
				}
			} catch (fetchError) {
				// Error during fetch, use default
				console.error('Error fetching user data:', fetchError);
				console.warn(`Using default "Dashboard User" as initiator due to fetch error for holonID: ${holonID}.`);
				initiatorInfo = {
					id: holonID,
					username: "Dashboard User",
					firstName: "Dashboard",
					lastName: "User"
				};
			}

			// Default position for CanvasView with top-left as 0,0
			const defaultCanvasPosition = {
				x: Math.random() * 3700, // Random x within canvas bounds (4000 - 300)
				y: Math.random() * 2800  // Random y within canvas bounds (3000 - 200)
			};

			const newOrderIndex = filteredQuests.length > 0 
				? Math.max(...filteredQuests.map(([_, q]) => q.orderIndex ?? -1)) + 1 
				: 0;

			const task: Quest = {
				...newTask,
				initiator: initiatorInfo, // Use the determined initiatorInfo
				created: new Date().toISOString(),
				orderIndex: newOrderIndex, // Assign orderIndex
				position: defaultCanvasPosition // Assign default canvas position
			};

			// Add the task to holosphere
			if (holonID) {
				await holosphere.put(holonID, 'quests', task);
			} else {
				console.error("Cannot add task: holonID is null");
				return;
			}

			// Reset form and close dialog
			showTaskInput = false;
			newTask = {
				id: generateId(),
				title: '',
				description: '',
				category: '',
				status: 'ongoing',
				type: 'task',
				participants: [],
				appreciation: []
			};

			// Force update
			// updateTrigger.update(n => n + 1); // Removed
		} catch (error) {
			console.error('Error adding task:', error);
		}
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

	// Modify handleDrop to use 100px spacing
	async function handleDrop(event: DragEvent, targetKey: string) {
		event.preventDefault();
		const sourceKey = event.dataTransfer?.getData('text/plain') || '';

		// Ensure holonID is not null before proceeding
		const currentHolonID = holonID; // Use the reactive holonID variable
		if (!currentHolonID) {
			console.error("Cannot handle drop: holonID is null.");
			handleDragEnd();
			return;
		}

		if (!sourceKey || sourceKey === targetKey) {
			handleDragEnd();
			return;
		}

		if (sortCriteria === 'orderIndex') {
			const currentQuestsArray = [...filteredQuests];
			const sourceIndex = currentQuestsArray.findIndex(([key]) => key === sourceKey);
			const targetIndexOriginal = currentQuestsArray.findIndex(([key]) => key === targetKey);

			if (sourceIndex === -1 || targetIndexOriginal === -1) {
				handleDragEnd();
				return;
			}

			const [draggedItemKey, draggedItemQuest] = currentQuestsArray.splice(sourceIndex, 1)[0];
			
			const actualTargetIndex = sourceIndex < targetIndexOriginal ? targetIndexOriginal -1 : targetIndexOriginal;
			
			currentQuestsArray.splice(actualTargetIndex, 0, [draggedItemKey, draggedItemQuest]);

			const updatedQuestsPromises = currentQuestsArray.map(async ([key, questToUpdate], index) => {
				const updatedQuest = { ...questToUpdate, orderIndex: index };
				store[key] = updatedQuest;
				return holosphere.put(currentHolonID, `quests/${key}`, updatedQuest);
			});

			try {
				await Promise.all(updatedQuestsPromises);
				quests = Object.entries(store);
			} catch (error) {
				console.error('Error updating quest orderIndex after drop:', error);
			}
		} else { // sortCriteria is 'positionX' or 'positionY'
			const POSITION_STEP = 10.0;

			const sourceQuestEntry = filteredQuests.find(([k]) => k === sourceKey);
			if (!sourceQuestEntry) { 
				handleDragEnd(); 
				console.error('Source quest not found during drop for position sort.');
				return; 
			}
			const draggedQuest = { ...sourceQuestEntry[1] }; // Mutable copy of the quest data

			const otherItems = filteredQuests.filter(([k]) => k !== sourceKey);
			const insertionIndexInOthers = otherItems.findIndex(([k]) => k === targetKey);

			if (insertionIndexInOthers === -1) {
				console.error("Error determining drop position: targetKey not found in otherItems.");
				handleDragEnd();
				return;
			}

			const prevTaskData = (insertionIndexInOthers > 0) ? otherItems[insertionIndexInOthers - 1][1] : null;
			const nextTaskData = otherItems[insertionIndexInOthers][1]; // This is the quest data for targetKey

			const mainAxis = sortCriteria === 'positionX' ? 'x' : 'y';
			const crossAxis = sortCriteria === 'positionX' ? 'y' : 'x';

			const prevMainCoord = prevTaskData?.position?.[mainAxis];
			const nextMainCoord = nextTaskData?.position?.[mainAxis];

			let newMainCoordValue: number;

			if (prevMainCoord !== undefined && nextMainCoord !== undefined) {
				newMainCoordValue = (prevMainCoord + nextMainCoord) / 2.0;
			} else if (nextMainCoord !== undefined) {
				newMainCoordValue = nextMainCoord - (POSITION_STEP * (sortDirection === 'asc' ? 1 : -1));
			} else if (prevMainCoord !== undefined) {
				newMainCoordValue = prevMainCoord + (POSITION_STEP * (sortDirection === 'asc' ? 1 : -1));
			} else {
				newMainCoordValue = draggedQuest.position?.[mainAxis] ?? 0;
			}
			
			const currentFullPosition = draggedQuest.position || { x: 0, y: 0 };
			
			let newPosition = {
				...currentFullPosition,
				[mainAxis]: newMainCoordValue
			};

			if (newPosition[crossAxis] === undefined) {
				newPosition[crossAxis] = 0;
			}
			draggedQuest.position = newPosition;

			store[sourceKey] = draggedQuest;
			try {
				await holosphere.put(currentHolonID, `quests/${sourceKey}`, draggedQuest);
				quests = Object.entries(store); 
			} catch (error) {
				console.error(`Error updating quest position after drop (sort by ${sortCriteria}):`, error);
			}
		}

		handleDragEnd();
	}

	// Simplify show/hide functions
	function showDialog() {
		showTaskInput = true;
	}

	function hideDialog() {
		showTaskInput = false;
		// Reset the newTask object when closing
		newTask = {
			id: generateId(),
			title: '',
			description: '',
			category: '',
			status: 'ongoing',
			type: 'task',
			participants: [],
			appreciation: []
		};
	}

	// Add onMount to initialize the dialog
	onMount(() => {
		if (showTaskInput) {
			showDialog();
		}
		return () => {
			if (showTaskInput) {
				hideDialog();
			}
		};
	});

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
		// Extract the holon ID from path like "Holons/-1002593778587/quests/380"
		const match = hologramSoul.match(/Holons\/([^\/]+)/);
		if (!match) return 'External Source';
		
		const holonId = match[1];
		// Return cached name if available, otherwise return ID and fetch name
		if (holonNameCache.has(holonId)) {
			return holonNameCache.get(holonId)!;
		}
		
		// Fetch name asynchronously and trigger reactivity
		fetchHolonName(holonId).then(() => {
			// Trigger reactivity by updating quests
			quests = [...quests];
		});
		
		return `Holon ${holonId}`; // Temporary fallback while loading
	}

	// Add color category function
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

	// Add this function to handle task deletion
	function handleTaskDeleted(event: CustomEvent) {
		if (event.detail?.deleted && event.detail?.questId) {
			// Update local store immediately
			const { [event.detail.questId]: _, ...rest } = store;
			store = rest;
			quests = Object.entries(store);
		}
		// Always set selectedTask to null when modal closes
		selectedTask = null;
	}

	// Add function to handle task completion and show animations
	function handleTaskCompleted(event: CustomEvent) {
		if (event.detail?.questId) {
			showFireworks = true;
			showConfetti = true;

			// Hide fireworks after 2.5 seconds
			setTimeout(() => {
				showFireworks = false;
			}, 2500); // Show for 2.5 seconds

			// Hide confetti after 10 seconds
			setTimeout(() => {
				showConfetti = false;
			}, 10000); // Show for 10 seconds
		}
		// Note: handleTaskDeleted will still be called via the "close" event to clear selectedTask
	}

	function handleDialogKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			hideDialog();
		}
	}

	// Remove debounce helper and throttled store updates
	function updateStore(newStore: Store) {
		store = newStore;
		quests = Object.entries(store);
	}

	// Modify the subscribe function to use immediate updates
	function subscribe() {
		if (!holosphere || !holonID) return;
		
		// Don't resubscribe if already subscribed to this holon
		if (subscriptionState.currentHolonID === holonID && questsUnsubscribe) return; // check questsUnsubscribe too
		
		// Clear existing store and subscription
		if (questsUnsubscribe) {
			questsUnsubscribe();
			questsUnsubscribe = undefined;
		}
		
		store = {}; // Reset store
		quests = []; // Reset quests array
		filteredQuests = []; // Reset filteredQuests
		
		try {
			// Update subscription state
			subscriptionState.currentHolonID = holonID;
			
			const off = holosphere.subscribe(holonID, "quests", (newquest: Quest | null, key?: string) => {
				// Update store immediately
				const newStore = { ...store };
				if (newquest && key) {
					newStore[key] = newquest;
				} else if (key) {
					delete newStore[key];
				}
				// Directly update store and quests, which will trigger reactive updates
				store = newStore; 
				quests = Object.entries(store); 
			});

			if (typeof off === 'function') {
				questsUnsubscribe = off;
			}
		} catch (error) {
			console.error('Error setting up quest subscription:', error);
			subscriptionState.currentHolonID = null; // Reset on error
			questsUnsubscribe = undefined;
		}
	}

	// Modify onMount to handle subscription cleanup
	onMount(() => {
		let mounted = true;
		
		// Set up ID subscription only once
		const idSubscription = ID.subscribe((value) => {
			if (!mounted || !value ) return; // Removed check against subscriptionState.currentHolonID to allow re-subscription if ID changes rapidly
			holonID = value;
			subscribe();
		});

		// Load preferences
		try {
			const storedViewMode = localStorage.getItem('taskViewMode');
			if (storedViewMode === 'list' || storedViewMode === 'canvas') {
				viewMode = storedViewMode as 'list' | 'canvas';
			}
			showCompleted = localStorage.getItem("kanbanShowCompleted") === "true";
			const storedShowHolograms = localStorage.getItem("taskShowHolograms");
			if (storedShowHolograms !== null) {
				showHolograms = storedShowHolograms === "true";
			}
		} catch (error) {
			console.error('Error loading preferences:', error);
			// Defaults are already set, so just log error
		}

		return () => {
			mounted = false;
			if (idSubscription) idSubscription();
			if (questsUnsubscribe) questsUnsubscribe();
			if (subscriptionState.batchTimeout) { // Clear timeout if it exists
				clearTimeout(subscriptionState.batchTimeout);
				subscriptionState.batchTimeout = null;
			}
			subscriptionState.pendingUpdates.clear();
			// Don't nullify currentHolonID here, as it might be needed if component remounts quickly
		};
	});

	// Modify the reactive statements to be more efficient
	$: {
		let currentFilteredQuests = quests.filter(([_, quest]) => {
			if (selectedCategory !== "all" && quest.category !== selectedCategory) {
				return false;
			}

			// Default to 'task' if type is missing, then check if it's a valid type for display.
			const type = quest.type || 'task'; 
			if (!['task', 'quest', 'event', 'recurring'].includes(type)) {
				// console.log('Filtering out due to invalid type:', quest.title, quest.type);
				return false;
			}

			// Default to 'ongoing' if status is missing.
			const status = quest.status || 'ongoing';
			if (status === "completed" && !showCompleted) {
				// console.log('Filtering out completed task when showCompleted is false:', quest.title);
				return false;
			}
			// Implicitly, if status is 'ongoing', or if it's 'completed' and showCompleted is true, it passes this part.

			return true; // Quest passes all filters
		});

		// Sort by orderIndex, undefined/null values go to the end
		currentFilteredQuests.sort(([keyA, a], [keyB, b]) => {
			let valA: number, valB: number;

			switch (sortCriteria) {
				case 'positionX':
					valA = a.position?.x ?? Infinity;
					valB = b.position?.x ?? Infinity;
					break;
				case 'positionY':
					valA = a.position?.y ?? Infinity;
					valB = b.position?.y ?? Infinity;
					break;
				case 'orderIndex':
				default:
					valA = a.orderIndex ?? Infinity;
					valB = b.orderIndex ?? Infinity;
					// If orderIndex is the same, sort by key (ID) as a stable secondary sort.
					// This is always ascending for orderIndex mode.
					if (valA === valB) {
						return keyA.localeCompare(keyB);
					}
					// For orderIndex, primary sort is always ascending, handled by the main return
					break;
			}

			// General comparison for asc/desc.
			// For orderIndex, sortDirection will always be 'asc' due to handleSortButtonClick logic.
			if (sortDirection === 'asc') {
				if (valA === Infinity && valB === Infinity) return 0;
				if (valA === Infinity) return 1;
				if (valB === Infinity) return -1;
				return valA - valB;
			} else { // sortDirection === 'desc'
				if (valA === Infinity && valB === Infinity) return 0;
				if (valA === Infinity) return 1; 
				if (valB === Infinity) return -1;
				return valB - valA;
			}
		});
		filteredQuests = currentFilteredQuests;
	}

	// Save showHolograms preference to localStorage
	$: if (typeof localStorage !== 'undefined') {
		localStorage.setItem("taskShowHolograms", showHolograms.toString());
	}

	// Handler for optimistic position updates from CanvasView
	function handleCanvasQuestPositionChange(event: CustomEvent) {
		const { key, position } = event.detail;
		if (key && position && store[key]) {
			store = {
				...store,
				[key]: {
					...store[key],
					position: position
				}
			};
			quests = Object.entries(store); // Trigger reactivity
			// console.log('[Tasks.svelte] Optimistically updated position for key:', key, 'to', position);
		} else {
			// console.warn('[Tasks.svelte] Could not optimistically update position for event:', event.detail);
		}
	}


</script>

<div class="space-y-8">
	<!-- Header Section -->
	<div class="bg-gradient-to-r from-gray-800 to-gray-700 py-8 px-8 rounded-3xl shadow-2xl">
		<div class="flex flex-col md:flex-row justify-between items-center">
			<div class="text-center md:text-left mb-4 md:mb-0">
				<h1 class="text-4xl font-bold text-white mb-2">Tasks Overview</h1>
				<p class="text-gray-300 text-lg">{new Date().toDateString()}</p>
			</div>
		</div>
	</div>

	<!-- Main Content Container -->
	<div class="flex flex-col xl:flex-row gap-8">
		<!-- Tasks Panel -->
		<div class="xl:flex-1 bg-gray-800 rounded-3xl shadow-xl min-h-[600px]">
			<div class="p-8">
				<!-- Stats Section -->
				<div class="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
					<div class="bg-gray-700/50 rounded-2xl p-4 text-center">
						<div class="text-2xl font-bold text-white mb-1">
							{quests.filter(
								([_, quest]) =>
									(!quest.type || quest.type === "task" || quest.type === "recurring") &&
									!quest.participants?.length &&
									quest.status !== "completed"
							).length}
						</div>
						<div class="text-sm text-gray-400">Unassigned</div>
					</div>
					<div class="bg-gray-700/50 rounded-2xl p-4 text-center">
						<div class="text-2xl font-bold text-white mb-1">
							{quests.filter(
								([_, quest]) => 
									(!quest.type || quest.type === "task" || quest.type === "recurring") &&
									quest.status !== "completed"
							).length}
						</div>
						<div class="text-sm text-gray-400">Open Tasks</div>
					</div>
					<div class="bg-gray-700/50 rounded-2xl p-4 text-center">
						<div class="text-2xl font-bold text-white mb-1">
							{quests.filter(
								([_, quest]) => 
									(!quest.type || quest.type === "task" || quest.type === "recurring") &&
									(quest.status === "recurring" || quest.status === "repeating")
							).length}
						</div>
						<div class="text-sm text-gray-400">Recurring</div>
					</div>
					<div class="bg-gray-700/50 rounded-2xl p-4 text-center">
						<div class="text-2xl font-bold text-white mb-1">
							{quests.filter(
								([_, quest]) => 
									(!quest.type || quest.type === "task" || quest.type === "recurring") &&
									quest.status === "completed"
							).length}
						</div>
						<div class="text-sm text-gray-400">Completed</div>
					</div>
					<div class="bg-gray-700/50 rounded-2xl p-4 text-center">
						<div class="text-2xl font-bold text-white mb-1">
							{quests.filter(([_, quest]) => 
								!quest.type || quest.type === "task"
							).length}
						</div>
						<div class="text-sm text-gray-400">Total Tasks</div>
					</div>
				</div>

				<!-- Controls Section -->
				<div class="mb-6 space-y-4">
					<!-- Top Row: View Mode Toggle -->
					<div class="flex justify-center">
						<div class="flex items-center bg-gray-700 rounded-xl p-1">
							<button
								class="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors {viewMode === 'list'
									? 'bg-gray-600 text-white'
									: 'text-gray-400 hover:text-white'}"
								on:click={() => (viewMode = "list")}
								aria-label="Switch to list view"
							>
								<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
									<line x1="8" y1="6" x2="21" y2="6" />
									<line x1="8" y1="12" x2="21" y2="12" />
									<line x1="8" y1="18" x2="21" y2="18" />
									<line x1="3" y1="6" x2="3.01" y2="6" />
									<line x1="3" y1="12" x2="3.01" y2="12" />
									<line x1="3" y1="18" x2="3.01" y2="18" />
								</svg>
								<span class="hidden sm:inline">List</span>
							</button>
							<button
								class="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors {viewMode === 'canvas'
									? 'bg-gray-600 text-white'
									: 'text-gray-400 hover:text-white'}"
								on:click={() => (viewMode = "canvas")}
								aria-label="Switch to canvas view"
							>
								<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
									<path d="M5 9l-3 3 3 3"></path>
									<path d="M9 5l3-3 3 3"></path>
									<path d="M9 19l3 3 3-3"></path>
									<path d="M19 9l3 3-3 3"></path>
									<path d="M2 12h20"></path>
									<path d="M12 2v20"></path>
								</svg>
								<span class="hidden sm:inline">Canvas</span>
							</button>
						</div>
					</div>

					<!-- Second Row: Category and Sort -->
					<div class="flex flex-col sm:flex-row gap-3 items-center">
						<!-- Category Filter -->
						<div class="relative flex-1 w-full sm:w-auto">
							<select
								bind:value={selectedCategory}
								class="appearance-none bg-gray-700 text-white px-4 py-3 pr-8 rounded-xl cursor-pointer text-sm border border-gray-600 focus:border-blue-500 focus:outline-none w-full"
							>
								{#each categories as category}
									<option value={category}>
										{category === "all" ? "All Categories" : category}
									</option>
								{/each}
							</select>
							<div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400">
								<svg class="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
									<path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"/>
								</svg>
							</div>
						</div>

						<!-- Sort Button -->
						<button
							class="flex items-center justify-center gap-2 px-4 py-3 bg-gray-700 text-white rounded-xl text-sm hover:bg-gray-600 transition-colors border border-gray-600 w-full sm:w-auto min-w-[100px]"
							on:click={handleSortButtonClick}
							aria-label="Sort tasks"
						>
							<span>Sort</span>
							{#key currentIconPath}
							<svg
								class="w-4 h-4 transform transition-transform"
								style="transform: rotate({sortButtonIconRotation}deg)"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
							>
								<path d={currentIconPath}></path>
							</svg>
							{/key}
						</button>
					</div>

					<!-- Third Row: Toggle Switches -->
					<div class="flex flex-row gap-4 items-center justify-center">
						<!-- Show Completed Toggle -->
						<label class="flex items-center cursor-pointer">
							<div class="relative">
								<input
									type="checkbox"
									class="sr-only"
									bind:checked={showCompleted}
								/>
								<div class="w-11 h-6 bg-gray-600 rounded-full shadow-inner border border-gray-500"></div>
								<div
									class="dot absolute w-4 h-4 bg-white rounded-full transition-transform duration-300 ease-in-out left-1 top-1"
									class:translate-x-5={showCompleted}
								></div>
							</div>
							<div class="ml-3 text-sm font-medium text-white whitespace-nowrap">
								<span class="hidden sm:inline">Show Completed</span>
								<span class="sm:hidden" aria-label="Show completed tasks">✓</span>
							</div>
						</label>

						<!-- Show Holograms Toggle -->
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
								<span class="sm:hidden" aria-label="Show hologram tasks">🔮</span>
							</div>
						</label>
					</div>
				</div>

				<!-- Add Task Button -->
				<div class="flex justify-center mb-6">
					<button
						on:click={showDialog}
						class="group flex items-center gap-3 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-medium transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl"
						aria-label="Add new task"
					>
						<div class="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center group-hover:bg-white/30 transition-colors">
							<span class="text-lg font-bold leading-none">+</span>
						</div>
						<span>Add New Task</span>
					</button>
				</div>

				<!-- Task Content -->
				{#if viewMode === "canvas"}
					{#if holonID} 
						<CanvasView
							{filteredQuests}
							{holonID}
							{showCompleted}
							on:taskClick={(e) => handleTaskClick(e.detail.key, e.detail.quest)}
							on:questPositionChanged={handleCanvasQuestPositionChange}
						/> 
					{:else} 
						<div class="flex items-center justify-center py-12">
							<div class="text-center">
								<div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-4 mx-auto"></div>
								<p class="text-gray-400">Loading canvas...</p>
							</div>
						</div>
					{/if}
				{:else}
					<div class="space-y-3">
						{#each filteredQuests as [key, quest]}
							{#if quest.status !== "completed" || (showCompleted && quest.status === "completed")}
								<button
									id={key}
									class="w-full task-card relative text-left group"
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
										class="p-3 rounded-xl transition-all duration-300 border border-transparent hover:border-gray-600 hover:shadow-md transform hover:scale-[1.005]"
										style="background-color: {quest.status === 'completed'
											? '#374151'
											: getColorFromCategory(quest.category, quest.type)}; 
											   opacity: {quest.status === 'completed' ? '0.7' : quest._meta?.resolvedFromHologram ? '0.75' : '1'};
											   {quest._meta?.resolvedFromHologram ? 'border: 2px solid #00BFFF; box-sizing: border-box; box-shadow: 0 0 20px rgba(0, 191, 255, 0.4), inset 0 0 20px rgba(0, 191, 255, 0.1);' : ''}"
									>
										<div class="flex items-center justify-between gap-3">
											<div class="flex items-center gap-3 flex-1 min-w-0">
												<!-- Task Icon -->
												<div class="flex-shrink-0 w-8 h-8 rounded-lg bg-black/20 flex items-center justify-center text-sm">
													{quest.type === 'event' ? '📅' : quest.type === 'quest' ? '⚔️' : quest.type === 'recurring' || quest.status === 'recurring' || quest.status === 'repeating' ? '🔄' : '✓'}
												</div>
												
												<!-- Main Content -->
												<div class="flex-1 min-w-0">
													<div class="flex items-center gap-2 mb-1">
														<h3 class="text-base font-bold text-gray-800 truncate">
															{quest.title}
														</h3>
														{#if quest._meta?.resolvedFromHologram}
															<button 
																class="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-500/20 text-blue-800 flex-shrink-0 hover:bg-blue-500/30 transition-colors" 
																title="Navigate to source holon: {getHologramSource(quest._meta.hologramSoul)}"
																on:click|stopPropagation={() => {
																	const match = quest._meta?.hologramSoul?.match(/Holons\/([^\/]+)/);
																	if (match) {
																		window.location.href = `/${match[1]}/tasks`;
																	}
																}}
															>
																<svg class="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
																	<path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
																</svg>
																{getHologramSource(quest._meta.hologramSoul)}
																<svg class="w-2 h-2" viewBox="0 0 24 24" fill="none" stroke="currentColor">
																	<path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
																</svg>
															</button>
														{/if}
														{#if quest.type === 'recurring' || quest.status === 'recurring' || quest.status === 'repeating'}
															<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-500/30 text-purple-800 flex-shrink-0">
																🔄
															</span>
														{/if}
														{#if quest.category}
															<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-black/10 text-gray-700 flex-shrink-0">
																<svg class="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
																	<path d="M11.03 8h-6.06l-3 8h6.06l3-8zm1.94 0l3 8h6.06l-3-8h-6.06zm1.03-2h4.03l3-2h-4.03l-3 2zm-8 0h4.03l-3-2h-4.03l3 2z"/>
																</svg>
																{quest.category}
															</span>
														{/if}
													</div>
													{#if quest.description}
														<p class="text-sm text-gray-700 truncate">
															{quest.description}
														</p>
													{/if}
												</div>
											</div>

											<!-- Right Side Meta Info -->
											<div class="flex items-center gap-3 flex-shrink-0 text-sm">
												{#if quest.location}
													<div class="flex items-center gap-1 text-gray-600">
														<span class="text-xs">📍</span>
														<span class="truncate max-w-16 text-xs">{quest.location.split(",")[0]}</span>
													</div>
												{/if}

												{#if quest.participants?.length > 0}
													<div class="flex items-center gap-1">
														<div class="flex -space-x-1 relative group" title={quest.participants.map(p => `${p.firstName || p.username} ${p.lastName ? p.lastName[0] + '.' : ''}`).join(', ')}>
															{#each quest.participants.slice(0, 2) as participant}
																<div class="relative">
																	<img
																		class="w-5 h-5 rounded-full border border-white shadow-sm"
																		src={`https://gun.holons.io/getavatar?user_id=${participant.id}`}
																		alt={`${participant.firstName || participant.username} ${participant.lastName ? participant.lastName[0] + '.' : ''}`}
																	/>
																</div>
															{/each}
															{#if quest.participants.length > 2}
																<div class="w-5 h-5 rounded-full bg-gray-400 flex items-center justify-center text-xs border border-white shadow-sm text-white font-medium">
																	<span>+{quest.participants.length - 2}</span>
																</div>
															{/if}
														</div>
													</div>
												{/if}

												{#if quest.when}
													<div class="text-xs font-medium text-gray-700 whitespace-nowrap">
														<div class="text-xs text-gray-600 mb-1">{formatDate(quest.when)}</div>
														{formatTime(quest.when)}
														{#if quest.ends}<br/>{formatTime(quest.ends)}{/if}
													</div>
												{/if}

												{#if quest.appreciation.length > 0}
													<div class="flex items-center gap-1 text-gray-600" title={`${quest.appreciation.length} appreciations`}>
														<span class="text-xs">👍</span>
														<span class="text-xs font-medium">{quest.appreciation.length}</span>
													</div>
												{/if}
											</div>
										</div>
									</div>
								</button>
							{/if}
						{/each}
						
						{#if filteredQuests.length === 0}
							<div class="text-center py-12">
								<div class="w-16 h-16 mx-auto mb-4 bg-gray-700 rounded-full flex items-center justify-center">
									<svg class="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
									</svg>
								</div>
								<h3 class="text-lg font-medium text-white mb-2">No tasks found</h3>
								<p class="text-gray-400 mb-4">Get started by creating your first task</p>
								<button
									on:click={showDialog}
									class="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors"
								>
									Create Task
								</button>
							</div>
						{/if}
					</div>
				{/if}
			</div>
		</div>

		<!-- Schedule Panel -->
		<div class="hidden xl:block xl:w-80 xl:flex-shrink-0">
			<div class="bg-gray-800 rounded-3xl shadow-xl">
				<Schedule />
			</div>
		</div>
	</div>
</div>

{#if selectedTask && holonID}
	<TaskModal
		quest={selectedTask.quest}
		questId={selectedTask.key}
		holonId={holonID}
		on:close={handleTaskDeleted}
		on:taskCompleted={handleTaskCompleted}
	/>
{/if}

<!-- Modern Task Input Modal -->
{#if showTaskInput}
	<div 
		class="fixed inset-0 z-50 overflow-auto bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
		on:click|self={hideDialog}
		on:keydown={handleDialogKeydown} 
		role="dialog"
		aria-modal="true"
		tabindex="-1" 
	>
		<div 
			class="bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md relative border border-gray-700"
			aria-labelledby="task-input-title"
		>
			<div class="p-6">
				<div class="flex items-center justify-between mb-6">
					<h3 id="task-input-title" class="text-white text-xl font-bold">Add New Task</h3>
					<button
						on:click={hideDialog}
						class="text-gray-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-gray-700"
						aria-label="Close task input dialog"
					>
						<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
						</svg>
					</button>
				</div>
				
				<form 
					on:submit|preventDefault={async (e) => {
						await handleAddTask();
						hideDialog();
					}}
					class="space-y-4"
				>
					<div>
						<label for="task-title" class="block text-sm font-medium text-gray-300 mb-2">Task Title</label>
						<input
							id="task-title"
							type="text"
							bind:value={newTask.title}
							placeholder="Enter task title..."
							class="w-full px-4 py-3 rounded-xl bg-gray-700 text-white placeholder-gray-400 border border-gray-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none transition-colors"
							required
						/>
					</div>
					<div>
						<label for="task-description" class="block text-sm font-medium text-gray-300 mb-2">Description</label>
						<textarea
							id="task-description"
							bind:value={newTask.description}
							placeholder="Enter task description..."
							class="w-full px-4 py-3 rounded-xl bg-gray-700 text-white placeholder-gray-400 border border-gray-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none transition-colors resize-none"
							rows="3"
						></textarea>
					</div>
					<div>
						<label for="task-category" class="block text-sm font-medium text-gray-300 mb-2">Category</label>
						<select
							id="task-category"
							bind:value={newTask.category}
							class="w-full px-4 py-3 rounded-xl bg-gray-700 text-white border border-gray-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none transition-colors"
						>
							<option value="">Select category...</option>
							{#each categories.filter(cat => cat !== 'all') as category}
								<option value={category}>{category}</option>
							{/each}
						</select>
					</div>
					<div class="flex justify-end gap-3 pt-4">
						<button
							type="button"
							on:click={hideDialog}
							class="px-6 py-2.5 text-sm font-medium rounded-xl bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white transition-colors"
							aria-label="Cancel adding task"
						>
							Cancel
						</button>
						<button
							type="submit"
							class="px-6 py-2.5 text-sm font-medium rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg"
							disabled={!newTask.title.trim()}
							aria-label="Add new task"
						>
							Create Task
						</button>
					</div>
				</form>
			</div>
		</div>
	</div>
{/if}

<!-- Add animation components -->
{#if showFireworks}
	<Fireworks />
{/if}
{#if showConfetti}
	<Confetti />
{/if}

<style>
	/* Toggle switch styling */
	.dot {
		transition: transform 0.3s ease-in-out;
	}
	.translate-x-5 {
		transform: translateX(1.25rem);
	}

	/* Task card styling */
	.task-card {
		position: relative;
		cursor: grab;
	}

	.task-card:hover {
		cursor: pointer;
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
		height: 3px;
		background: linear-gradient(90deg, #3B82F6, #1D4ED8);
		border-radius: 2px;
		box-shadow: 0 0 8px rgba(59, 130, 246, 0.5);
	}

	/* Text truncation utilities */
	.line-clamp-2 {
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	/* Smooth animations */
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

	/* Card hover effects */
	.task-card:hover .group {
		transform: translateY(-1px);
	}

	/* Custom scrollbar for modal */
	.modal-content::-webkit-scrollbar {
		width: 6px;
	}

	.modal-content::-webkit-scrollbar-track {
		background: #374151;
		border-radius: 3px;
	}

	.modal-content::-webkit-scrollbar-thumb {
		background: #6B7280;
		border-radius: 3px;
	}

	.modal-content::-webkit-scrollbar-thumb:hover {
		background: #9CA3AF;
	}
</style>
