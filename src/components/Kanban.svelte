<script>
	// @ts-nocheck
	import { onMount, getContext } from 'svelte';
	import { ID } from '../dashboard/store.ts'; 
	import { formatDate, formatTime } from '../utils/date';
	

	import HoloSphere from 'holosphere';
	import Announcements from './Announcements.svelte';

	let holosphere = getContext('holosphere') || new HoloSphere('Holons');

	export let id;

	$: holonID = $ID ;
	let store = {};
	$: quests = Object.entries(store);

	// Add view state
	let isListView = false;

	onMount(async () => {
		// Fetch all quests from holon
		subscribeToquests();

		//quests = data.filter((quest) => (quest.status === 'ongoing' || quest.status === 'scheduled') && (quest.type === 'task' || quest.type === 'quest'));
	});

	ID.subscribe((value) => {
		holonID = value;
		subscribeToquests();
	});

	$: update(holonID);

	function subscribeToquests() {
		store = {};
		if (holosphere) {
			holosphere.subscribe(id||holonID, 'quests', (newquest, key) => {
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

	function update(hex) {
		// Filter ongoing and scheduled quests
		const filteredQuests = quests.filter(
			(quest) => quest.status === 'ongoing' || quest.status === 'scheduled'
		);

		// Sort quests by when property
		const sortedQuests = filteredQuests.sort((a, b) => new Date(a.when) - new Date(b.when));

		return sortedQuests;
	}
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
						{quests.filter((quest) => quest.status === 'ongoing' || quest.status === 'scheduled')
							.length}
					</div>
					<div class="">In Progress</div>
				</div>
				<div class="pr-10">
					<div class="text-2xl font-bold">
						{quests.filter((quest) => quest.status === 'completed').length}
					</div>
					<div class="">Upcoming</div>
				</div>
				<div>
					<div class="text-2xl font-bold">{quests.length}</div>
					<div class="">Total Projects</div>
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

		<!-- Replace the existing flex-wrap div with this conditional rendering -->
		{#if isListView}
			<div class="space-y-2">
				{#each quests as [key, quest]}
					{#if (quest.status === 'ongoing' || quest.status === 'scheduled') && (quest.type === 'task' || quest.type === 'quest')}
						<div id={key} class="w-full">
							<div class="p-3 rounded-lg bg-gray-300 hover:bg-gray-200 transition-colors">
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
				{#each quests as [key, quest]}
					{#if (quest.status === 'ongoing' || quest.status === 'scheduled') && (quest.type === 'task' || quest.type === 'quest')}
						<div id={key} class="w-full md:w-4/12">
							<div class="p-2">
								<div class="p-4 rounded-3xl bg-gray-300 overflow-hidden">
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
	<Announcements />
</div>
