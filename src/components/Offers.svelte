<script lang="ts">
	// @ts-nocheck

	import { onMount, getContext } from "svelte";
	import { ID } from "../dashboard/store";

	import HoloSphere from "holosphere";
	import Announcements from "./Announcements.svelte";

	/**
	 * @type {string | any[]}
	 */
	let store = {};
	$: holonID = $ID;

	$: offers = Object.values(store).filter((item) => item.type === "offer");
	$: needs = Object.values(store).filter((item) => item.type === "request");

	let holosphere = getContext("holosphere") as HoloSphere;

	onMount(() => {
		ID.subscribe((value) => {
			holonID = value;
			subscribeToOffersAndNeeds();
		});
	});

	// Subscribe to changes in the specified holon
	async function subscribeToOffersAndNeeds() {
		store = {};
		if (holosphere)
			holosphere.subscribe(holonID, "quests", (newItem, key) => {
				if (newItem) {
					const parsedItem = newItem;
					parsedItem.key = key; // Add the key to the parsed item object
					store[key] = parsedItem;
				} else {
					// A key may contain a null value (if data has been deleted/set to null)
					// if so, we remove the item from the store
					delete store[key];
				}
				store = store; // Trigger reactivity
			});
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

	// Function to get item background color
	function getItemBackgroundColor(itemType) {
		if (itemType === 'offer') {
			return 'hsl(160, 60%, 80%)'; // Minty Green for offers
		} else if (itemType === 'request') {
			return '#E5E7EB';  // Tailwind gray-200 for requests
		}
		return 'hsl(210, 15%, 75%)'; // Default gray
	}

	// New function to generate table HTML
	function generateTableHtml(items, caption, personHeader, itemHeader) {
		const itemCards = items
			.map(
				(item) => {
					const backgroundColor = getItemBackgroundColor(item.type);
					// Ensure text colors provide good contrast with the new backgrounds
					// Titles are currently text-white, details text-gray-300.
					// These should be fine, but for very light HSL backgrounds, darker text might be needed.
					// The chosen HSL values (L=80%) should be light enough for dark text to be more readable.
					// Let's adjust text color for better readability on these lighter backgrounds.
					const textColor = "text-gray-800"; // Darker text for better contrast
					const subTextColor = "text-gray-600";

					return `
				<div 
					class="p-4 rounded-lg mb-3 shadow hover:shadow-md transition-shadow duration-200"
					style="background-color: ${backgroundColor};"
				>
					<div class="flex items-center">
						<div class="flex-shrink-0 mr-3">
							${item.initiator?.id ? `
								<img
									class="w-10 h-10 rounded-full border-2 border-gray-400" 
									src="https://gun.holons.io/getavatar?user_id=${item.initiator.id}"
									alt="${item.initiator?.first_name || "User"}'s avatar"
								/>
							` : `
								<div class="w-10 h-10 rounded-full bg-gray-500 flex items-center justify-center text-white text-xl font-bold border-2 border-gray-400">
									?
								</div>
							`}
						</div>
						<div class="flex-grow">
							<h4 class="text-md font-semibold ${textColor}">${item.title}</h4>
							<p class="text-sm ${subTextColor}">
								${personHeader}: ${item.initiator?.first_name || "N/A"} ${item.initiator?.last_name || ""}
							</p>
						</div>
					</div>
				</div>
			`;
				}
			)
			.join("");

		return `
			<div>
				<h3 class="text-xl font-bold mb-4 text-white">${caption}</h3>
				${itemCards.length > 0 ? itemCards : `<p class="text-gray-400">No items to display.</p>`}
			</div>
		`;
	}
</script>

<div class="flex flex-wrap">
	<div class="w-full lg:w-8/12 bg-gray-800 py-6 px-6 rounded-3xl">
		<div class="flex justify-between text-white items-center mb-8">
			<p class="text-2xl font-bold">Offers &amp; Requests</p>
			<p class="">{new Date().toDateString()}</p>
		</div>

		<div class="flex flex-wrap justify-between items-center pb-8">
			<div class="flex flex-wrap text-white">
				<div class="pr-10">
					<div class="text-2xl font-bold">
						{offers.length + needs.length}
					</div>
					<div class="">Total</div>
				</div>
				<div>
					<div class="text-2xl font-bold">
						{offers.length +
							needs.length -
							offers
								.concat(needs)
								.filter((item) => item.participants?.length > 0)
								.length}
					</div>
					<div class="">Unassigned</div>
				</div>
			</div>

			<div class="flex items-center mt-4 md:mt-0">
				<button 
					class="text-white bg-transparent" 
					title="List View"
					aria-label="Switch to list view">
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
					class="text-white bg-gray-700 p-2 ml-2"
					title="Grid View"
					aria-label="Switch to grid view">
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

		<div class="mb-8">
			<div class="bg-gray-900 rounded-lg p-4">
				{#if offers.length > 0}
					{@html generateTableHtml(
						offers,
						"Active Offers",
						"Offered by",
						"Offer"
					)}
				{:else}
					<p class="text-gray-400">No active offers at the moment.</p>
				{/if}
			</div>
		</div>

		<div class="mb-8">
			<div class="bg-gray-900 rounded-lg p-4">
				{#if needs.length > 0}
					{@html generateTableHtml(
						needs,
						"Active Requests",
						"Requested by",
						"Request"
					)}
				{:else}
					<p class="text-gray-400">
						No active requests at the moment.
					</p>
				{/if}
			</div>
		</div>
	</div>
	<Announcements />
</div>
