<script>
	// @ts-nocheck

	import { onMount, getContext } from 'svelte';
	import { ID } from '../dashboard/store.ts';
	
	import HoloSphere from 'holosphere';
	import Announcements from './Announcements.svelte';



	/**
	 * @type {string | any[]}
	 */
	let store = {};
	$: holonID = $ID;
	

	$: roles = Object.entries(store);
	let holosphere = getContext('holosphere') || new HoloSphere('Holons');

	onMount(() => {
		subscribeToroles();
	});

	ID.subscribe((value) => {
		holonID = value;
		subscribeToroles();
	});

	// Suscribe to changes in the specified holon
	async function subscribeToroles() {
		store = {};
		if (holosphere)
			holosphere.subscribe(holonID, 'roles', (newrole, key) => {
				if (newrole) {
					// Updates the store with the new value
					store[key] = JSON.parse(newrole);
				} else {
					// A key may contain a null value (if data has been deleted/set to null)
					// if so, we remove the item from the store
					delete store[key];
					store = store;
				}
			});
	}

	// Format time for display
	/**
	 * @param {string | number | Date} dateTime
	 */
	function formatTime(dateTime) {
		const options = { hour: '2-digit', minute: '2-digit' };
		return new Date(dateTime).toLocaleTimeString([], options);
	}

	function formatDate(dateTime) {
		const date = new Date(dateTime);
		const today = new Date();
		const tomorrow = new Date(today);
		tomorrow.setDate(tomorrow.getDate() + 1);

		if (date.toDateString() === today.toDateString()) {
			return 'today';
		} else if (date.toDateString() === tomorrow.toDateString()) {
			return 'tomorrow';
		} else {
			const diff = Math.ceil((date - today) / (1000 * 60 * 60 * 24));
			return `in ${diff} days`;
		}
	}
</script>

<div class="flex flex-wrap">
	<div class="w-full lg:w-8/12 bg-gray-800 py-6 px-6 rounded-3xl">
		<div class="flex justify-between text-white items-center mb-8">
			<p class="text-2xl font-bold">Roles
			</p>
			<p class="">{new Date().toDateString()}</p>
		</div>

		<div class="flex flex-wrap justify-between items-center pb-8">
			<div class="flex flex-wrap text-white">
				<div class="pr-10">
					<div class="text-2xl font-bold">{roles.length}</div>
					<div class="">Roles</div>
				</div>
				<div>
					<div class="text-2xl font-bold">
						{roles.length - roles.filter((role) => role.participants?.length > 0).length}
					</div>
					<div class="">Unassigned</div>
				</div>
			</div>

			<div class="flex items-center mt-4 md:mt-0">
				<button class="text-white bg-transparent" title="List View">
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
				<button class="text-white bg-gray-700 p-2 ml-2" title="Grid View">
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
		
		<div class="flex flex-wrap">
			{#each roles as [key, role]}
					<div id={key} class="w-full md:w-4/12">
						<div class="p-2">
							<div
								class="p-4 rounded-3xl"
								style="background-color: {role.participants?.length ? '#eeeeee' : '#555555'};"
							>
								<div class="flex items-center justify-b">
									{#if role.when}<span class="text-sm"
											>{formatDate(role.when) + ' @ ' + formatTime(role.when)}
											{#if role.ends}- {formatTime(role.ends)} {/if}</span
										>
									{/if}
								</div>
								<div class="text-center mb-4 mt-5">
									<p class="text-base font-bold opacity-70">{role.title}</p>
									<!-- <p class="text-sm opacity-70 mt-2">{role}</p> -->
								</div>

								{#if role.description}<div class="mt-2 text-gray-800">{role.description}</div>{/if}
								<!-- {#if role.participants.length > 0}
								<div class="mt-2 text-indigo-500">
									Assigned: {role.participants
										.map((participant) => participant.name)
										.join(', ')}
								</div>
							{/if} -->

								<div class="flex justify-between pt-4 relative">
									{#if role.participants && role.participants.length > 0}
										<div class="flex items-center">
											<div
											class="text-sm rounded-lg flex flex-shrink-0 py-2 px-4 font-bold text-yellow-600"
										>
										🙋‍♂️{role.participants.length}:
										
											{#each role.participants as participant}
												{#if participant && participant.picture}
													<img
														class="w-5 h-5 rounded-full overflow-hidden object-cover"
														 src={participant.picture}
														alt="participant"
													/>
												{/if}
												<br/>
												{#if participant}
													{@html `@${participant}`}<br/>
												{/if}
											{/each}
										</div>
										</div>
									{/if}
									<!-- <div class="flex items-center">
										<img
											class="w-5 h-5 rounded-full overflow-hidden object-cover"
											src="https://images.unsplash.com/photo-1438761681033-6461ffad8d80?ixid=MXwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHw%3D&ixlib=rb-1.2.1&auto=format&fit=crop&w=2550&q=80"
											alt="participant"
										/>
										<img
											class="w-5 h-5 rounded-full overflow-hidden object-cover"
											src="https://images.unsplash.com/photo-1503023345310-bd7c1de61c7d?ixid=MXwxMjA3fDB8MHxzZWFyY2h8MTB8fG1hbnxlbnwwfHwwfA%3D%3D&ixlib=rb-1.2.1&auto=format&fit=crop&w=900&q=60"
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
										</button>
									</div> -->
								
								</div>
							</div>
						</div>
					</div>
			{/each}
		</div>
	</div>
	<Announcements/>
</div>
