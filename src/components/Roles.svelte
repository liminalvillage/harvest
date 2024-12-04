<script>
	// @ts-nocheck

	import { onMount, getContext } from "svelte";
	import { ID } from "../dashboard/store.ts";
	import { browser } from "$app/environment";

	import HoloSphere from "holosphere";
	import Announcements from "./Announcements.svelte";
	import ItemModal from "./ItemModal.svelte";

	/**
	 * @type {string | any[]}
	 */
	let store = {};
	let userStore = {};
	$: holonID = $ID;

	$: roles = Object.entries(store || {});
	let holosphere = getContext("holosphere");

	// Initialize preferences with default values
	let isListView = false;

	// Load preferences only in browser environment
	onMount(() => {
		if (browser) {
			isListView =
				localStorage.getItem("rolesViewMode") === "list" || false;
		}
	});

	// Save preferences when they change
	$: {
		if (browser) {
			localStorage.setItem("rolesViewMode", isListView ? "list" : "grid");
		}
	}

	onMount(() => {
		ID.subscribe((value) => {
			holonID = value;
			subscribeToroles();
		});
	});

	// Suscribe to changes in the specified holon
	async function subscribeToroles() {
		store = {};
		userStore = {};
		if (holosphere) {
			holosphere.subscribe(holonID, "roles", (newrole, key) => {
				if (newrole) {
					try {
						store = { ...store, [key]: JSON.parse(newrole) };
					} catch (e) {
						console.error("Error parsing role:", e);
					}
				} else {
					const { [key]: _, ...rest } = store;
					store = rest;
				}
			});

			// Subscribe to users
			holosphere.subscribe(holonID, "users", (newUser, key) => {
				if (newUser) {
					try {
						userStore[key] = JSON.parse(newUser);
						userStore = userStore;
					} catch (e) {
						console.error("Error parsing user:", e);
					}
				} else {
					delete userStore[key];
					userStore = userStore;
				}
			});
		}
	}

	// Format time for display
	/**
	 * @param {string | number | Date} dateTime
	 */
	function formatTime(dateTime) {
		const options = { hour: "2-digit", minute: "2-digit" };
		return new Date(dateTime).toLocaleTimeString([], options);
	}

	function formatDate(dateTime) {
		const date = new Date(dateTime);
		const today = new Date();
		const tomorrow = new Date(today);
		tomorrow.setDate(tomorrow.getDate() + 1);

		if (date.toDateString() === today.toDateString()) {
			return "today";
		} else if (date.toDateString() === tomorrow.toDateString()) {
			return "tomorrow";
		} else {
			const diff = Math.ceil((date - today) / (1000 * 60 * 60 * 24));
			return `in ${diff} days`;
		}
	}

	function getRoleColor(role) {
		if (!role.participants || role.participants.length === 0) {
			return "#553333"; // Red tint for unassigned roles
		}
		if (role.when) {
			const roleDate = new Date(role.when);
			const today = new Date();

			// If the role is in the past
			if (roleDate < today) {
				return "#553355"; // Purple tint for past roles
			}

			// If the role is today
			if (roleDate.toDateString() === today.toDateString()) {
				return "#335533"; // Green tint for today's roles
			}

			// If the role is in the future
			return "#333355"; // Blue tint for future roles
		}
		return "#555555"; // Default gray for roles without dates
	}

	let selectedRole = null;

	function handleRoleClick(key, role) {
		console.log("Clicked role:", { key, role }); // Debug log
		selectedRole = { key, role };
		console.log("Selected role:", selectedRole); // Debug log
	}
</script>

