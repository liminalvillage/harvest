<script>
	// @ts-nocheck
	import { onMount, getContext } from 'svelte';

	import { formatDate, formatTime } from '../utils/date';

	
	import HoloSphere from 'holosphere';
	import Announcements from './Announcements.svelte';

	let holosphere = getContext('holosphere') || new HoloSphere('Holons');

	export let ID = '-1002029098719';

	let store = {}
	$: quests = Object.entries(store)

	onMount(async () => {
		//const data = await holosphere.get(holonID, 'quests');
		//quests = data.filter((quest) => (quest.status === 'ongoing' || quest.status === 'scheduled') && (quest.type === 'task' || quest.type === 'quest'));
		
		holosphere.subscribe(ID, 'quests', (newquest, key) => {
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
	});

	$: update(ID);

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
		</div>
	</div>



	{#each quests as [key, quest]}
		{#if (quest.status === 'ongoing' || quest.status === 'scheduled') && (quest.type === 'task' || quest.type === 'quest') }
			<div id = {key} class="w-full md:w-4/12">
				<div class="p-2">
					<div class="p-4 rounded-3xl bg-gray-300">
						<div class="flex items-center justify-b">
							{#if quest.when}<span class="text-sm"
									>{formatDate(quest.when) + ' @ ' + formatTime(quest.when)}
									{#if quest.ends}- {formatTime(quest.ends)} {/if}</span
								>
							{/if}
						</div>
						<div class="text-center mb-4 mt-5">
							<p class="text-base font-bold opacity-70">{quest.title}</p>
							<!-- <p class="text-sm opacity-70 mt-2">{role}</p> -->
						</div>
						{#if quest.description}
							<div class="text-sm opacity-70 mb-4">
								{quest.description}
							</div>
						{/if}
						{#if quest.location}
							<div class="text-sm opacity-70 mb-4">
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
						{#if false}
							<div>
								<p class="text-sm font-bold m-0">Progress</p>
								<div class="w-full h-1 rounded-md overflow-hidden bg-white my-2 mx-0">
									<span class="block h-1 rounded-md bg-yellow-700 w-6/12" />
								</div>
								<p class="text-right m-0 text-sm font-bold">60%</p>
							</div>
						{/if}
						<div class="flex justify-between pt-4 relative">
							<div class="flex items-center">
								🙋‍♂️ {quest.participants.length}: <br />
								{#each quest.participants as participant}
									{@html `@${participant.username}`}<br />
								{/each}
								<!-- <img
                            class="w-5 h-5 rounded-full overflow-hidden object-cover"
                            src="https://images.unsplash.com/photo-1438761681033-6461ffad8d80?ixid=MXwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHw%3D&ixlib=rb-1.2.1&auto=format&fit=crop&w=2550&q=80"
                            alt="participant"
                        />
                        <button
                            class="w-5 h-5 rounded-full border-none ml-3 p-0 flex justify-center items-center bg-white"
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="12"
                                height="12"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="3"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                class="feather feather-plus"
                            >
                                <path d="M12 5v14M5 12h14" />
                            </svg>
                        </button> -->
							</div>
							<div
								class="text-sm rounded-lg flex flex-shrink-0 py-2 px-4 font-bold text-yellow-600"
							>
								👍 {quest.appreciation.length}
							</div>
						</div>
					</div>
				</div>
			</div>
		{/if}
	{/each}
	<Announcements/>
</div>
