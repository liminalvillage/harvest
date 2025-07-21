<script lang="ts">
	// @ts-nocheck
	import { onMount, getContext } from "svelte";
	import { ID } from "../dashboard/store";

	import TreeView from "./TreeView.svelte";
	import HoloSphere from "holosphere";

	let holosphere = getContext("holosphere") as HoloSphere;

	onMount(() => {
		ID.subscribe((value) => {
			holonID = value;
			subscribeToTags();
		});
	});

	let tree = {
		label: "Tags",
		children: [],
	};

	/**
	 * @type {string | any[]}
	 */
	let store = {};
	$: holonID = $ID;
	$: tags = Object.entries(store);
	$: totalContent = tags.reduce((acc, [_, tagData]) => acc + (tagData.content?.length || 0), 0);

	let viewMode = 'grid'; // 'grid' or 'list'

	// Suscribe to changes in the specified holon
	async function subscribeToTags() {
		store = {};
		if (holosphere)
			holosphere.subscribe(holonID, "tags", (tag, key) => {
				if (tag) {
					store[key] = tag;
				} else {
					delete store[key];
					store = store;
				}
			});
	}

	// Function to handle tag selection
	function handleTagClick(tagName) {
		// Handle tag click - could navigate to a tag-specific view
		console.log("Selected tag:", tagName);
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
		event.preventDefault();
		const url = extractUrl(content.messageContent) || content.link || content.url;
		if (url) {
			window.open(url, "_blank");
		}
	}

	// Function to check if content is a link
	function isLink(content) {
		return extractUrl(content.messageContent) || content.link || content.url;
	}

	// Function to truncate text if needed
	function truncateText(text, maxLength = 150) {
		if (text.length <= maxLength) return text;
		return text.substring(0, maxLength) + '...';
	}
</script>