<div class="flex flex-wrap">
	<div class="w-full lg:w-8/12 bg-gray-800 py-6 px-6 rounded-3xl">
		<div class="flex justify-between text-white items-center mb-8">
			<div>
				<h1 class="text-2xl font-bold">Roles</h1>
				<p class="text-lg mt-1">Active Roles</p>
			</div>
			<p class="">{new Date().toDateString()}</p>
		</div>

		<div class="flex flex-wrap justify-between items-center pb-8">
			<div class="flex flex-wrap text-white">
				<div class="pr-10">
					<div class="text-2xl font-bold">{roles.length}</div>
					<div class="">Total Roles</div>
				</div>
				<div class="pr-10">
					<div class="text-2xl font-bold">
						{roles.filter(
							(role) => role[1].participants?.length > 0
						).length}
					</div>
					<div class="">Assigned</div>
				</div>
				<div>
					<div class="text-2xl font-bold">
						{roles.length -
							roles.filter(
								(role) => role[1].participants?.length > 0
							).length}
					</div>
					<div class="">Unassigned</div>
				</div>
			</div>

			<div class="flex items-center mt-4 md:mt-0">
				<button
					class="text-white {isListView
						? 'bg-gray-700'
						: 'bg-transparent'} p-2"
					title="List View"
					on:click={() => (isListView = true)}
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
					class="text-white {!isListView
						? 'bg-gray-700'
						: 'bg-transparent'} p-2 ml-2"
					title="Grid View"
					on:click={() => (isListView = false)}
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

		{#if isListView}
			<div class="space-y-2">
				{#each roles as [key, role]}
					<div
						id={key}
						class="w-full task-card relative"
						on:click|stopPropagation={() =>
							handleRoleClick(key, role)}
						on:keydown|stopPropagation={(e) => {
							if (e.key === "Enter" || e.key === " ") {
								handleRoleClick(key, role);
							}
						}}
						role="button"
						tabindex="0"
					>
						<div
							class="p-3 rounded-lg transition-colors"
							style="background-color: {getRoleColor(
								role
							)}; color: white;"
							role="button"
							tabindex="0"
						>
							<div
								class="flex justify-between items-center gap-4"
							>
								<div class="flex-1 min-w-0">
									<h3
										class="text-base font-bold opacity-70 truncate"
									>
										{role.title}
									</h3>
									{#if role.description}
										<p class="text-sm opacity-70 truncate">
											{role.description}
										</p>
									{/if}
								</div>

								<div
									class="flex items-center gap-4 text-sm whitespace-nowrap"
								>
									{#if role.when}
										<div class="text-sm font-medium">
											{formatDate(role.when)} @ {formatTime(
												role.when
											)}
											{#if role.ends}- {formatTime(
													role.ends
												)}{/if}
										</div>
									{/if}

									{#if role.participants?.length > 0}
										<div class="flex items-center gap-1">
											<span
												class="opacity-70 font-bold text-base"
												>🙋‍♂️ {role.participants
													.length}</span
											>
											<div class="flex -space-x-2 relative group">
												{#each role.participants.slice(0, 3) as participant}
													<div class="relative">
														<img
															class="w-6 h-6 rounded-full border-2 border-gray-300"
															src={`http://gun.holons.io/getavatar?user_id=${participant.id}`}
															alt={participant.username}
														/>
														<div class="absolute invisible group-hover:visible bg-gray-900 text-white text-xs rounded py-1 px-2 -bottom-8 left-1/2 transform -translate-x-1/2 whitespace-nowrap z-10">
															{participant.username}
														</div>
													</div>
												{/each}
												{#if role.participants.length > 3}
													<div class="w-6 h-6 rounded-full bg-gray-400 flex items-center justify-center text-xs border-2 border-gray-300">
														+{role.participants.length - 3}
													</div>
												{/if}
											</div>
										</div>
									{/if}
								</div>
							</div>
						</div>
					</div>
				{/each}
			</div>
		{:else}
			<div class="flex flex-wrap">
				{#each roles as [key, role]}
					<div
						id={key}
						class="w-full md:w-4/12 task-card relative"
						on:click|stopPropagation={() =>
							handleRoleClick(key, role)}
						on:keydown|stopPropagation={(e) => {
							if (e.key === "Enter" || e.key === " ") {
								handleRoleClick(key, role);
							}
						}}
						role="button"
						tabindex="0"
					>
						<div class="p-2">
							<div
								class="p-4 rounded-3xl transition-colors"
								style="background-color: {getRoleColor(
									role
								)}; color: white;"
								role="button"
								tabindex="0"
							>
								<div class="flex items-center justify-between">
									{#if role.when}
										<span class="text-sm whitespace-nowrap">
											{formatDate(role.when)} @ {formatTime(
												role.when
											)}
											{#if role.ends}- {formatTime(
													role.ends
												)}{/if}
										</span>
									{/if}
								</div>
								<div class="text-center mb-4 mt-5">
									<p
										class="text-base font-bold opacity-70 truncate"
									>
										{role.title}
									</p>
								</div>

								{#if role.description}
									<div
										class="text-sm opacity-70 mb-4 line-clamp-2"
									>
										{role.description}
									</div>
								{/if}

								<div class="flex justify-between pt-4">
									{#if role.participants?.length > 0}
										<div class="flex flex-col overflow-hidden">
											<span class="opacity-70 font-bold text-base whitespace-nowrap mb-1">
												🙋‍♂️ {role.participants.length}
											</span>
											<div class="flex -space-x-2 relative group">
												{#each role.participants.slice(0, 3) as participant}
													<div class="relative">
														<img
															class="w-6 h-6 rounded-full border-2 border-gray-300"
															src={`http://gun.holons.io/getavatar?user_id=${participant.id}`}
															alt={participant.username}
														/>
														<div class="absolute invisible group-hover:visible bg-gray-900 text-white text-xs rounded py-1 px-2 -bottom-8 left-1/2 transform -translate-x-1/2 whitespace-nowrap z-10">
															{participant.username}
														</div>
													</div>
												{/each}
												{#if role.participants.length > 3}
													<div class="w-6 h-6 rounded-full bg-gray-400 flex items-center justify-center text-xs border-2 border-gray-300 relative group">
														<span>+{role.participants.length - 3}</span>
														<div class="absolute invisible group-hover:visible bg-gray-900 text-white text-xs rounded py-1 px-2 -bottom-8 left-1/2 transform -translate-x-1/2 whitespace-nowrap z-10">
															{role.participants.slice(3).map((p) => p.username).join(", ")}
														</div>
													</div>
												{/if}
											</div>
										</div>
									{/if}
								</div>
							</div>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
	<Announcements />
</div>

{#if selectedRole}
	<ItemModal
		role={selectedRole.role}
		roleId={selectedRole.key}
		{userStore}
		{holosphere}
		holonId={holonID}
		on:close={() => {
			console.log("Closing modal");
			selectedRole = null;
		}}
	/>
{/if}

<style>
	.space-y-2 > :not([hidden]) ~ :not([hidden]) {
		margin-top: 0.5rem;
	}

	.line-clamp-2 {
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.task-card {
		position: relative;
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
</style>
