<script lang="ts">
	import { onMount, getContext } from "svelte";
	import { ID } from "../dashboard/store";
	import HoloSphere from "holosphere";

	let store: Record<string, any> = {};
	let selectedTable = "quests";
	let tables = [
		{ value: "quests", label: "Tasks" },
		{ value: "needs", label: "Local Needs" },
		{ value: "offers", label: "Offers" },
		{ value: "communities", label: "Communities" },
		{ value: "organizations", label: "Organizations" },
		{ value: "events", label: "Events" },
		{ value: "users", label: "People" },
		{ value: "settings", label: "Settings" },
		{ value: "expenses", label: "Expenses" },
		{ value: "profile", label: "Profile" }
	];
	let expandedFields = new Set();
	let editingField: string | null = null;
	let editValue = "";
	let newFieldName = "";
	let addingFieldTo: string | null = null;
	let isArrayEditing = false;
	let arrayEditIndex: number | null = null;
	let isAddingNewEntry = false;
	let newEntryJson = "{\n  \n}";
	let newEntryKey = "";
	let showTableInfo = false;

	$: holonID = $ID;
	$: entries = Object.entries(store);

	let holosphere = getContext("holosphere") as HoloSphere;

	onMount(() => {
		ID.subscribe((value) => {
			holonID = value;
			subscribeToTable(selectedTable);
		});
	});

	async function subscribeToTable(tableName: string) {
		store = {};
		if (holosphere) {
			console.log(holonID, tableName);
			holosphere.subscribe(holonID, tableName, (newData: any, key: string) => {
				if (newData) {
					store[key] = newData;
				} else {
					delete store[key];
					store = store;
				}
			});
		}
	}

	function handleTableChange(table: string) {
		selectedTable = table;
		subscribeToTable(table);
		expandedFields.clear();
	}

	function toggleField(fieldPath: string) {
		if (expandedFields.has(fieldPath)) {
			expandedFields.delete(fieldPath);
		} else {
			expandedFields.add(fieldPath);
		}
		expandedFields = expandedFields; // Trigger reactivity
	}

	async function deleteEntry(key: string) {
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

	async function startEditing(key: string, field: string, value: any, index?: number) {
		editingField = `${key}.${field}`;
		isArrayEditing = Array.isArray(value);
		arrayEditIndex = typeof index === 'number' ? index : null;
		
		if (isArrayEditing && typeof index === 'number') {
			editValue = typeof value[index] === 'object' 
				? JSON.stringify(value[index], null, 2) 
				: String(value[index]);
		} else {
			editValue = typeof value === "object" 
				? JSON.stringify(value, null, 2) 
				: String(value);
		}
	}

	function inferType(value: string): any {
		// If it's empty, return empty string
		if (value.trim() === "") return "";

		// Try parsing as number first
		const num = Number(value);
		if (!isNaN(num) && value.trim() !== "") return num;

		// Check for boolean
		if (value.toLowerCase() === "true") return true;
		if (value.toLowerCase() === "false") return false;

		// Try parsing as JSON
		try {
			if (value.trim().startsWith('{') || value.trim().startsWith('[')) {
				return JSON.parse(value);
			}
		} catch (e) {
			// If parsing fails, fall through to string
		}

		// Default to string
		return value;
	}

	async function saveEdit(key: string, field: string) {
		try {
			const entry = store[key];
			let parsedValue: any;

			if (isArrayEditing && arrayEditIndex !== null) {
				// Handle array element editing
				const currentArray = [...entry[field]];
				parsedValue = inferType(editValue);
				currentArray[arrayEditIndex] = parsedValue;
				const updatedEntry = { ...entry, [field]: currentArray };
				await holosphere.put(holonID, selectedTable, updatedEntry);
			} else {
				// Handle regular field editing
				parsedValue = inferType(editValue);
				const updatedEntry = { ...entry, [field]: parsedValue };
				await holosphere.put(holonID, selectedTable, updatedEntry);
			}

			editingField = null;
			isArrayEditing = false;
			arrayEditIndex = null;
		} catch (error) {
			console.error("Error saving edit:", error);
		}
	}

	function cancelEdit() {
		editingField = null;
		editValue = "";
		addingFieldTo = null;
		newFieldName = "";
	}

	async function addNewField(key: string) {
		if (!newFieldName.trim()) {
			alert("Please enter a field name");
			return;
		}

		try {
			const entry = store[key];
			const parsedValue = inferType(editValue);
			const updatedEntry = { ...entry, [newFieldName]: parsedValue };
			await holosphere.put(holonID, selectedTable, updatedEntry);
			cancelEdit();
		} catch (error) {
			console.error("Error adding new field:", error);
		}
	}

	async function addArrayItem(key: string, field: string, currentArray: any[]) {
		try {
			const entry = store[key];
			const newArray = [...currentArray, null];
			const updatedEntry = { ...entry, [field]: newArray };
			await holosphere.put(holonID, selectedTable, updatedEntry);
			startEditing(key, field, newArray, newArray.length - 1);
		} catch (error) {
			console.error("Error adding array item:", error);
		}
	}

	async function removeArrayItem(key: string, field: string, index: number, currentArray: any[]) {
		if (confirm("Are you sure you want to remove this item?")) {
			try {
				const entry = store[key];
				const newArray = [...currentArray];
				newArray.splice(index, 1);
				const updatedEntry = { ...entry, [field]: newArray };
				await holosphere.put(holonID, selectedTable, updatedEntry);
			} catch (error) {
				console.error("Error removing array item:", error);
			}
		}
	}

	function exportTableData() {
		const dataStr = JSON.stringify(store, null, 2);
		const dataBlob = new Blob([dataStr], { type: 'application/json' });
		const url = URL.createObjectURL(dataBlob);
		const link = document.createElement('a');
		link.href = url;
		link.download = `${selectedTable}_${new Date().toISOString().split('T')[0]}.json`;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		URL.revokeObjectURL(url);
	}

	function exportEntry(key: string, data: any) {
		const dataStr = JSON.stringify(data, null, 2);
		const dataBlob = new Blob([dataStr], { type: 'application/json' });
		const url = URL.createObjectURL(dataBlob);
		const link = document.createElement('a');
		link.href = url;
		link.download = `${selectedTable}_${key}_${new Date().toISOString().split('T')[0]}.json`;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		URL.revokeObjectURL(url);
	}

	async function addNewEntry() {
		if (!newEntryKey.trim()) {
			alert("Please enter an ID for the new entry");
			return;
		}

		try {
			const parsedData = JSON.parse(newEntryJson);
			await holosphere.put(holonID, selectedTable, parsedData);
			isAddingNewEntry = false;
			newEntryJson = "{\n  \n}";
			newEntryKey = "";
		} catch (error) {
			alert("Invalid JSON format");
			console.error("Error adding new entry:", error);
		}
	}
</script>

<div class="flex flex-wrap">
	<div class="w-full lg:w-10/12 bg-gray-800 py-6 px-6 rounded-3xl">
		<div class="flex justify-between text-white items-center mb-8">
			<div class="flex items-center gap-4">
				<p class="text-2xl font-bold">Database Explorer</p>
				<div class="lens-control">
					<label for="table-select" class="lens-label">Table:</label>
					<select
						id="table-select"
						class="lens-select"
						bind:value={selectedTable}
						on:change={() => handleTableChange(selectedTable)}
						aria-label="Select table type"
					>
						{#each tables as table}
							<option value={table.value}>{table.label}</option>
						{/each}
					</select>
					<button 
						class="info-button" 
						aria-label="Table information"
						on:mouseenter={() => showTableInfo = true}
						on:mouseleave={() => showTableInfo = false}
					>
						<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4">
							<path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clip-rule="evenodd" />
						</svg>
					</button>
					
					{#if showTableInfo}
						<div class="info-tooltip">
							<p>Tables store different types of data in the database:</p>
							<ul>
								<li><strong>Tasks:</strong> Active tasks and quests</li>
								<li><strong>Local Needs:</strong> Community needs and requests</li>
								<li><strong>Offers:</strong> Available resources and services</li>
								<li><strong>Communities:</strong> Active local groups</li>
								<li><strong>Organizations:</strong> Registered organizations</li>
								<li><strong>Events:</strong> Scheduled activities</li>
								<li><strong>People:</strong> User profiles and accounts</li>
								<li><strong>Settings:</strong> System configuration</li>
								<li><strong>Expenses:</strong> Financial records</li>
								<li><strong>Profile:</strong> Personal information</li>
							</ul>
						</div>
					{/if}
				</div>
				<button
					class="bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded-md flex items-center gap-2"
					on:click={exportTableData}
				>
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
					</svg>
					Export JSON
				</button>
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
			<button
				class="bg-green-600 hover:bg-green-700 px-3 py-1 rounded-md flex items-center gap-2 text-white"
				on:click={() => isAddingNewEntry = true}
			>
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
				</svg>
				New Entry
			</button>
		</div>

		{#if isAddingNewEntry}
			<div class="mb-8 p-4 bg-gray-700 rounded-xl text-white">
				<div class="flex justify-between items-center mb-4">
					<h3 class="text-lg font-semibold">Add New Entry</h3>
					<button
						class="text-gray-400 hover:text-gray-300"
						on:click={() => {
							isAddingNewEntry = false;
							newEntryJson = "{\n  \n}";
							newEntryKey = "";
						}}
					>
						<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				</div>
				<div class="mb-4">
					<label class="block mb-2">Entry ID:</label>
					<input
						type="text"
						class="w-full bg-gray-800 text-white p-2 rounded"
						placeholder="Enter unique ID"
						bind:value={newEntryKey}
					/>
				</div>
				<div class="mb-4">
					<label class="block mb-2">JSON Data:</label>
					<textarea
						class="w-full bg-gray-800 text-white p-2 rounded font-mono"
						rows="10"
						bind:value={newEntryJson}
						placeholder="Enter JSON data"
					/>
				</div>
				<div class="flex justify-end gap-2">
					<button
						class="px-4 py-2 bg-green-600 rounded hover:bg-green-700"
						on:click={addNewEntry}
					>
						Create
					</button>
					<button
						class="px-4 py-2 bg-gray-600 rounded hover:bg-gray-700"
						on:click={() => {
							isAddingNewEntry = false;
							newEntryJson = "{\n  \n}";
							newEntryKey = "";
						}}
					>
						Cancel
					</button>
				</div>
			</div>
		{/if}

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
										class="text-blue-400 hover:text-blue-300"
										on:click={() => exportEntry(key, data)}
										title="Export entry"
									>
										<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
										</svg>
									</button>
									<button
										class="text-red-400 hover:text-red-300"
										on:click={() => deleteEntry(key)}
										title="Delete entry"
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
													rows={typeof value === "object" ? 5 : 1}
													bind:value={editValue}
												/>
												<div class="flex justify-end gap-2 mt-2">
													<button
														class="px-2 py-1 bg-green-600 rounded hover:bg-green-700"
														on:click={() => saveEdit(key, field)}
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
														{#if Array.isArray(value)}
															<div class="space-y-2">
																{#each value as item, index}
																	<div class="flex items-start gap-2">
																		<span class="text-gray-400">{index}:</span>
																		<div class="flex-1">
																			<pre class="whitespace-pre-wrap">{JSON.stringify(item, null, 2)}</pre>
																		</div>
																		<div class="flex gap-1">
																			<button
																				class="text-blue-400 hover:text-blue-300"
																				on:click={() => startEditing(key, field, value, index)}
																			>
																				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
																					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
																				</svg>
																			</button>
																			<button
																				class="text-red-400 hover:text-red-300"
																				on:click={() => removeArrayItem(key, field, index, value)}
																			>
																				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
																					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
																				</svg>
																			</button>
																		</div>
																	</div>
																{/each}
																<button
																	class="mt-2 px-3 py-1 bg-blue-600 rounded hover:bg-blue-700 w-full text-left"
																	on:click={() => addArrayItem(key, field, value)}
																>
																	+ Add Item
																</button>
															</div>
														{:else}
															<pre class="whitespace-pre-wrap">{JSON.stringify(value, null, 2)}</pre>
														{/if}
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
								{#if addingFieldTo === key}
									<div class="mt-4 p-2 bg-gray-600 rounded">
										<div class="flex gap-2 mb-2">
											<input
												type="text"
												class="flex-1 bg-gray-800 text-white p-2 rounded"
												placeholder="Field name"
												bind:value={newFieldName}
											/>
										</div>
										<textarea
											class="w-full bg-gray-800 text-white p-2 rounded mb-2"
											rows="1"
											placeholder="Field value"
											bind:value={editValue}
										/>
										<div class="flex justify-end gap-2">
											<button
												class="px-2 py-1 bg-green-600 rounded hover:bg-green-700"
												on:click={() => addNewField(key)}
											>
												Add
											</button>
											<button
												class="px-2 py-1 bg-gray-600 rounded hover:bg-gray-700"
												on:click={cancelEdit}
											>
												Cancel
											</button>
										</div>
									</div>
								{:else}
									<button
										class="mt-2 px-3 py-1 bg-blue-600 rounded hover:bg-blue-700 w-full text-left"
										on:click={() => {
											addingFieldTo = key;
											editValue = "";
											newFieldName = "";
										}}
									>
										+ Add Field
									</button>
								{/if}
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

	.lens-control {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 0 8px;
		min-height: 36px;
		background: white;
		border-radius: 4px;
		box-shadow: 0 0 0 2px rgba(0,0,0,0.1);
		white-space: nowrap;
	}

	.lens-label {
		color: #333;
		font-weight: 500;
		font-size: 14px;
		white-space: nowrap;
	}

	.lens-select {
		appearance: none;
		background: transparent;
		color: #333;
		border: none;
		padding: 4px 24px 4px 8px;
		font-size: 14px;
		cursor: pointer;
		min-width: 120px;
	}

	.info-button {
		background: none;
		border: none;
		padding: 4px;
		color: #666;
		cursor: pointer;
		transition: color 0.2s;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.info-button:hover {
		color: #333;
	}

	.info-tooltip {
		position: absolute;
		top: calc(100% + 8px);
		left: 0;
		background: white;
		border-radius: 4px;
		box-shadow: 0 2px 8px rgba(0,0,0,0.15);
		padding: 12px;
		width: 280px;
		font-size: 13px;
		color: #333;
		z-index: 1000;
	}

	.info-tooltip::before {
		content: '';
		position: absolute;
		top: -6px;
		left: 50%;
		width: 12px;
		height: 12px;
		background: white;
		transform: rotate(45deg) translateX(-50%);
		box-shadow: -2px -2px 4px rgba(0,0,0,0.05);
	}

	.info-tooltip p {
		margin: 0 0 8px 0;
	}

	.info-tooltip ul {
		margin: 0;
		padding-left: 16px;
	}

	.info-tooltip li {
		margin: 4px 0;
	}

	.info-tooltip strong {
		color: #000;
	}
</style>
