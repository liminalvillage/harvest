<script lang="ts">
	import { onMount, getContext } from "svelte";
	import { ID } from "../dashboard/store";
	import { page } from "$app/stores";
	import HoloSphere from "holosphere";

	interface CouncilMember {
		id: string;
		name: string;
		role: string;
		avatar?: string;
		status: 'active' | 'inactive' | 'pending';
		contribution: string;
		lastActive: string;
	}

	interface CouncilData {
		members: Record<string, CouncilMember>;
		settings: {
			quorum: number;
			votingPeriod: number;
			consensus: string;
		};
		proposals: Array<{
			id: string;
			title: string;
			description: string;
			status: string;
			created: string;
		}>;
	}

	let holosphere = getContext("holosphere") as HoloSphere;
	let holonID: string = '';
	let councilData: CouncilData = {
		members: {},
		settings: {
			quorum: 3,
			votingPeriod: 7,
			consensus: 'majority'
		},
		proposals: []
	};

	let isLoading = true;
	let connectionReady = false;
	let selectedMember: CouncilMember | null = null;
	let showMemberModal = false;
	let editingCircle: string | null = null;
	let circleInputs: Record<string, string> = {};

	let circleRadiusPercent = 8; // radius as percentage of container width/height

	interface MetatronCircle {
		id: string;
		x: number; // percentage 0-100
		y: number; // percentage 0-100
	}

	$: metatronCircles = generateMetatron(circleRadiusPercent);

	function generateMetatron(rPercent: number): MetatronCircle[] {
		const circles: MetatronCircle[] = [];
		// centre
		circles.push({ id: 'center', x: 50, y: 50 });

		// Inner ring circles (2r from center) - starting from top, clockwise
		const innerNames = ['inner-top', 'inner-top-right', 'inner-bottom-right', 'inner-bottom', 'inner-bottom-left', 'inner-top-left'];
		for (let k = 0; k < 6; k++) {
			const angleRad = (Math.PI / 3) * k - Math.PI / 2; // 60° increments, starting from top (-90° to align with screen)
			const d = 2 * rPercent;
			const x = 50 + d * Math.cos(angleRad);
			const y = 50 + d * Math.sin(angleRad);
			circles.push({ id: innerNames[k], x, y });
		}

		// Outer ring circles (4r from center) - starting from top, clockwise
		const outerNames = ['outer-top', 'outer-top-right', 'outer-bottom-right', 'outer-bottom', 'outer-bottom-left', 'outer-top-left'];
		for (let k = 0; k < 6; k++) {
			const angleRad = (Math.PI / 3) * k - Math.PI / 2; // 60° increments, starting from top (-90° to align with screen)
			const d = 4 * rPercent;
			const x = 50 + d * Math.cos(angleRad);
			const y = 50 + d * Math.sin(angleRad);
			circles.push({ id: outerNames[k], x, y });
		}
		return circles;
	}

	// Add fetchData function with retry logic
	async function fetchData(retryCount = 0) {
		if (!holonID || !holosphere || !connectionReady || holonID === 'undefined' || holonID === 'null' || holonID.trim() === '') {
			return;
		}
		
		isLoading = true;
		
		try {
			console.log(`Fetching council data for holon: ${holonID}`);
			
			// Fetch with timeout
			const fetchWithTimeout = async (promise: Promise<any>, timeoutMs: number = 5000) => {
				const timeoutPromise = new Promise((_, reject) => 
					setTimeout(() => reject(new Error('Timeout')), timeoutMs)
				);
				return Promise.race([promise, timeoutPromise]);
			};

			// Fetch council data
			const [membersData, proposalsData] = await Promise.all([
				fetchWithTimeout(holosphere.getAll(holonID, holonID), 5000),
				fetchWithTimeout(holosphere.getAll(holonID, "council_proposals"), 5000)
			]);

			// Fetch settings separately since it might not exist
			let settingsData = null;
			try {
				settingsData = await fetchWithTimeout(holosphere.get(holonID, "council_settings", holonID), 5000);
			} catch (error) {
				console.log('No council settings found, using defaults');
			}

			// Process members data
			if (Array.isArray(membersData)) {
				membersData.forEach((member: any) => {
					if (member && member.id) {
						councilData.members[member.id] = member as CouncilMember;
					}
				});
			} else if (typeof membersData === 'object' && membersData !== null) {
				Object.entries(membersData).forEach(([key, member]: [string, any]) => {
					if (member && member.id) {
						councilData.members[key] = member as CouncilMember;
					}
				});
			}

			// Process proposals data
			if (Array.isArray(proposalsData)) {
				councilData.proposals = proposalsData.filter((proposal: any) => proposal && proposal.id);
			}

			// Process settings data
			if (settingsData && typeof settingsData === 'object' && !Array.isArray(settingsData)) {
				councilData.settings = { ...councilData.settings, ...settingsData };
			}

			// Load advisor data from holosphere
			try {
				// Load advisors from single council_advisors key
				const advisorsData = await fetchWithTimeout(holosphere.get(holonID, "council_advisors", holonID), 2000);
				console.log('Loaded advisors data:', advisorsData);
				
				if (advisorsData && typeof advisorsData === 'object') {
					circleInputs = { ...circleInputs, ...advisorsData };
					console.log('Updated circle inputs:', circleInputs);
				}
			} catch (error) {
				console.error('Error loading advisor data:', error);
			}

			console.log(`Successfully fetched council data for holon ${holonID}:`, Object.keys(councilData.members).length, 'members');

			// Set up subscription after successful fetch
			await subscribeToCouncil();

		} catch (error: any) {
			console.error('Error fetching council data:', error);
			
			// Retry on network errors up to 3 times with exponential backoff
			if (retryCount < 3) {
				const delay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
				console.log(`Retrying council fetch in ${delay}ms (attempt ${retryCount + 1}/3)`);
				setTimeout(() => fetchData(retryCount + 1), delay);
				return;
			}
		} finally {
			isLoading = false;
		}
	}

	// Subscribe to council updates
	async function subscribeToCouncil() {
		if (!holosphere || !holonID) return;
		
		try {
			// Subscribe to members updates
			const membersUnsub = await holosphere.subscribe(holonID, "council_members", (newMember: any, key?: string) => {
				if (newMember && key) {
					councilData.members = { ...councilData.members, [key]: newMember };
				} else if (key) {
					const { [key]: _, ...rest } = councilData.members;
					councilData.members = rest;
				}
			});

			// Subscribe to proposals updates
			const proposalsUnsub = await holosphere.subscribe(holonID, "council_proposals", (newProposal: any, key?: string) => {
				if (newProposal && key) {
					const existingIndex = councilData.proposals.findIndex(p => p.id === key);
					if (existingIndex >= 0) {
						councilData.proposals[existingIndex] = newProposal;
					} else {
						councilData.proposals = [...councilData.proposals, newProposal];
					}
				} else if (key) {
					councilData.proposals = councilData.proposals.filter(p => p.id !== key);
				}
			});

			// Subscribe to settings updates
			const settingsUnsub = await holosphere.subscribe(holonID, "council_settings", (newSettings: any) => {
				if (newSettings && typeof newSettings === 'object' && !Array.isArray(newSettings)) {
					councilData.settings = { ...councilData.settings, ...newSettings };
				}
			});

			// Subscribe to advisors updates
			const advisorsUnsub = await holosphere.subscribe(holonID, "council_advisors", (newAdvisorsData: any) => {
				if (newAdvisorsData && typeof newAdvisorsData === 'object') {
					circleInputs = { ...circleInputs, ...newAdvisorsData };
					console.log('Real-time advisors update:', newAdvisorsData);
				}
			});

			// Return cleanup function
			return () => {
				membersUnsub.unsubscribe();
				proposalsUnsub.unsubscribe();
				settingsUnsub.unsubscribe();
				advisorsUnsub.unsubscribe();
			};
		} catch (error) {
			console.error('Error setting up council subscription:', error);
		}
	}

	// Select member for modal
	function selectMember(member: CouncilMember) {
		selectedMember = member;
		showMemberModal = true;
	}

	// Close member modal
	function closeMemberModal() {
		selectedMember = null;
		showMemberModal = false;
	}

	// Handle circle click to start editing
	function startEditingCircle(circleId: string) {
		console.log('Circle clicked:', circleId);
		editingCircle = circleId;
		if (!circleInputs[circleId]) {
			circleInputs[circleId] = '';
		}
	}

	// Handle circle input change
	function handleCircleInputChange(circleId: string, value: string) {
		circleInputs[circleId] = value;
	}

	// Utility function to create a simple hash of a string
	function hashString(str: string): string {
		let hash = 0;
		for (let i = 0; i < str.length; i++) {
			const char = str.charCodeAt(i);
			hash = ((hash << 5) - hash) + char;
			hash = hash & hash; // Convert to 32-bit integer
		}
		return Math.abs(hash).toString(36);
	}

	// Handle circle input save
	function saveCircleInput(circleId: string) {
		console.log('Saving input for circle:', circleId, 'Value:', circleInputs[circleId]);
		editingCircle = null;
		// Save to holosphere
		if (holosphere && holonID && circleInputs[circleId]) {
			// Get current advisors and update the specific position
			const currentAdvisors = { ...circleInputs };
			currentAdvisors[circleId] = circleInputs[circleId];
			
			holosphere.put(holonID, "council_advisors", currentAdvisors)
				.then(() => {
					console.log(`Saved advisor ${circleId} to holosphere:`, currentAdvisors);
				})
				.catch((error) => {
					console.error(`Error saving advisor ${circleId}:`, error);
				});
		}
	}

	// Handle circle input cancel
	function cancelCircleInput() {
		console.log('Canceling circle input');
		editingCircle = null;
	}

	// Get active members count
	$: totalMembers = Object.keys(councilData.members).length;
	$: activeMembers = Object.values(councilData.members).filter(member => member.status === 'active').length;

	// Get status color
	function getStatusColor(status: string): string {
		switch (status) {
			case 'active': return '#10b981';
			case 'inactive': return '#ef4444';
			case 'pending': return '#f59e0b';
			default: return '#6b7280';
		}
	}

	// Initialize on mount
	onMount(() => {
		// Initialize with URL parameter first
		const urlId = $page.params.id;
		if (urlId && urlId !== 'undefined' && urlId !== 'null' && urlId.trim() !== '') {
			holonID = urlId;
			// Update the ID store to keep them in sync
			ID.set(urlId);
		}

		// Wait for holosphere to be ready before proceeding
		const checkConnection = async () => {
			if (!holosphere) {
				setTimeout(checkConnection, 100);
				return;
			}
			
			// Add a small delay to ensure the connection is stable
			await new Promise(resolve => setTimeout(resolve, 200));
			connectionReady = true;
			
			// Set up subscription to ID store with debouncing
			let updateTimeout: NodeJS.Timeout;
			const idSubscription = ID.subscribe((value) => {
				if (value && value !== 'undefined' && value !== 'null' && value.trim() !== '') {
					// Clear any pending update
					if (updateTimeout) clearTimeout(updateTimeout);
					
					// Debounce the update to avoid rapid changes
					updateTimeout = setTimeout(async () => {
						if (value !== holonID) {
							holonID = value;
							await fetchData();
						}
					}, 100);
				}
			});

			// Initial fetch if we have an ID
			if (holonID && holonID !== 'undefined' && holonID !== 'null' && holonID.trim() !== '') {
				await fetchData();
			}

			return () => {
				if (idSubscription) idSubscription();
			};
		};
		
		checkConnection();
	});

	// Watch for page ID changes with debouncing
	let pageUpdateTimeout: NodeJS.Timeout;
	$: {
		const newId = $page.params.id;
		if (newId && newId !== holonID && connectionReady) {
			// Check if the new ID is valid
			if (newId !== 'undefined' && newId !== 'null' && newId.trim() !== '') {
				// Clear any pending update
				if (pageUpdateTimeout) clearTimeout(pageUpdateTimeout);
				
				// Debounce the update to avoid rapid changes
				pageUpdateTimeout = setTimeout(async () => {
					holonID = newId;
					// Update the ID store to keep them in sync
					ID.set(newId);
					if (holosphere) {
						await fetchData();
					}
				}, 100);
			}
		}
	}
