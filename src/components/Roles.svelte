<script lang="ts">
	// @ts-nocheck

	import { onMount, onDestroy, getContext } from "svelte";
	import { ID } from "../dashboard/store";
	import { browser } from "$app/environment";

	import HoloSphere from "holosphere";
	import Announcements from "./Announcements.svelte";
	import ItemModal from "./ItemModal.svelte";

	/**
	 * @type {Record<string, any>}
	 */
	let store = {};
	/**
	 * @type {Record<string, any>}
	 */
	let userStore = {};
	let activeHolonId: string | undefined; // Manages the current Holon ID for this component
	let isUserStoreReady = false; // Tracks if userStore has been populated for the activeHolonId

	$: roles = Object.entries(store || {});
	let holosphere = getContext("holosphere") as HoloSphere;

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

	let idStoreUnsubscribe: (() => void) | undefined;
	let rolesSubscriptionUnsubscribe: (() => void) | undefined;
	let usersSubscriptionUnsubscribe: (() => void) | undefined;

	async function loadAndSubscribeData(holonIdToLoad: string) {
		console.log(`[Roles.svelte] loadAndSubscribeData called for holon: ${holonIdToLoad}`);
		// This function is called when activeHolonId is set or changes.
		// Ensure previous holosphere subscriptions are cleaned up before making new ones.
		if (typeof rolesSubscriptionUnsubscribe === 'function') {
			rolesSubscriptionUnsubscribe();
		}
		rolesSubscriptionUnsubscribe = undefined;

		if (typeof usersSubscriptionUnsubscribe === 'function') {
			usersSubscriptionUnsubscribe();
		}
		usersSubscriptionUnsubscribe = undefined;

		// ALWAYS reset stores AND readiness flags before loading new data for holonIdToLoad
		store = {};
		userStore = {};
		isUserStoreReady = false;

		if (!holosphere || !holonIdToLoad) {
			console.warn("[Roles.svelte] loadAndSubscribeData called without holosphere or holonIdToLoad.");
			return; // Nothing to do if no holosphere or id
		}

		// Fetch initial roles
		try {
			let initialRolesData = await holosphere.getAll(holonIdToLoad, "roles");
			if (Array.isArray(initialRolesData)) {
				console.warn("[Roles.svelte] holosphere.getAll('roles') returned an ARRAY. Converting to object map using 'title' as key. Ensure this key matches subscription keys.", initialRolesData);
				store = initialRolesData.reduce((acc, role) => {
					const roleKey = role.title; // Assuming 'title' is the unique key, matching subscription key
					if (roleKey) {
						acc[roleKey] = role;
					} else {
						console.error("[Roles.svelte] Role object from getAll is missing a 'title' for keying:", role, "Original array:", initialRolesData);
					}
					return acc;
				}, {});
			} else if (typeof initialRolesData === 'object' && initialRolesData !== null) {
                store = initialRolesData;
            } else {
                console.warn("[Roles.svelte] holosphere.getAll('roles') returned unexpected data type or null. Initializing store to empty object.", initialRolesData);
				store = {}; // Default to empty object if not array or proper object
			}
		} catch (e) {
			console.error(`[Roles.svelte] Error fetching initial roles for ${holonIdToLoad}:`, e);
			store = {}; // Reset store on error
		}
		console.log("[Roles.svelte] Store after initial getAll('roles') and processing:", JSON.parse(JSON.stringify(store)));

		// Fetch initial users
		try {
			const initialUsers = await holosphere.getAll(holonIdToLoad, "users");
			userStore = initialUsers || {}; // Assuming users will always be an object map or null
			console.log("[Roles.svelte] User store populated:", JSON.parse(JSON.stringify(userStore)));
					} catch (e) {
			console.error(`[Roles.svelte] Error fetching initial users for ${holonIdToLoad}:`, e);
			userStore = {}; // Reset store on error
		} finally {
			isUserStoreReady = true;
			console.log("[Roles.svelte] isUserStoreReady set to true.");
		}

		// Subscribe to role updates
		rolesSubscriptionUnsubscribe = holosphere.subscribe(holonIdToLoad, "roles", (newRole, key) => {
			if (!key || key === 'undefined') {
				console.warn(`[Roles.svelte] Subscription received update with invalid key: '${key}'. Skipping update for role:`, newRole);
				return; 
			}
			console.log(`[Roles.svelte] Subscription update for holon '${holonIdToLoad}', key: '${key}'`);
			console.log("[Roles.svelte] newRole received:", JSON.parse(JSON.stringify(newRole || {})));
			console.log("[Roles.svelte] Store BEFORE update:", JSON.parse(JSON.stringify(store)));

			if (newRole) {
                const oldRole = store[key];
                if (oldRole) {
                    console.log(`[Roles.svelte] Updating existing role. Key '${key}' found in store.`);
                } else {
                    console.log(`[Roles.svelte] Adding new role. Key '${key}' NOT found in store (this is expected if it's truly new).`);
                }
				store = { ...store, [key]: newRole };
				} else {
				console.log(`[Roles.svelte] Deleting role with key '${key}'.`);
					const { [key]: _, ...rest } = store;
					store = rest;
				}
			console.log("[Roles.svelte] Store AFTER update:", JSON.parse(JSON.stringify(store)));
			});

		// Subscribe to user updates
		usersSubscriptionUnsubscribe = holosphere.subscribe(holonIdToLoad, "users", (newUser, key) => {
			if (!key || key === 'undefined') {
				console.warn(`[Roles.svelte] Subscription received update with invalid key: '${key}' for user. Skipping update for user:`, newUser);
				return;
			}
				if (newUser) {
				userStore = { ...userStore, [key]: newUser };
			} else {
				const { [key]: _, ...rest } = userStore;
				userStore = rest;
			}
		});
	}

	onMount(() => {
		// Logic for isListView from localStorage is already here and is fine.

		idStoreUnsubscribe = ID.subscribe(newIdFromStore => {
			if (newIdFromStore !== activeHolonId) { // Covers initial set, change, and clear
				console.log(`[Roles.svelte] ID store changed. Old: ${activeHolonId}, New: ${newIdFromStore}`);
				activeHolonId = newIdFromStore; // Update our active ID

				if (activeHolonId) {
					// Reset readiness flag here as well, loadAndSubscribeData will set it true when done
					isUserStoreReady = false; 
					loadAndSubscribeData(activeHolonId);
				} else {
					console.log("[Roles.svelte] ActiveHolonId cleared. Cleaning up subscriptions and stores.");
					if (typeof rolesSubscriptionUnsubscribe === 'function') rolesSubscriptionUnsubscribe();
					rolesSubscriptionUnsubscribe = undefined;
					if (typeof usersSubscriptionUnsubscribe === 'function') usersSubscriptionUnsubscribe();
					usersSubscriptionUnsubscribe = undefined;
					store = {};
					userStore = {};
					isUserStoreReady = false; // Also reset here if ID is cleared
				}
				}
			});
	});

	onDestroy(() => {
		console.log("[Roles.svelte] Component destroyed. Cleaning up all subscriptions.");
		if (typeof idStoreUnsubscribe === 'function') idStoreUnsubscribe();
		idStoreUnsubscribe = undefined;
		if (typeof rolesSubscriptionUnsubscribe === 'function') rolesSubscriptionUnsubscribe();
		rolesSubscriptionUnsubscribe = undefined;
		if (typeof usersSubscriptionUnsubscribe === 'function') usersSubscriptionUnsubscribe();
		usersSubscriptionUnsubscribe = undefined;
	});

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
					class="text-white {!isListView
						? 'bg-gray-700'
						: 'bg-transparent'} p-2 ml-2"
					title="Grid View"
					on:click={() => (isListView = false)}
					aria-label="Switch to grid view"
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
															src={`https://telegram.holons.io/getavatar?user_id=${participant.id}`}
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
								class="p-4 rounded-3xl transition-colors flex flex-col items-center h-full"
								style="background-color: {getRoleColor(
									role
								)}; color: white;"
								role="button"
								tabindex="0"
							>
								<!-- Date/Time at the top -->
								<div class="w-full flex justify-between items-center mb-2">
									{#if role.when}
										<span class="text-xs opacity-80 whitespace-nowrap">
											{formatDate(role.when)} @ {formatTime(
												role.when
											)}
											{#if role.ends}- {formatTime(
													role.ends
												)}{/if}
										</span>
									{:else}
										<span></span> <!-- Empty span to maintain layout if no date -->
									{/if}
									<!-- Potential placeholder for other info if needed -->
								</div>

								<!-- Participants - Centered and Big -->
								<div class="flex-grow flex items-center justify-center my-4">
									{#if role.participants?.length > 0}
										<div class="flex -space-x-4 relative group">
												{#each role.participants.slice(0, 3) as participant}
													<div class="relative">
														<img
														class="w-16 h-16 rounded-full border-2 border-gray-300"
															src={`https://telegram.holons.io/getavatar?user_id=${participant.id}`}
															alt={participant.username}
														/>
													<div class="absolute invisible group-hover:visible bg-gray-900 text-white text-xs rounded py-1 px-2 bottom-full mb-2 left-1/2 transform -translate-x-1/2 whitespace-nowrap z-10">
															{participant.username}
														</div>
													</div>
												{/each}
												{#if role.participants.length > 3}
												<div class="w-16 h-16 rounded-full bg-gray-400 flex items-center justify-center text-lg font-bold border-2 border-gray-300 relative group">
														<span>+{role.participants.length - 3}</span>
													<div class="absolute invisible group-hover:visible bg-gray-900 text-white text-xs rounded py-1 px-2 bottom-full mb-2 left-1/2 transform -translate-x-1/2 whitespace-nowrap z-10">
															{role.participants.slice(3).map((p) => p.username).join(", ")}
														</div>
													</div>
												{/if}
											</div>
									{:else}
										<div class="w-16 h-16 rounded-full bg-gray-600 flex items-center justify-center text-3xl opacity-50">
											<span>👤</span>
										</div>
									{/if}
								</div>

								<!-- Title - Below icons -->
								<div class="text-center mt-2 mb-1">
									<p class="text-lg font-bold opacity-90 truncate w-full">
										{role.title}
									</p>
								</div>

								<!-- Description - Below title, optional -->
								{#if role.description}
									<div class="text-xs opacity-70 text-center line-clamp-2 mb-2">
										{role.description}
									</div>
								{/if}
							</div>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
	<Announcements />
</div>

{#if selectedRole && isUserStoreReady}
	<ItemModal
		role={selectedRole.role}
		roleId={selectedRole.key}
		{userStore}
		{holosphere}
		holonId={activeHolonId}
		on:close={() => {
			console.log("[Roles.svelte] Closing ItemModal from on:close.");
			selectedRole = null;
		}}
		on:deleted={(event) => {
			const deletedRoleId = event.detail.roleId;
			console.log(`[Roles.svelte] Role deleted event received for ID: ${deletedRoleId}`);
			if (store[deletedRoleId]) {
				const { [deletedRoleId]: _, ...rest } = store;
				store = rest;
				console.log(`[Roles.svelte] Role ${deletedRoleId} removed from local store.`);
			}
			selectedRole = null; // Also close the modal by resetting selectedRole
		}}
	/>
{:else if selectedRole && !isUserStoreReady}
	<div class="fixed inset-0 bg-black bg-opacity-70 z-[60] flex items-center justify-center p-4" aria-live="polite" aria-busy="true">
		<div class="bg-gray-800 p-6 rounded-lg text-white flex items-center">
			<svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
				<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
				<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
			</svg>
			<span>Loading user data for modal...</span>
		</div>
	</div>
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
		bottom: -4px; /* Changed from top: -4px for tooltips above */
		left: 50%;
		transform: translateX(-50%);
		border-width: 4px 4px 0 4px; /* Arrow pointing down */
		border-style: solid;
		border-color: #1f2937 transparent transparent transparent; /* Arrow pointing down */
	}
</style>
