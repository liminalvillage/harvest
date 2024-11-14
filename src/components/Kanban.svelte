<script>
	// @ts-nocheck
	import { onMount, getContext } from 'svelte';
	import { ID } from '../dashboard/store.ts'; 
	import { formatDate, formatTime } from '../utils/date';	
	import HoloSphere from 'holosphere';
	import Schedule from './ScheduleWidget.svelte';
    import Announcements from './Announcements.svelte';

	let holosphere = getContext('holosphere') || new HoloSphere('Holons');


	$: holonID = $ID ;
	let store = {};
	$: quests = Object.entries(store);

	// Load saved preferences from localStorage
	let isListView = localStorage.getItem('kanbanViewMode') === 'list' || false;
	let showCompleted = localStorage.getItem('kanbanShowCompleted') === 'true' || false;

	// Save preferences when they change
	$: {
		localStorage.setItem('kanbanViewMode', isListView ? 'list' : 'grid');
		localStorage.setItem('kanbanShowCompleted', showCompleted.toString());
	}

	onMount(async () => {
		// Fetch all quests from holon
		subscribeToquests();
		testUpcast();
		//quests = data.filter((quest) => (quest.status === 'ongoing' || quest.status === 'scheduled') && (quest.type === 'task' || quest.type === 'quest'));
	});

	ID.subscribe((value) => {
		holonID = value;
		subscribe();
	});

	$: update(holonID);

	function subscribe() {
		store = {};
		if (holosphere) {
			holosphere.subscribe(holonID, 'quests', (newquest, key) => {
				if (newquest) {
					// Updates the store with the new value
					store[key] = JSON.parse(newquest);
				} else {
					// A key may contain a null value (if data has been deleted/set to null)
					// if so, we remove the item from the store
					delete store[key];
					store = store;
				}
			});
		}
		
	}
	async function testUpcast(){
		if(holosphere){
		// 	console.log('Holosphere object', holosphere)
		// 	let holosphereResolution = holosphere
		// 	let ctx = {
        //     message: {
        //         chat: { id: "8c1e850d53b03ff" },  // Assign a unique chat ID or adjust as needed
        //         message_id: "tasks",
        //         text: `/quest "Test of the quest from the Kanban in svelte"`, // Assume title is part of content
        //         from: { id: '123', username: 'user' }  // Example user data
        //     },

		// }
		// 	holosphere.upcast("8c1e850d53b03ff", "tasks", ctx)
		
		// real data
		// let realdata = await holosphere.getKey("-4516851538", 'quests', '39')
		// // .once(data=>console.log('data from the reference', data))
		// // console.log("reference from actual quest: ", reference);
		// console.log("data from the actual quest: ", realdata);
		// // real data

		// // reference
		console.log('testing the reference!')
		let reference = holosphere.getNode("-4516851538", 'quests', '39')
		console.log("!reference: ", reference)
		// .once(data=>console.log("data", data))
		// holosphere.upcast("8c1e850d53b03ff", "quests", reference)

		// let realdata = holosphere.gun.get("1729747166746")
		// .once(data=>console.log("If it's actual data: ", data))
		// console.log("data from the actual quest: ", realdata);

		// 1729747166746

		}

	}

	function update(hex) {
		// Filter ongoing and scheduled quests
		const filteredQuests = quests.filter(
			([_, quest]) => quest.status === 'ongoing' || quest.status === 'scheduled'
		);

		// Sort quests by date field, falling back to when if date doesn't exist
		const sortedQuests = filteredQuests.sort(([_, a], [__, b]) => {
			const dateA = a.date ? new Date(a.date) : new Date(a.when);
			const dateB = b.date ? new Date(b.date) : new Date(b.when);
			return dateB - dateA;  // Newest first
		});

		return sortedQuests;
	}

	// Update the sorting in the template sections
	$: sortedQuests = quests.sort(([_, a], [__, b]) => {
		const dateA = a.date ? new Date(a.date) : new Date(a.when);
		const dateB = b.date ? new Date(b.date) : new Date(b.when);
		return dateB - dateA;
	});
</script>