</script>

<div class="space-y-8">
	<!-- Header Section -->
	<div class="bg-gradient-to-r from-gray-800 to-gray-700 py-6 px-3 sm:py-8 sm:px-8 rounded-3xl shadow-2xl">
		<div class="flex flex-col sm:flex-row justify-between items-center sm:gap-0 gap-2">
			<div class="text-center sm:text-left mb-2 sm:mb-0 flex-1 min-w-0">
				<h1 class="text-3xl sm:text-4xl font-bold text-white mb-1 sm:mb-2 truncate overflow-hidden text-ellipsis">Council</h1>
				<p class="text-gray-300 text-base sm:text-lg">Metatron Structure Governance</p>
			</div>
			<div class="text-center sm:text-right">
				<div class="text-2xl font-bold text-green-400">{activeMembers}</div>
				<div class="text-sm text-gray-400">Active Members</div>
			</div>
		</div>
	</div>

	<!-- Main Content Container -->
	<div class="flex flex-col lg:flex-row gap-6">
		<!-- Council Main Area -->
		<div class="lg:flex-1 bg-gray-800 rounded-3xl shadow-xl min-h-[600px]">
			<div class="p-6">
				{#if isLoading}
					<div class="flex items-center justify-center py-12">
						<div class="text-center">
							<div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-4 mx-auto"></div>
							<p class="text-gray-400">Loading council data...</p>
						</div>
					</div>
				{:else}
					<div class="relative">
						<!-- Interactive Metatron Structure using absolute positioning -->
						<div class="metatron-container relative w-full max-w-[600px] mx-auto aspect-square" style="--diam:{circleRadiusPercent * 2}%">
							<!-- Connecting lines -->
							<svg class="absolute inset-0 w-full h-full pointer-events-none" style="z-index: 5;">
								<!-- Lines from center to all other circles -->
								{#each metatronCircles.filter(c => c.id !== 'center') as circle}
									<line 
										x1="50%" y1="50%" 
										x2="{circle.x}%" y2="{circle.y}%" 
										stroke="#c6c6c5" 
										stroke-width="1" 
										opacity="0.6"
									/>
								{/each}
								
								<!-- Lines between all circles (except center) -->
								{#each metatronCircles.filter(c => c.id !== 'center') as circle1, i}
									{#each metatronCircles.filter(c => c.id !== 'center' && c.id !== circle1.id).slice(i) as circle2}
										<line 
											x1="{circle1.x}%" y1="{circle1.y}%" 
											x2="{circle2.x}%" y2="{circle2.y}%" 
											stroke="#c6c6c5" 
											stroke-width="0.5" 
											opacity="0.2"
										/>
									{/each}
								{/each}
							</svg>
							{#each metatronCircles as circle}
								<div
									class="metatron-circle interactive-circle"
									class:editing={editingCircle === circle.id}
									style="left:{circle.x}%; top:{circle.y}%; width:{circleRadiusPercent * 2}%; height:{circleRadiusPercent * 2}%;"
									data-circle-id={circle.id}
									on:click={() => startEditingCircle(circle.id)}
								>
									{#if circleInputs[circle.id]}
										<span class="label-text select-none">
											{circleInputs[circle.id]}
										</span>
									{/if}
								</div>
							{/each}
						</div>

						<!-- Council Members Grid -->
						<div class="absolute inset-0 flex items-center justify-center">
							<div class="grid grid-cols-3 gap-4 max-w-md">
								{#each Object.entries(councilData.members) as [id, member], index}
									<button
										class="group relative"
										on:click={() => selectMember(member)}
									>
										<!-- Member Avatar -->
										<div class="relative">
											<div class="w-16 h-16 rounded-full bg-gray-700 border-2 border-gray-600 flex items-center justify-center text-white font-bold text-lg group-hover:scale-110 transition-transform duration-200">
												{#if member.avatar}
													<img src={member.avatar} alt={member.name} class="w-full h-full rounded-full object-cover" />
												{:else}
													{member.name.charAt(0).toUpperCase()}
												{/if}
											</div>
											
											<!-- Status Indicator -->
											<div 
												class="absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-gray-800"
												style="background-color: {getStatusColor(member.status)}"
											></div>
										</div>
										
										<!-- Member Info Tooltip -->
										<div class="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
											<div class="font-bold">{member.name}</div>
											<div class="text-gray-300">{member.role}</div>
											<div class="text-gray-400">Contribution: {member.contribution}</div>
										</div>
									</button>
								{/each}
							</div>
						</div>

						<!-- Interactive Circle Input Overlay -->
						{#if editingCircle}
							<div class="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
								<div class="bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md relative border border-gray-700">
									<div class="p-6">
										<div class="flex items-center justify-between mb-6">
											<h3 class="text-white text-xl font-bold">Edit Advisor: {editingCircle}</h3>
											<button
												on:click={cancelCircleInput}
												class="text-gray-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-gray-700"
											>
												<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
												</svg>
											</button>
										</div>
										
										<div class="space-y-4">
											<div>
												<label class="block text-gray-300 text-sm font-medium mb-2">
													Enter advisor name:
												</label>
												<input
													type="text"
													bind:value={circleInputs[editingCircle]}
													placeholder="Enter advisor name..."
													class="w-full bg-gray-700 border border-gray-600 rounded-xl px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
													on:keydown={(e) => {
														if (e.key === 'Enter') {
															saveCircleInput(editingCircle);
														} else if (e.key === 'Escape') {
															cancelCircleInput();
														}
													}}
												/>
											</div>
											
											<div class="flex gap-3">
												<button
													on:click={() => saveCircleInput(editingCircle)}
													class="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-xl transition-colors"
												>
													Save
												</button>
												<button
													on:click={cancelCircleInput}
													class="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-2 px-4 rounded-xl transition-colors"
												>
													Cancel
												</button>
											</div>
										</div>
									</div>
								</div>
							</div>
						{/if}
					</div>
				{/if}
			</div>
		</div>

		<!-- Council Info Panel -->
		<div class="lg:w-80 lg:flex-shrink-0 space-y-6">
			<!-- Council Stats -->
			<div class="bg-gray-800 rounded-3xl shadow-xl p-6">
				<h3 class="text-xl font-bold text-white mb-4">Council Stats</h3>
				<div class="space-y-4">
					<div class="flex justify-between">
						<span class="text-gray-400">Total Members</span>
						<span class="text-white font-bold">{totalMembers}</span>
					</div>
					<div class="flex justify-between">
						<span class="text-gray-400">Active Members</span>
						<span class="text-green-400 font-bold">{activeMembers}</span>
					</div>
					<div class="flex justify-between">
						<span class="text-gray-400">Quorum Required</span>
						<span class="text-white font-bold">{councilData.settings.quorum}</span>
					</div>
					<div class="flex justify-between">
						<span class="text-gray-400">Consensus</span>
						<span class="text-white font-bold capitalize">{councilData.settings.consensus}</span>
					</div>
					<div class="flex justify-between">
						<span class="text-gray-400">Voting Period</span>
						<span class="text-white font-bold">{councilData.settings.votingPeriod} days</span>
					</div>
				</div>
			</div>

			<!-- Recent Activity -->
			<div class="bg-gray-800 rounded-3xl shadow-xl p-6">
				<h3 class="text-xl font-bold text-white mb-4">Recent Proposals</h3>
				<div class="space-y-3">
					{#each councilData.proposals.slice(0, 3) as proposal}
						<div class="bg-gray-700 rounded-xl p-3">
							<div class="flex justify-between items-start mb-2">
								<h4 class="text-white font-medium text-sm">{proposal.title}</h4>
								<span class="text-xs px-2 py-1 rounded-full {proposal.status === 'active' ? 'bg-green-500/20 text-green-400' : proposal.status === 'completed' ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-500/20 text-gray-400'}">
									{proposal.status}
								</span>
							</div>
							<p class="text-gray-400 text-xs line-clamp-2">{proposal.description}</p>
						</div>
					{:else}
						<p class="text-gray-400 text-sm">No proposals yet</p>
					{/each}
				</div>
			</div>

			<!-- Quick Actions -->
			<div class="bg-gray-800 rounded-3xl shadow-xl p-6">
				<h3 class="text-xl font-bold text-white mb-4">Quick Actions</h3>
				<div class="space-y-3">
					<button class="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-xl transition-colors">
						Add Member
					</button>
					<button class="w-full bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-xl transition-colors">
						Create Proposal
					</button>
					<button class="w-full bg-gray-600 hover:bg-gray-700 text-white py-2 px-4 rounded-xl transition-colors">
						View All Proposals
					</button>
				</div>
			</div>
		</div>
	</div>
</div>

<!-- Member Detail Modal -->
{#if showMemberModal && selectedMember}
	<div class="fixed inset-0 z-50 overflow-auto bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
		<div class="bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md relative border border-gray-700">
			<div class="p-6">
				<div class="flex items-center justify-between mb-6">
					<h3 class="text-white text-xl font-bold">Member Details</h3>
					<button
						on:click={closeMemberModal}
						class="text-gray-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-gray-700"
					>
						<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
						</svg>
					</button>
				</div>
				
				<div class="space-y-4">
					<div class="flex items-center gap-4">
						<div class="w-16 h-16 rounded-full bg-gray-700 border-2 border-gray-600 flex items-center justify-center text-white font-bold text-xl">
							{#if selectedMember.avatar}
								<img src={selectedMember.avatar} alt={selectedMember.name} class="w-full h-full rounded-full object-cover" />
							{:else}
								{selectedMember.name.charAt(0).toUpperCase()}
							{/if}
						</div>
						<div>
							<h4 class="text-white font-bold text-lg">{selectedMember.name}</h4>
							<p class="text-gray-400">{selectedMember.role}</p>
						</div>
					</div>
					
					<div class="space-y-2">
						<div class="flex justify-between">
							<span class="text-gray-400">Status</span>
							<span class="text-white font-medium capitalize">{selectedMember.status}</span>
						</div>
						<div class="flex justify-between">
							<span class="text-gray-400">Contribution</span>
							<span class="text-white font-medium">{selectedMember.contribution}</span>
						</div>
						<div class="flex justify-between">
							<span class="text-gray-400">Last Active</span>
							<span class="text-white font-medium">{selectedMember.lastActive}</span>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	.line-clamp-2 {
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.metatron-container {
		position: relative;
		width: 100%;
		height: 100%;
	}

	.metatron-circle {
		position: absolute;
		width: var(--diam);
		height: var(--diam);
		border-radius: 50%;
		background: rgba(198, 198, 197, 0.3);
		transition: all 0.3s ease;
		cursor: pointer;
		transform: translate(-50%, -50%);
		pointer-events: auto;
		z-index: 20;
		border: 2px solid rgba(255, 255, 255, 0.2);
	}

	.metatron-circle:hover {
		background: rgba(198, 198, 197, 0.5);
		border-color: rgba(255, 255, 255, 0.4);
		box-shadow: 0 0 20px rgba(255, 255, 255, 0.3);
	}

	@keyframes pulse {
		0% {
			opacity: 0.8;
		}
		50% {
			opacity: 0.4;
		}
		100% {
			opacity: 0;
		}
	}

	.metatron-circle:hover::before {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.3);
		animation: pulse 1.5s ease-out infinite;
		pointer-events: none;
	}

	.metatron-circle.editing {
		background: rgba(59, 130, 246, 0.6);
		border-color: rgba(59, 130, 246, 0.8);
		box-shadow: 0 0 15px rgba(59, 130, 246, 0.5);
	}

	/* Center circle */
	.center-circle {
		left: 50%;
		top: 50%;
	}

	/* Inner ring circles - vertical */
	.inner-circle.top {
		left: 50%;
		top: 28.6%;
	}

	.inner-circle.top-inner {
		left: 50%;
		top: 39.3%;
	}

	.inner-circle.bottom-inner {
		left: 50%;
		top: 60.7%;
	}

	.inner-circle.bottom {
		left: 50%;
		top: 71.4%;
	}

	/* Inner ring circles - horizontal */
	.inner-circle.top-left {
		left: 31.5%;
		top: 39.3%;
	}

	.inner-circle.top-left-inner {
		left: 40.8%;
		top: 44.7%;
	}

	.inner-circle.top-right-inner {
		left: 59.2%;
		top: 44.7%;
	}

	.inner-circle.top-right {
		left: 68.5%;
		top: 39.3%;
	}

	.inner-circle.bottom-left {
		left: 31.5%;
		top: 60.7%;
	}

	.inner-circle.bottom-left-inner {
		left: 40.8%;
		top: 55.3%;
	}

	.inner-circle.bottom-right-inner {
		left: 59.2%;
		top: 55.3%;
	}

	.inner-circle.bottom-right {
		left: 68.5%;
		top: 60.7%;
	}

	/* Outer ring circles - vertical */
	.outer-circle.top {
		left: 50%;
		top: 18.0%;
	}

	.outer-circle.top-outer {
		left: 50%;
		top: 7.3%;
	}

	.outer-circle.bottom {
		left: 50%;
		top: 82.0%;
	}

	.outer-circle.bottom-outer {
		left: 50%;
		top: 92.7%;
	}

	/* Outer ring circles - corners */
	.outer-circle.top-left {
		left: 22.3%;
		top: 34.0%;
	}

	.outer-circle.top-left-outer {
		left: 13.0%;
		top: 28.6%;
	}

	.outer-circle.top-right {
		left: 77.7%;
		top: 34.0%;
	}

	.outer-circle.top-right-outer {
		left: 87.0%;
		top: 28.6%;
	}

	.outer-circle.bottom-left {
		left: 22.3%;
		top: 66.0%;
	}

	.outer-circle.bottom-left-outer {
		left: 13.0%;
		top: 71.4%;
	}

	.outer-circle.bottom-right {
		left: 77.7%;
		top: 66.0%;
	}

	.outer-circle.bottom-right-outer {
		left: 87.0%;
		top: 71.4%;
	}

	.label-text {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		color: #ffffff;
		font-size: clamp(0.5rem, 2vw, 0.75rem);
		text-align: center;
		pointer-events: none;
		white-space: normal;
		word-wrap: break-word;
		max-width: 80%;
		max-height: 80%;
		overflow: hidden;
		line-height: 1.2;
	}
</style> 