<div class="space-y-8">
	<!-- Header Section -->
	<div class="bg-gradient-to-r from-gray-800 to-gray-700 py-8 px-8 rounded-3xl shadow-2xl">
		<div class="flex flex-col md:flex-row justify-between items-center">
			<div class="text-center md:text-left mb-4 md:mb-0">
				<h1 class="text-4xl font-bold text-white mb-2">Knowledge Base</h1>
				<p class="text-gray-300 text-lg">{new Date().toDateString()}</p>
			</div>
			<div class="flex items-center gap-3">
				<button 
					class="p-2 rounded-lg transition-colors {viewMode === 'list' ? 'bg-gray-600 text-white' : 'bg-transparent text-gray-400 hover:text-white'}"
					on:click={() => viewMode = 'list'}
					title="List View"
					aria-label="Switch to list view"
				>
					<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/>
					</svg>
				</button>
				<button
					class="p-2 rounded-lg transition-colors {viewMode === 'grid' ? 'bg-gray-600 text-white' : 'bg-transparent text-gray-400 hover:text-white'}"
					on:click={() => viewMode = 'grid'}
					title="Grid View"
					aria-label="Switch to grid view"
				>
					<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"/>
					</svg>
				</button>
			</div>
		</div>
	</div>

	<!-- Main Content Container -->
	<div class="bg-gray-800 rounded-3xl shadow-xl min-h-[600px]">
		<div class="p-8">
			<!-- Stats Section -->
			<div class="grid grid-cols-2 gap-4 mb-8">
				<div class="bg-gray-700/50 rounded-2xl p-4 text-center">
					<div class="text-2xl font-bold text-white mb-1">{tags.length}</div>
					<div class="text-sm text-gray-400">Tags</div>
				</div>
				<div class="bg-gray-700/50 rounded-2xl p-4 text-center">
					<div class="text-2xl font-bold text-white mb-1">{totalContent}</div>
					<div class="text-sm text-gray-400">Total Items</div>
				</div>
			</div>

			<!-- Tags Content -->
			{#if viewMode === 'grid'}
				<!-- Grid View -->
				<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
					{#each tags as [tagName, tagData]}
						<div class="bg-gray-700/30 rounded-2xl p-6 border border-gray-600/50 hover:border-gray-500/50 transition-all duration-200">
							<div class="mb-4">
								<button
									class="text-xl font-bold text-white hover:text-blue-400 cursor-pointer transition-colors w-full text-left flex items-center gap-2"
									on:click={() => handleTagClick(tagName)}
								>
									<span class="text-blue-400">#</span>
									<span class="truncate">{tagName}</span>
								</button>
								<div class="text-sm text-gray-400 mt-1">
									{tagData.content?.length || 0} items
								</div>
							</div>
							
							<div class="space-y-3 max-h-64 overflow-y-auto">
								{#each (tagData.content || []) as content}
									{#if isLink(content)}
										<a
											href={extractUrl(content.messageContent) || content.url || content.link}
											target="_blank"
											rel="noopener noreferrer"
											class="block text-blue-400 hover:text-blue-300 text-sm bg-gray-800/50 p-3 rounded-lg hover:bg-gray-600/50 transition-all duration-200 border border-transparent hover:border-blue-500/30"
											on:click={(e) => handleContentClick(content, e)}
										>
											<div class="break-words whitespace-pre-wrap">
												{truncateText(content.messageContent)}
											</div>
											{#if content.messageContent.length > 150}
												<div class="text-xs text-gray-500 mt-1">Click to read more...</div>
											{/if}
										</a>
									{:else}
										<div class="text-gray-300 text-sm bg-gray-800/30 p-3 rounded-lg border border-gray-600/30">
											<div class="break-words whitespace-pre-wrap">
												{content.messageContent}
											</div>
										</div>
									{/if}
								{/each}
								
								{#if !tagData.content || tagData.content.length === 0}
									<div class="text-center py-4 text-gray-500 text-sm">
										No content available
									</div>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			{:else}
				<!-- List View -->
				<div class="space-y-4">
					{#each tags as [tagName, tagData]}
						<div class="bg-gray-700/30 rounded-xl p-6 border border-gray-600/50 hover:border-gray-500/50 transition-all duration-200">
							<div class="flex items-center justify-between mb-4">
								<button
									class="text-xl font-bold text-white hover:text-blue-400 cursor-pointer transition-colors flex items-center gap-2"
									on:click={() => handleTagClick(tagName)}
								>
									<span class="text-blue-400">#</span>
									<span>{tagName}</span>
								</button>
								<div class="text-sm text-gray-400">
									{tagData.content?.length || 0} items
								</div>
							</div>
							
							<div class="grid grid-cols-1 md:grid-cols-2 gap-3">
								{#each (tagData.content || []) as content}
									{#if isLink(content)}
										<a
											href={extractUrl(content.messageContent) || content.url || content.link}
											target="_blank"
											rel="noopener noreferrer"
											class="block text-blue-400 hover:text-blue-300 text-sm bg-gray-800/50 p-3 rounded-lg hover:bg-gray-600/50 transition-all duration-200 border border-transparent hover:border-blue-500/30"
											on:click={(e) => handleContentClick(content, e)}
										>
											<div class="break-words whitespace-pre-wrap">
												{truncateText(content.messageContent)}
											</div>
											{#if content.messageContent.length > 150}
												<div class="text-xs text-gray-500 mt-1">Click to read more...</div>
											{/if}
										</a>
									{:else}
										<div class="text-gray-300 text-sm bg-gray-800/30 p-3 rounded-lg border border-gray-600/30">
											<div class="break-words whitespace-pre-wrap">
												{content.messageContent}
											</div>
										</div>
									{/if}
								{/each}
								
								{#if !tagData.content || tagData.content.length === 0}
									<div class="col-span-full text-center py-4 text-gray-500 text-sm">
										No content available
									</div>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			{/if}

			{#if tags.length === 0}
				<div class="text-center py-12">
					<div class="w-16 h-16 mx-auto mb-4 bg-gray-700 rounded-full flex items-center justify-center">
						<svg class="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"/>
						</svg>
					</div>
					<h3 class="text-lg font-medium text-white mb-2">No tags found</h3>
					<p class="text-gray-400">Tags will appear here once content is tagged</p>
				</div>
			{/if}
		</div>
	</div>
</div>