<div class="flex flex-wrap">
	<div class="w-full lg:w-8/12 bg-gray-800 py-6 px-6 rounded-3xl">
		<div class="flex justify-between text-white items-center mb-8">
			<p class="text-2xl font-bold">Tasks Today</p>
			<p class="">{new Date().toDateString()}</p>
		</div>

		<div class="flex flex-wrap justify-between items-center pb-8">
			<div class="flex flex-wrap text-white">
				<div class="pr-10">
					<div class="text-2xl font-bold">
						{quests.filter(([_, quest]) => !quest.participants?.length && quest.status !== 'completed').length}
					</div>
					<div class="">Unassigned</div>
				</div>
				<div class="pr-10">
					<div class="text-2xl font-bold">
						{quests.filter(([_, quest]) => quest.status === 'ongoing').length}
					</div>
					<div class="">Ongoing</div>
				</div>
				<div class="pr-10">
					<div class="text-2xl font-bold">
						{quests.filter(([_, quest]) => quest.status === 'completed').length}
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
					class="text-white {isListView ? 'bg-gray-700' : 'bg-transparent'} p-2" 
					title="List View"
					on:click={() => isListView = true}
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
					class="text-white {!isListView ? 'bg-gray-700' : 'bg-transparent'} p-2 ml-2" 
					title="Grid View"
					on:click={() => isListView = false}
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
						<rect x="3" y="3" width="7" height="7" />
						<rect x="14" y="3" width="7" height="7" />
						<rect x="14" y="14" width="7" height="7" />
						<rect x="3" y="14" width="7" height="7" />
					</svg>
				</button>
			</div>
		</div>

		<div class="flex justify-end mb-4">
			<label class="flex items-center cursor-pointer">
				<div class="relative">
					<input 
						type="checkbox" 
						class="sr-only" 
						bind:checked={showCompleted}
					>
					<div class="w-10 h-6 bg-gray-600 rounded-full shadow-inner"></div>
					<div class="dot absolute w-4 h-4 bg-white rounded-full transition left-1 top-1" 
						class:translate-x-4={showCompleted}
					></div>
				</div>
				<div class="ml-3 text-sm font-medium text-white">
					Show Completed
				</div>
			</label>
		</div>

		{#if isListView}
			<div class="space-y-2">
				{#each sortedQuests as [key, quest]}
					{#if ((quest.status === 'ongoing' || quest.status === 'scheduled' || (showCompleted && quest.status === 'completed')) && (quest.type === 'task' || quest.type === 'quest'))}
						<div id={key} class="w-full">
							<div class="p-3 rounded-lg transition-colors {quest.status === 'completed' ? 'bg-gray-400 opacity-60' : 'bg-gray-300 hover:bg-gray-200'}">
								<div class="flex justify-between items-center gap-4">
									<div class="flex-1 min-w-0">
										<h3 class="text-base font-bold opacity-70 truncate">{quest.title}</h3>
										{#if quest.description}
											<p class="text-sm opacity-70 truncate">{quest.description}</p>
										{/if}
									</div>
									
									<div class="flex items-center gap-4 text-sm whitespace-nowrap">
										{#if quest.location}
											<div class="opacity-70">
												📍 {quest.location.split(',')[0]}
											</div>
										{/if}
										
										<div class="flex items-center gap-1">
											<span class="opacity-70 font-bold text-base">🙋‍♂️ {quest.participants.length}</span>
											<div class="flex -space-x-2">
												{#each quest.participants.slice(0, 3) as participant}
													{#if participant.picture}
														<img
															class="w-6 h-6 rounded-full border-2 border-gray-300"
															src={participant.picture}
															alt={participant.username}
														/>
													{/if}
												{/each}
												{#if quest.participants.length > 3}
													<div class="w-6 h-6 rounded-full bg-gray-400 flex items-center justify-center text-xs border-2 border-gray-300">
														+{quest.participants.length - 3}
													</div>
												{/if}
											</div>
										</div>

										{#if quest.when}
											<div class="text-sm font-medium">
												{formatTime(quest.when)}
												{#if quest.ends}- {formatTime(quest.ends)}{/if}
											</div>
										{/if}
										
										<div class="opacity-70 font-bold text-base">
											👍 {quest.appreciation.length}
										</div>
									</div>
								</div>
							</div>
						</div>
					{/if}
				{/each}
			</div>
		{:else}
			<div class="flex flex-wrap">
				{#each sortedQuests as [key, quest]}
					{#if ((quest.status === 'ongoing' || quest.status === 'scheduled' || (showCompleted && quest.status === 'completed')) && (quest.type === 'task' || quest.type === 'quest'))}
						<div id={key} class="w-full md:w-4/12">
							<div class="p-2">
								<div class="p-4 rounded-3xl overflow-hidden {quest.status === 'completed' ? 'bg-gray-400 opacity-60' : 'bg-gray-300'}">
									<div class="flex items-center justify-between">
										{#if quest.when}
											<span class="text-sm whitespace-nowrap">
												{formatDate(quest.when) + ' @ ' + formatTime(quest.when)}
												{#if quest.ends}- {formatTime(quest.ends)} {/if}
											</span>
										{/if}
									</div>
									<div class="text-center mb-4 mt-5">
										<p class="text-base font-bold opacity-70 truncate">{quest.title}</p>
									</div>
									{#if quest.description}
										<div class="text-sm opacity-70 mb-4 line-clamp-2">
											{quest.description}
										</div>
									{/if}
									{#if quest.location}
										<div class="text-sm opacity-70 mb-4 truncate">
											📍 {quest.location
													.split(',')
													.map((loc, i) => {
														if (i === 0) {
															return loc;
														} else {
															return loc.trim();
														}
													})
													.join(', ')}
										</div>
									{/if}
									
									<div class="flex justify-between pt-4 relative">
										<div class="flex flex-col overflow-hidden">
											<span class="opacity-70 font-bold text-base whitespace-nowrap mb-1">
												🙋‍♂️ {quest.participants.length}
											</span>
											<div class="text-sm opacity-70">
												{#each quest.participants.slice(0, 2) as participant}
													<div class="truncate">@{participant.username}</div>
												{/each}
												{#if quest.participants.length > 2}
													<div class="truncate">+{quest.participants.length - 2} more</div>
												{/if}
											</div>
										</div>
										<div class="opacity-70 font-bold text-base whitespace-nowrap">
											👍 {quest.appreciation.length}
										</div>
									</div>
								</div>
							</div>
						</div>
					{/if}
				{/each}
			</div>
		{/if}
	</div>
	<Schedule isWidget=true/>
	
</div>

<style>
	/* Add smooth transition for the toggle switch dot */
	.dot {
		transition: transform 0.3s ease-in-out;
	}
	.translate-x-4 {
		transform: translateX(1rem);
	}
</style>
