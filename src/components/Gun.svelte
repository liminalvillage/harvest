<script>
	// @ts-nocheck
	import { onMount, getContext } from 'svelte';
	import { ID } from '../dashboard/store.ts';
	import HoloSphere from 'holosphere';

	let store = {};
	let selectedTable = 'quests';
	let tables = ['quests', 'roles', 'offers', 'announcements', 'events'];
	let expandedFields = new Set();
	
	$: holonID = $ID;
	$: entries = Object.entries(store);
	
	let holosphere = getContext('holosphere') || new HoloSphere('Holons');

	onMount(() => {
		subscribeToTable(selectedTable);
	});

	ID.subscribe((value) => {
		holonID = value;
		subscribeToTable(selectedTable);
	});

	async function subscribeToTable(tableName) {
		store = {};
		if (holosphere)
			holosphere.subscribe(holonID, tableName, (newData, key) => {
				if (newData) {
					store[key] = typeof newData === 'string' ? JSON.parse(newData) : newData;
				} else {
					delete store[key];
					store = store;
				}
			});
	}

	function handleTableChange(table) {
		selectedTable = table;
		subscribeToTable(table);
		expandedFields.clear();
	}

	function toggleField(fieldPath) {
		if (expandedFields.has(fieldPath)) {
			expandedFields.delete(fieldPath);
		} else {
			expandedFields.add(fieldPath);
		}
		expandedFields = expandedFields; // Trigger reactivity
	}
</script>

<div class="flex flex-wrap">
	<div class="w-full lg:w-10/12 bg-gray-800 py-6 px-6 rounded-3xl">
		<div class="flex justify-between text-white items-center mb-8">
			<div class="flex items-center gap-4">
				<p class="text-2xl font-bold">Database Explorer</p>
				<select 
					class="bg-gray-700 text-white rounded-md px-2 py-1"
					bind:value={selectedTable}
					on:change={() => handleTableChange(selectedTable)}
				>
					{#each tables as table}
						<option value={table}>{table}</option>
					{/each}
				</select>
			</div>
			<p class="">{new Date().toDateString()}</p>
		</div>

		<div class="flex flex-wrap justify-between items-center pb-8">
			<div class="flex flex-wrap text-white">
				<div class="pr-10">
					<div class="text-2xl font-bold">{entries.length}</div>
					<div class="">Records</div>
				</div>
			</div>
		</div>
		
		<div class="flex flex-wrap">
			{#each entries as [key, data]}
				<div id={key} class="w-full md:w-6/12 lg:w-4/12">
					<div class="p-2">
						<div class="p-4 rounded-3xl bg-gray-700 text-white hover:bg-gray-600 transition-colors">
							<div class="text-sm opacity-70 mb-2 flex justify-between">
								<span>ID: {key}</span>
								{#if data.status}
									<span class="px-2 py-0.5 rounded-full text-xs" 
										style="background-color: {
											data.status === 'open' ? '#4CAF50' : 
											data.status === 'in_progress' ? '#2196F3' : 
											data.status === 'completed' ? '#9C27B0' : '#757575'
										}"
									>
										{data.status}
									</span>
								{/if}
							</div>
							
							{#if typeof data === 'object'}
								{#each Object.entries(data) as [field, value]}
									<div 
										class="mb-2 hover:bg-gray-500 p-1 rounded cursor-pointer"
										on:click={() => toggleField(`${key}.${field}`)}
									>
										<span class="font-bold">{field}:</span>
										
										{#if typeof value === 'object' && value !== null}
											{#if expandedFields.has(`${key}.${field}`)}
												<div class="pl-4">
													{#if Array.isArray(value)}
														{#each value as item, i}
															<div class="border-l border-gray-500 pl-2">
																{typeof item === 'object' ? JSON.stringify(item, null, 2) : item}
															</div>
														{/each}
													{:else}
														{#each Object.entries(value) as [k, v]}
															<div class="border-l border-gray-500 pl-2">
																<span class="font-bold">{k}:</span> 
																{typeof v === 'object' ? JSON.stringify(v, null, 2) : v}
															</div>
														{/each}
													{/if}
												</div>
											{:else}
												<span class="text-gray-400">
													{Array.isArray(value) ? `[${value.length} items]` : '{...}'}
												</span>
											{/if}
										{:else}
											<span>{value}</span>
										{/if}
									</div>
								{/each}
							{:else}
								<div>{JSON.stringify(data)}</div>
							{/if}
						</div>
					</div>
				</div>
			{/each}
		</div>
	</div>
</div>

<style>
	.hover\:bg-gray-500:hover {
		background-color: rgba(107, 114, 128, 0.3);
	}
</style>
