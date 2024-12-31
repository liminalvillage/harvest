<script lang="ts">
	import { onMount, getContext } from "svelte";
	import { ID } from "../dashboard/store";
	import HoloSphere from "holosphere";

	let store = {};
	let selectedTable = "quests";
	let tables = ["quests", "roles", "offers", "announcements", "events","settings","profile"];
	let expandedFields = new Set();
	let editingField = null;
	let editValue = "";

	$: holonID = $ID;
	$: entries = Object.entries(store);

	let holosphere = getContext("holosphere") as HoloSphere;

	onMount(() => {
		ID.subscribe((value) => {
			holonID = value;
			subscribeToTable(selectedTable);
		});
	});

	async function subscribeToTable(tableName) {
		store = {};
		if (holosphere) {
			console.log(holonID, tableName);
			holosphere.subscribe(holonID, tableName, (newData, key) => {
				if (newData) {
					store[key] = newData;
				} else {
					delete store[key];
					store = store;
				}
			});
		}
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

	async function deleteEntry(key) {
		if (!key || !holonID || !selectedTable) {
			console.error("Cannot delete: missing parameters", {
				key,
				holonID,
				selectedTable,
			});
			return;
		}

		if (confirm("Are you sure you want to delete this entry?")) {
			try {
				await holosphere.delete(holonID, selectedTable, key);

				delete store[key];
				store = { ...store };
			} catch (error) {
				console.error("Error deleting entry:", error);
			}
		}
	}

	async function startEditing(key, field, value) {
		editingField = `${key}.${field}`;
		editValue =
			typeof value === "object"
				? JSON.stringify(value, null, 2)
				: String(value);
	}

	async function saveEdit(key, field) {
		try {
			const entry = store[key];
			let parsedValue = editValue;

			const updatedEntry = { ...entry, [field]: parsedValue };
			await holosphere.put(holonID, selectedTable, updatedEntry);
			editingField = null;
		} catch (error) {
			console.error("Error saving edit:", error);
		}
	}

	function cancelEdit() {
		editingField = null;
		editValue = "";
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
						<div
							class="p-4 rounded-3xl bg-gray-700 text-white hover:bg-gray-600 transition-colors"
						>
							<div
								class="text-sm opacity-70 mb-2 flex justify-between"
							>
								<span>ID: {key}</span>
								<div class="flex gap-2">
									{#if data.status}
										<span
											class="px-2 py-0.5 rounded-full text-xs"
											style="background-color: {data.status ===
											'open'
												? '#4CAF50'
												: data.status === 'in_progress'
												? '#2196F3'
												: data.status === 'completed'
												? '#9C27B0'
												: '#757575'}"
										>
											{data.status}
										</span>
									{/if}
									<button
										class="text-red-400 hover:text-red-300"
										on:click={() => deleteEntry(key)}
									>
										<svg
											class="w-4 h-4"
											fill="none"
											stroke="currentColor"
											viewBox="0 0 24 24"
										>
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
											/>
										</svg>
									</button>
								</div>
							</div>

							{#if typeof data === "object"}
								{#each Object.entries(data) as [field, value]}
									<div
										class="mb-2 hover:bg-gray-500 p-1 rounded"
									>
										<div
											class="flex justify-between items-start"
										>
											<span class="font-bold"
												>{field}:</span
											>
											<button
												class="text-blue-400 hover:text-blue-300 ml-2"
												on:click={() =>
													startEditing(
														key,
														field,
														value
													)}
											>
												<svg
													class="w-4 h-4"
													fill="none"
													stroke="currentColor"
													viewBox="0 0 24 24"
												>
													<path
														stroke-linecap="round"
														stroke-linejoin="round"
														stroke-width="2"
														d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
													/>
												</svg>
											</button>
										</div>

										{#if editingField === `${key}.${field}`}
											<div class="mt-2">
												<textarea
													class="w-full bg-gray-800 text-white p-2 rounded"
													rows={typeof value ===
													"object"
														? 5
														: 1}
													bind:value={editValue}
												/>
												<div
													class="flex justify-end gap-2 mt-2"
												>
													<button
														class="px-2 py-1 bg-green-600 rounded hover:bg-green-700"
														on:click={() =>
															saveEdit(
																key,
																field
															)}
													>
														Save
													</button>
													<button
														class="px-2 py-1 bg-gray-600 rounded hover:bg-gray-700"
														on:click={cancelEdit}
													>
														Cancel
													</button>
												</div>
											</div>
										{:else if typeof value === "object" && value !== null}
											<div class="pl-4 mt-1">
												{#if expandedFields.has(`${key}.${field}`)}
													<div class="pl-4">
														<pre
															class="whitespace-pre-wrap">{JSON.stringify(
																value,
																null,
																2
															)}</pre>
													</div>
												{:else}
													<span
														class="text-gray-400 cursor-pointer"
														on:click={() =>
															toggleField(
																`${key}.${field}`
															)}
													>
														{Array.isArray(value)
															? `[${value.length} items]`
															: "{...}"}
													</span>
												{/if}
											</div>
										{:else}
											<span class="pl-4">{value}</span>
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

	textarea {
		font-family: monospace;
	}
</style>
