<script context="module" lang="ts">
	export interface TreeItem {
		name: string;
		children?: TreeItem[];

		// To allow custom keys
		[key: string]: any;
	}

	export type TreeData = TreeItem[];
</script>

<script>
	// @ts-nocheck
	import TreeView from './TreeView.svelte';
	import HoloSphere from 'holosphere';
	import Announcements from './Announcements.svelte';
	import { ID } from '../dashboard/store';
	import { onMount } from 'svelte';

	let holosphere;

	onMount(() => {
		holosphere = new HoloSphere('Holons');
		subscribeToTags();
	});

	let tree = {
		label: 'Tags',
		children: [
		]
	};


	/**
	 * @type {string | any[]}
	 */
	let store = {};
	$: holonID = $ID;

	ID.subscribe((value) => {
		holonID = value;
		subscribeToTags();
	});

	$: tags = Object.entries(store);

	// Suscribe to changes in the specified holon
	async function subscribeToTags() {
		store = {};
		if (holosphere)
			holosphere.subscribe(holonID, 'tags', (tag, key) => {
				if (tag) {
					// Updates the store with the new value
					store[key] = JSON.parse(tag);
				} else {
					// A key may contain a null value (if data has been deleted/set to null)
					// if so, we remove the item from the store
					delete store[key];
					store = store;
				}
			});

			for (const [key, tag] of Object.entries(store)) {
				 let children = [];
				for (const content of tag.content) {
					let child = {};
					child.label=  content.messageContent
					children.push(child)
				}
		
				tree.children.push({
					label: key,
					children: children
				});
			}
			
	}

</script>


<div class="flex flex-wrap">
	<div class="w-full lg:w-8/12 bg-gray-800 py-6 px-6 rounded-3xl">
		<div class="flex justify-between text-white items-center mb-8">
			<p class="text-2xl font-bold">Knowledge Base</p>
			<p class="">{new Date().toDateString()}</p>
		</div>

		<div class="flex flex-wrap justify-between items-center pb-8">
			<div class="flex flex-wrap text-white">
				<div class="pr-10">
					<div class="text-2xl font-bold">{tags.length}</div>
					<div class="">Tags</div>
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
			<TreeView {tree} />
		</div>
	</div>
	<Announcements />
</div>
