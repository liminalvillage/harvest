<script>
	// @ts-nocheck

	import Holosphere from 'holosphere';
	import { onMount } from 'svelte';

	/**
	 * @type {string | any[]}
	 */
	let store = {};

	$: roles = Object.entries(store);
	$: holonID = '-1002029098719';
	let holosphere;

	onMount(() => {
		holosphere = new Holosphere('WeQuest');
		subscribeToroles();
	});

	// Suscribe to changes in the specified holon
	async function subscribeToroles() {
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
			<p class="text-2xl font-bold">Roles Today</p>
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
		<div class="mb-6">
			<label for="holon" class="block text-lg font-medium text-gray-700">Holon ID:</label>
			<input
				type="text"
				id="holon"
				bind:value={holonID}
				on:change={subscribeToroles}
				placeholder="Enter holon id"
				class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
			/>
		</div>
		<div class="flex flex-wrap">
			{#each roles as [key, role]}
					<div id={key} class="w-full md:w-4/12">
						<div class="p-2">
							<div
								class="p-4 rounded-3xl"
								style="background-color: {role.participants?.length ? '#abffab' : '#ffaccb'};"
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
									{#if role.participants.length > 0}
										<div class="flex items-center">
											🙋‍♂️ {role.participants.length}: <br />
											{#each role.participants as participant}
												{@html `@${participant}`}<br />
											{/each}
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
									<div
										class="text-sm rounded-lg flex flex-shrink-0 py-2 px-4 font-bold text-yellow-600"
									>
										{role.participants.length}
									</div>
								</div>
							</div>
						</div>
					</div>
			{/each}
		</div>
	</div>
	<div class="w-full mt-8 lg:mt-0 lg:w-4/12 lg:pl-4">
		<div class="bg-gray-800 rounded-3xl px-6 pt-6">
			<div class="flex text-white text-2xl pb-6 font-bold">
				<p>Client Messages</p>
			</div>
			<div>
				<div
					class="border-t solid border-gray-700 p-4 flex 2xl:items-start w-full hover:bg-gray-700"
				>
					<img
						src="https://images.unsplash.com/photo-1438761681033-6461ffad8d80?ixid=MXwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHw%3D&ixlib=rb-1.2.1&auto=format&fit=crop&w=2550&q=80"
						alt="profile"
						class="object-cover w-10 h-10 rounded-full"
					/>
					<div class="pl-4 w-full">
						<div class="flex items-center justify-between w-full">
							<div class="text-white font-medium">Stephanie</div>
							<div class="flex justify-center items-center cursor-pointer h-7 w-7">
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
									class="text-white"
								>
									<polygon
										points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
									/>
								</svg>
							</div>
						</div>
						<p class="my-2 text-sm text-gray-400">
							I got your first assignment. It was quite good. 🥳 We can continue with the next
							assignment.
						</p>
						<p class="text-right text-gray-400 text-sm">Dec, 12</p>
					</div>
				</div>
				<div
					class="border-t solid border-gray-700 p-4 flex 2xl:items-start w-full hover:bg-gray-700"
				>
					<img
						src="https://images.unsplash.com/photo-1600486913747-55e5470d6f40?ixid=MXwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHw%3D&ixlib=rb-1.2.1&auto=format&fit=crop&w=2550&q=80"
						alt="profile"
						class="object-cover w-10 h-10 rounded-full"
					/>
					<div class="pl-4 w-full">
						<div class="flex items-center justify-between w-full">
							<div class="text-white font-medium">Mark</div>
							<div class="flex justify-center items-center cursor-pointer h-7 w-7">
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
									class="text-white"
								>
									<polygon
										points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
									/>
								</svg>
							</div>
						</div>
						<p class="my-2 text-sm text-gray-400">
							Hey, can tell me about progress of project? I'm waiting for your response.
						</p>
						<p class="text-right text-gray-400 text-sm">Dec, 12</p>
					</div>
				</div>
				<div
					class="border-t solid border-gray-700 p-4 flex 2xl:items-start w-full hover:bg-gray-700"
				>
					<img
						src="https://images.unsplash.com/photo-1543965170-4c01a586684e?ixid=MXwxMjA3fDB8MHxzZWFyY2h8NDZ8fG1hbnxlbnwwfDB8MHw%3D&ixlib=rb-1.2.1&auto=format&fit=crop&w=900&q=60"
						alt="profile"
						class="object-cover w-10 h-10 rounded-full"
					/>
					<div class="pl-4 w-full">
						<div class="flex items-center justify-between w-full">
							<div class="text-white font-medium">David</div>
							<div class="flex justify-center items-center cursor-pointer h-7 w-7">
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
									class="text-white"
								>
									<polygon
										points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
									/>
								</svg>
							</div>
						</div>
						<p class="my-2 text-sm text-gray-400">
							Hey, can tell me about progress of project? I'm waiting for your response.
						</p>
						<p class="text-right text-gray-400 text-sm">Dec, 12</p>
					</div>
				</div>
				<div
					class="border-t solid border-gray-700 p-4 flex 2xl:items-start w-full hover:bg-gray-700"
				>
					<img
						src="https://images.unsplash.com/photo-1533993192821-2cce3a8267d1?ixid=MXwxMjA3fDB8MHxzZWFyY2h8MTl8fHdvbWFuJTIwbW9kZXJufGVufDB8fDB8&ixlib=rb-1.2.1&auto=format&fit=crop&w=900&q=60"
						alt="profile"
						class="object-cover w-10 h-10 rounded-full"
					/>
					<div class="pl-4 w-full">
						<div class="flex items-center justify-between w-full">
							<div class="text-white font-medium">Mark</div>
							<div class="flex justify-center items-center cursor-pointer h-7 w-7">
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
									class="text-white"
								>
									<polygon
										points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
									/>
								</svg>
							</div>
						</div>
						<p class="my-2 text-sm text-gray-400">
							I am really impressed! Can't wait to see the final result.
						</p>
						<p class="text-right text-gray-400 text-sm">Dec, 12</p>
					</div>
				</div>
			</div>
		</div>
	</div>
</div>
