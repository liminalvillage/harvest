<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';

	const dispatch = createEventDispatcher();

	interface Quest {
		id: string;
		title: string;
		description?: string;
		date?: string;
		when?: string;
		status: 'ongoing' | 'completed' | 'recurring' | 'repeating';
		category?: string;
		participants: Array<{ 
			id: string; 
			username: string;
			firstName?: string;
			lastName?: string;
		}>;
		appreciation: string[];
		location?: string;
		ends?: string;
		type?: 'task' | 'quest' | 'event' | 'proposal' | 'recurring';
		orderIndex?: number;
		position?: { x: number; y: number };
		dependsOn?: string[];
		initiator?: {
			id: string;
			username: string;
			firstName?: string;
			lastName?: string;
		};
		created?: string;
		_meta?: {
			resolvedFromHologram?: boolean;
			hologramSoul?: string;
		};
	}

	// Props
	export let quests: [string, Quest][];
	export let holonId: string;

	// State
	let selectedFields: string[] = [];
	let csvPreview: string = '';
	let filename: string = '';
	let isLoading = false;

	// Available fields for export
	const availableFields = [
		{ key: 'id', label: 'ID', description: 'Unique quest identifier' },
		{ key: 'title', label: 'Title', description: 'Quest title' },
		{ key: 'description', label: 'Description', description: 'Quest description' },
		{ key: 'status', label: 'Status', description: 'Current status (ongoing, completed, etc.)' },
		{ key: 'type', label: 'Type', description: 'Quest type (task, quest, event, etc.)' },
		{ key: 'category', label: 'Category', description: 'Quest category' },
		{ key: 'created', label: 'Created Date', description: 'When the quest was created' },
		{ key: 'when', label: 'Scheduled When', description: 'Scheduled date/time' },
		{ key: 'ends', label: 'Ends', description: 'End date/time' },
		{ key: 'location', label: 'Location', description: 'Quest location' },
		{ key: 'participants', label: 'Participants', description: 'Assigned participants' },
		{ key: 'initiator', label: 'Initiator', description: 'Who created the quest' },
		{ key: 'appreciation', label: 'Appreciation Count', description: 'Number of appreciations' },
		{ key: 'dependencies', label: 'Dependencies', description: 'Quest dependencies' },
		{ key: 'orderIndex', label: 'Order Index', description: 'Display order' },
		{ key: 'positionX', label: 'Position X', description: 'Canvas X position' },
		{ key: 'positionY', label: 'Position Y', description: 'Canvas Y position' },
		{ key: 'isHologram', label: 'Is Hologram', description: 'Whether quest is from another holon' },
		{ key: 'hologramSource', label: 'Hologram Source', description: 'Source holon for hologram quests' }
	];

	// Initialize with all fields selected by default
	onMount(() => {
		selectedFields = availableFields.map(field => field.key);
		generateFilename();
		generatePreview();
	});

	// Generate filename based on current date and holon
	function generateFilename() {
		const today = new Date().toISOString().split('T')[0];
		filename = `holon_${holonId}_quests_${today}.csv`;
	}

	// Generate CSV preview
	function generatePreview() {
		if (quests.length === 0) {
			csvPreview = 'No quests to export';
			return;
		}

		const headers = selectedFields.map(fieldKey => {
			const field = availableFields.find(f => f.key === fieldKey);
			return field ? field.label : fieldKey;
		});

		const rows = quests.slice(0, 5).map(([key, quest]) => {
			return selectedFields.map(fieldKey => {
				return formatFieldValue(quest, fieldKey);
			});
		});

		const csvContent = [headers, ...rows].map(row => 
			row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(',')
		).join('\n');

		csvPreview = csvContent + (quests.length > 5 ? `\n... and ${quests.length - 5} more quests` : '');
	}

	// Format field value for CSV
	function formatFieldValue(quest: Quest, fieldKey: string): string {
		switch (fieldKey) {
			case 'id':
				return quest.id || '';
			case 'title':
				return quest.title || '';
			case 'description':
				return quest.description || '';
			case 'status':
				return quest.status || '';
			case 'type':
				return quest.type || 'task';
			case 'category':
				return quest.category || '';
			case 'created':
				return quest.created ? new Date(quest.created).toLocaleDateString() : '';
			case 'when':
				return quest.when || '';
			case 'ends':
				return quest.ends || '';
			case 'location':
				return quest.location || '';
			case 'participants':
				// Option A: Separate columns for multiple participants
				if (quest.participants && quest.participants.length > 0) {
					return quest.participants.map(p => p.firstName || p.username).join('; ');
				}
				return '';
			case 'initiator':
				return quest.initiator ? `${quest.initiator.firstName || quest.initiator.username}` : '';
			case 'appreciation':
				return quest.appreciation ? quest.appreciation.length.toString() : '0';
			case 'dependencies':
				// Option A: Quest titles separated by semicolons
				if (quest.dependsOn && quest.dependsOn.length > 0) {
					// We'll need to resolve these from the quest store, but for now return IDs
					return quest.dependsOn.join('; ');
				}
				return '';
			case 'orderIndex':
				return quest.orderIndex?.toString() || '';
			case 'positionX':
				return quest.position?.x?.toString() || '';
			case 'positionY':
				return quest.position?.y?.toString() || '';
			case 'isHologram':
				return quest._meta?.resolvedFromHologram ? 'Yes' : 'No';
			case 'hologramSource':
				return quest._meta?.hologramSoul || '';
			default:
				return '';
		}
	}

	// Toggle field selection
	function toggleField(fieldKey: string) {
		if (selectedFields.includes(fieldKey)) {
			selectedFields = selectedFields.filter(f => f !== fieldKey);
		} else {
			selectedFields = [...selectedFields, fieldKey];
		}
		generatePreview();
	}

	// Select all fields
	function selectAllFields() {
		selectedFields = availableFields.map(field => field.key);
		generatePreview();
	}

	// Clear all fields
	function clearAllFields() {
		selectedFields = [];
		generatePreview();
	}

	// Generate and download CSV
	function downloadCSV() {
		if (selectedFields.length === 0) {
			alert('Please select at least one field to export');
			return;
		}

		isLoading = true;

		try {
			const headers = selectedFields.map(fieldKey => {
				const field = availableFields.find(f => f.key === fieldKey);
				return field ? field.label : fieldKey;
			});

			const rows = quests.map(([key, quest]) => {
				return selectedFields.map(fieldKey => {
					return formatFieldValue(quest, fieldKey);
				});
			});

			const csvContent = [headers, ...rows].map(row => 
				row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(',')
			).join('\n');

			// Add BOM for Excel compatibility
			const BOM = '\uFEFF';
			const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
			
			const link = document.createElement('a');
			link.href = URL.createObjectURL(blob);
			link.download = filename;
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
			URL.revokeObjectURL(link.href);

			// Close modal after successful download
			dispatch('close');
		} catch (error) {
			console.error('Error generating CSV:', error);
			alert('Error generating CSV file. Please try again.');
		} finally {
			isLoading = false;
		}
	}

	// Close modal
	function closeModal() {
		dispatch('close');
	}

	// Keyboard shortcuts
	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			closeModal();
		}
	}
