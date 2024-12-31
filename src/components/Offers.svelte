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

	// New function to generate table HTML
	function generateTableHtml(items, caption, personHeader, itemHeader) {
		const rows = items
			.map(
				(item) => `
			<tr>
				<td>${item.initiator?.first_name || ""}</td>
				<td>${item.title}</td>
			</tr>
		`
			)
			.join("");

		return `
			<table class="w-full text-left border-collapse">
				<caption class="text-lg font-bold mb-2">${caption}</caption>
				<thead>
					<tr>
						<th class="py-2 px-4 bg-gray-700 text-white">${personHeader}</th>
						<th class="py-2 px-4 bg-gray-700 text-white">${itemHeader}</th>
					</tr>
				</thead>
				<tbody>
					${rows}
				</tbody>
			</table>
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
			<div class="bg-white rounded-lg p-4">
				{#if offers.length > 0}
					{@html generateTableHtml(
						offers,
						"Active Offers",
						"Person",
						"Offer"
					)}
				{:else}
					<p class="text-gray-600">No active offers at the moment.</p>
				{/if}
			</div>
		</div>

		<div class="mb-8">
			<div class="bg-white rounded-lg p-4">
				{#if needs.length > 0}
					{@html generateTableHtml(
						needs,
						"Active Requests",
						"Person",
						"Request"
					)}
				{:else}
					<p class="text-gray-600">
						No active requests at the moment.
					</p>
				{/if}
			</div>
		</div>
	</div>
	<Announcements />
</div>
