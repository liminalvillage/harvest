<script>
	// @ts-nocheck
	import { onMount, getContext } from 'svelte';
	import { ID } from '../dashboard/store';
	
	import TreeView from './TreeView.svelte';
	import HoloSphere from 'holosphere';
	import Announcements from './Announcements.svelte';


	let holosphere = getContext('holosphere') || new HoloSphere('Holons');

	onMount(() => {
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
					store[key] = JSON.parse(tag);
				} else {
					delete store[key];
					store = store;
				}
			});
	}

	// Function to handle tag selection
	function handleTagClick(tagName) {
		// Handle tag click - could navigate to a tag-specific view
		console.log('Selected tag:', tagName);
		// Example: navigate to tag view
		// goto(`/tags/${tagName}`);
	}

	// Function to check if text contains a URL
	function extractUrl(text) {
		const urlRegex = /(https?:\/\/[^\s]+)/g;
		const match = text.match(urlRegex);
		return match ? match[0] : null;
	}

	// Function to handle content item clicks
	function handleContentClick(content, event) {
		const url = extractUrl(content.messageContent);
		if (url) {
			window.open(url, '_blank');
		} else if (content.link) {
			window.open(content.link, '_blank');
		} else if (content.url) {
			window.open(content.url, '_blank');
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

		<!-- New tag grid display -->
		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
			{#each tags as [tagName, tagData]}
				<div class="bg-gray-700 p-4 rounded-lg">
					<button 
						class="text-white font-bold mb-2 hover:text-blue-400 cursor-pointer transition-colors w-full text-left"
						on:click={() => handleTagClick(tagName)}
					>
						{tagName}
					</button>
					<div class="space-y-2">
						{#each tagData.content as content}
							<a 
								href={extractUrl(content.messageContent) || content.url || content.link || '#'} 
								class="block text-gray-300 text-sm bg-gray-800 p-2 rounded hover:bg-gray-600 transition-colors {extractUrl(content.messageContent) ? 'text-blue-400 hover:text-blue-300' : ''}"
								on:click|preventDefault={(e) => handleContentClick(content, e)}
							>
								{content.messageContent}
							</a>
						{/each}
					</div>
				</div>
			{/each}
		</div>

		<!-- Keep TreeView as an alternative view if needed -->
		<!-- <div class="flex flex-wrap">
			<TreeView {tree} />
		</div> -->
	</div>
	<Announcements />
</div>