</script>

<div 
	class="fixed inset-0 z-50 overflow-auto bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
	on:click|self={closeModal}
	on:keydown={handleKeydown}
	role="dialog"
	aria-modal="true"
	tabindex="-1"
>
	<div 
		class="bg-gray-800 rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden border border-gray-700 flex flex-col"
		aria-labelledby="quest-export-title"
	>
		<!-- Header -->
		<div class="p-6 border-b border-gray-700">
			<div class="flex items-center justify-between">
				<h3 id="quest-export-title" class="text-white text-2xl font-bold">Export Quests to CSV</h3>
				<button
					on:click={closeModal}
					class="text-gray-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-gray-700"
					aria-label="Close export modal"
				>
					<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
					</svg>
				</button>
			</div>
			<p class="text-gray-400 mt-2">Export {quests.length} quest{quests.length !== 1 ? 's' : ''} to CSV format</p>
		</div>

		<!-- Content -->
		<div class="p-6 overflow-y-auto flex-1 modal-content">
			<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
				<!-- Field Selection -->
				<div class="space-y-4">
					<div class="flex items-center justify-between">
						<h4 class="text-white font-medium text-lg">Select Fields to Export</h4>
						<div class="flex gap-2">
							<button
								on:click={selectAllFields}
								class="px-3 py-1.5 bg-gray-600 hover:bg-gray-500 text-white rounded-lg text-sm transition-colors"
							>
								Select All
							</button>
							<button
								on:click={clearAllFields}
								class="px-3 py-1.5 bg-gray-600 hover:bg-gray-500 text-white rounded-lg text-sm transition-colors"
							>
								Clear All
							</button>
						</div>
					</div>
					
					<div class="space-y-2 max-h-96 overflow-y-auto">
						{#each availableFields as field}
							<label class="flex items-start gap-3 p-3 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors cursor-pointer">
								<input
									type="checkbox"
									checked={selectedFields.includes(field.key)}
									on:change={() => toggleField(field.key)}
									class="w-4 h-4 text-green-600 bg-gray-600 border-gray-500 rounded focus:ring-green-500 focus:ring-2 mt-0.5"
								/>
								<div class="flex-1 min-w-0">
									<p class="text-white font-medium">{field.label}</p>
									<p class="text-gray-400 text-sm">{field.description}</p>
								</div>
							</label>
						{/each}
					</div>
				</div>

				<!-- Preview -->
				<div class="space-y-4">
					<div class="flex items-center justify-between">
						<h4 class="text-white font-medium text-lg">CSV Preview</h4>
						<div class="text-gray-400 text-sm">
							{selectedFields.length} field{selectedFields.length !== 1 ? 's' : ''} selected
						</div>
					</div>
					
					<div class="bg-gray-700 rounded-lg p-4">
						<div class="bg-gray-600 rounded p-3 max-h-80 overflow-auto">
							<pre class="text-gray-300 text-sm whitespace-pre-wrap font-mono">{csvPreview}</pre>
						</div>
					</div>

					<!-- File Info -->
					<div class="bg-gray-700 rounded-lg p-4">
						<h5 class="text-white font-medium mb-2">Export Details</h5>
						<div class="space-y-1 text-sm text-gray-400">
							<p><strong>Filename:</strong> {filename}</p>
							<p><strong>Format:</strong> CSV (UTF-8 with BOM)</p>
							<p><strong>Compatible with:</strong> Excel, Google Sheets, Numbers</p>
							<p><strong>Quests:</strong> {quests.length} quest{quests.length !== 1 ? 's' : ''}</p>
						</div>
					</div>
				</div>
			</div>
		</div>

		<!-- Footer -->
		<div class="p-6 border-t border-gray-700 bg-gray-800/50 flex-shrink-0">
			<div class="flex justify-end gap-3">
				<button
					on:click={closeModal}
					class="px-6 py-2.5 text-sm font-medium rounded-xl bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white transition-colors"
				>
					Cancel
				</button>
				<button
					on:click={downloadCSV}
					class="px-6 py-2.5 text-sm font-medium rounded-xl bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg"
					disabled={selectedFields.length === 0 || isLoading}
				>
					{isLoading ? 'Generating...' : `Download CSV (${quests.length} quest${quests.length !== 1 ? 's' : ''})`}
				</button>
			</div>
		</div>
	</div>
</div>

<style>
	/* Custom scrollbar for webkit browsers */
	::-webkit-scrollbar {
		width: 6px;
	}
	
	::-webkit-scrollbar-track {
		background: #374151;
		border-radius: 3px;
	}
	
	::-webkit-scrollbar-thumb {
		background: #6B7280;
		border-radius: 3px;
	}
	
	::-webkit-scrollbar-thumb:hover {
		background: #9CA3AF;
	}

	/* Modal scrollbar styling */
	.modal-content::-webkit-scrollbar {
		width: 8px;
	}
	
	.modal-content::-webkit-scrollbar-track {
		background: #374151;
		border-radius: 4px;
	}
	
	.modal-content::-webkit-scrollbar-thumb {
		background: #6B7280;
		border-radius: 4px;
	}
	
	.modal-content::-webkit-scrollbar-thumb:hover {
		background: #9CA3AF;
	}
</style>
