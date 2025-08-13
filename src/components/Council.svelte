<script lang="ts">
	import { onMount, onDestroy, getContext } from "svelte";
	import { ID } from "../dashboard/store";
	import { page } from "$app/stores";
	import type HoloSphere from "holosphere";

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

	// Shared constants for Metatron circle IDs (self-similar positions reused across the component)
	const INNER_POSITIONS = ['inner-top', 'inner-top-right', 'inner-bottom-right', 'inner-bottom', 'inner-bottom-left', 'inner-top-left'] as const;
	const OUTER_POSITIONS = ['outer-top', 'outer-top-right', 'outer-bottom-right', 'outer-bottom', 'outer-bottom-left', 'outer-top-left'] as const;

	// Minimal type guards
	function isRecord(value: unknown): value is Record<string, unknown> {
		return !!value && typeof value === 'object' && !Array.isArray(value);
	}
	function hasId(value: unknown): value is { id: string } {
		return isRecord(value) && typeof value.id === 'string';
	}
	function isStringRecord(value: unknown): value is Record<string, string> {
		return isRecord(value) && Object.values(value).every(v => typeof v === 'string');
	}

	// Shared helper: fetch with timeout
	async function fetchWithTimeout<T>(promise: Promise<T>, timeoutMs: number = 5000): Promise<T> {
		const timeoutPromise = new Promise<never>((_, reject) =>
			setTimeout(() => reject(new Error('Timeout')), timeoutMs)
		);
		return Promise.race([promise, timeoutPromise]) as Promise<T>;
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

	// Track unsubscribers to clean up on destroy
	let councilUnsubscribe: (() => void) | undefined;
	let idStoreUnsubscribe: (() => void) | undefined;

	// Ritual state management
	let showRitual = false;
	let ritualStage = 0; // 0-5 for the 6 stages
	let ritualSession = {
		session_id: '',
		initiator: { name: '', intention: '' },
		declared_values: [] as string[],
		advisors: [] as Array<{
			name: string;
			type: 'real' | 'mythic' | 'archetype';
			lens: string;
			avatar_url?: string;
		}>,
		wish_statement: '',
		council_dialogue: [] as Array<{
			advisor: string;
			response: string;
		}>,
		design_streams: [] as Array<{
			name: string;
			description: string;
			materials: string[];
			steps: string[];
		}>,
		ritual_artifact: {
			format: 'scroll',
			text: '',
			quotes: {} as Record<string, string>,
			ascii_glyph: ''
		}
	};
	
	let currentValue = '';
	let currentAdvisorName = '';
	let currentAdvisorLens = '';
	let selectedAdvisorType: 'real' | 'mythic' | 'archetype' = 'real';
	let isGeneratingCouncil = false;
	let isGeneratingDesign = false;

	// History tracking for previously entered values and advisors
	let previousValues: string[] = [];
	let previousAdvisors: Array<{
		name: string;
		type: 'real' | 'mythic' | 'archetype';
		lens: string;
	}> = [];

	// Previous rituals tracking
	let previousRituals: Array<{
		id: string;
		title: string;
		date: string;
		artifact: any;
		design_streams: any[];
	}> = [];

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
		for (let k = 0; k < INNER_POSITIONS.length; k++) {
			const angleRad = (Math.PI / 3) * k - Math.PI / 2; // 60° increments, starting from top (-90° to align with screen)
			const d = 2 * rPercent;
			const x = 50 + d * Math.cos(angleRad);
			const y = 50 + d * Math.sin(angleRad);
			circles.push({ id: INNER_POSITIONS[k], x, y });
		}

		// Outer ring circles (4r from center) - starting from top, clockwise
		for (let k = 0; k < OUTER_POSITIONS.length; k++) {
			const angleRad = (Math.PI / 3) * k - Math.PI / 2; // 60° increments, starting from top (-90° to align with screen)
			const d = 4 * rPercent;
			const x = 50 + d * Math.cos(angleRad);
			const y = 50 + d * Math.sin(angleRad);
			circles.push({ id: OUTER_POSITIONS[k], x, y });
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
			
			// Fetch council data
			const [membersData, proposalsData]: [unknown, unknown] = await Promise.all([
				fetchWithTimeout(holosphere.getAll(holonID, holonID), 5000),
				fetchWithTimeout(holosphere.getAll(holonID, "council_proposals"), 5000)
			]);

			// Fetch settings separately since it might not exist
			let settingsData: unknown = null;
			try {
				settingsData = await fetchWithTimeout(holosphere.get(holonID, "council_settings", holonID), 5000);
			} catch (error) {
				console.log('No council settings found, using defaults');
			}

			// Process members data
			if (Array.isArray(membersData)) {
				(membersData as unknown[]).forEach((member) => {
					if (hasId(member)) {
						councilData.members[member.id] = member as CouncilMember;
					}
				});
			} else if (isRecord(membersData)) {
				Object.entries(membersData).forEach(([key, member]) => {
					if (hasId(member)) {
						councilData.members[key] = member as CouncilMember;
					}
				});
			}

			// Process proposals data
			if (Array.isArray(proposalsData)) {
				councilData.proposals = (proposalsData as unknown[]).filter((proposal): proposal is { id: string } => hasId(proposal)) as any;
			}

			// Process settings data
			if (isRecord(settingsData)) {
				councilData.settings = { ...councilData.settings, ...(settingsData as Partial<CouncilData['settings']>) };
			}

			// Load advisor data from holosphere
			try {
				// Load advisors from single council_advisors key
				const advisorsData = await fetchWithTimeout(holosphere.get(holonID, "council_advisors", holonID), 2000);
				console.log('Loaded advisors data:', advisorsData);
				
				if (isStringRecord(advisorsData)) {
					circleInputs = { ...circleInputs, ...advisorsData };
					console.log('Updated circle inputs:', circleInputs);
				}
			} catch (error) {
				console.error('Error loading advisor data:', error);
			}

			// Load history data from holosphere
			await loadHistoryData();
			await loadPreviousRituals(); // Load previous rituals

			console.log(`Successfully fetched council data for holon ${holonID}:`, Object.keys(councilData.members).length, 'members');

			// Re-subscribe: clean up old then subscribe anew
			if (councilUnsubscribe) {
				try { councilUnsubscribe(); } catch {}
			}
			councilUnsubscribe = await subscribeToCouncil();

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
			const membersUnsub = await holosphere.subscribe(holonID, "council_members", (newMember: unknown, key?: string) => {
				if (key && isRecord(newMember)) {
					councilData.members = { ...councilData.members, [key]: newMember as CouncilMember };
				} else if (key) {
					const { [key]: _, ...rest } = councilData.members;
					councilData.members = rest;
				}
			});

			// Subscribe to proposals updates
			const proposalsUnsub = await holosphere.subscribe(holonID, "council_proposals", (newProposal: unknown, key?: string) => {
				if (key && isRecord(newProposal)) {
					const existingIndex = councilData.proposals.findIndex(p => p.id === key);
					if (existingIndex >= 0) {
						councilData.proposals[existingIndex] = newProposal as any;
					} else {
						councilData.proposals = [...councilData.proposals, newProposal as any];
					}
				} else if (key) {
					councilData.proposals = councilData.proposals.filter(p => p.id !== key);
				}
			});

			// Subscribe to settings updates
			const settingsUnsub = await holosphere.subscribe(holonID, "council_settings", (newSettings: unknown) => {
				if (isRecord(newSettings)) {
					councilData.settings = { ...councilData.settings, ...(newSettings as Partial<CouncilData['settings']>) };
				}
			});

			// Subscribe to advisors updates
			const advisorsUnsub = await holosphere.subscribe(holonID, "council_advisors", (newAdvisorsData: unknown) => {
				if (isStringRecord(newAdvisorsData)) {
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

	// Ritual functions
	function startRitual() {
		showRitual = true;
		ritualStage = 0;
		ritualSession.session_id = `ritual-${Date.now()}`;
		console.log('Starting ritual:', ritualSession.session_id);
	}

	function nextStage() {
		if (ritualStage < 5) {
			ritualStage++;
			if (ritualStage === 3) {
				// When moving to council dialogue, start populating metatron
				populateMetatronFromRitual();
			}
		}
	}

	function prevStage() {
		if (ritualStage > 0) {
			ritualStage--;
		}
	}

	function addValue() {
		if (currentValue.trim() && ritualSession.declared_values.length < 5) {
			ritualSession.declared_values = [...ritualSession.declared_values, currentValue.trim()];
			// Add to history if not already present
			if (!previousValues.includes(currentValue.trim())) {
				previousValues = [...previousValues, currentValue.trim()];
			}
			currentValue = '';
			saveHistoryData();
		}
	}

	function removeValue(index: number) {
		ritualSession.declared_values = ritualSession.declared_values.filter((_, i) => i !== index);
	}

	function addAdvisor() {
		if (currentAdvisorName.trim() && currentAdvisorLens.trim() && ritualSession.advisors.length < 5) {
			const newAdvisor = {
				name: currentAdvisorName.trim(),
				type: selectedAdvisorType,
				lens: currentAdvisorLens.trim()
			};
			ritualSession.advisors = [...ritualSession.advisors, newAdvisor];
			
			// Add to history if not already present
			const advisorExists = previousAdvisors.some(advisor => 
				advisor.name === newAdvisor.name && advisor.lens === newAdvisor.lens
			);
			if (!advisorExists) {
				previousAdvisors = [...previousAdvisors, newAdvisor];
			}
			
			currentAdvisorName = '';
			currentAdvisorLens = '';
			saveHistoryData();
		}
	}

	function removeAdvisor(index: number) {
		ritualSession.advisors = ritualSession.advisors.filter((_, i) => i !== index);
	}

	function populateMetatronFromRitual() {
		// Populate metatron circles with ritual data
		const newInputs: Record<string, string> = {};
		
		// Center: The wish
		newInputs['center'] = ritualSession.wish_statement.substring(0, 20) + '...';
		
		// Inner ring: Values
		ritualSession.declared_values.forEach((value, index) => {
			if (index < INNER_POSITIONS.length) {
				newInputs[INNER_POSITIONS[index]] = value;
			}
		});
		
		// Outer ring: Advisors
		ritualSession.advisors.forEach((advisor, index) => {
			if (index < OUTER_POSITIONS.length) {
				newInputs[OUTER_POSITIONS[index]] = advisor.name;
			}
		});
		
		circleInputs = { ...circleInputs, ...newInputs };
		
		// Save to holosphere
		if (holosphere && holonID) {
			holosphere.put(holonID, "council_advisors", circleInputs);
		}
	}

	async function generateCouncilDialogue() {
		isGeneratingCouncil = true;
		
		try {
			// Simulate AI generation (replace with actual AI API call)
			await new Promise(resolve => setTimeout(resolve, 2000));
			
			ritualSession.council_dialogue = ritualSession.advisors.map(advisor => {
				return {
					advisor: advisor.name,
					response: generateAdvisorResponse({ type: advisor.type }, ritualSession.wish_statement, ritualSession.declared_values)
				};
			});
			
			nextStage();
		} catch (error) {
			console.error('Error generating council dialogue:', error);
		} finally {
			isGeneratingCouncil = false;
		}
	}

	function generateAdvisorResponse(advisor: { type: 'real' | 'mythic' | 'archetype' }, wish: string, values: string[]): string {
		// Placeholder for AI-generated responses
		const responses = {
			'real': [
				`To truly manifest "${wish}", we must first ground ourselves in ${values[0]}. Begin with what serves the collective, not the individual.`,
				`The path to "${wish}" requires patience and ${values[1] || 'patience'}. Listen deeply before you build.`,
				`Your wish speaks to a deeper need. Let ${values[0]} and ${values[2] || 'wisdom'} guide your first steps.`
			],
			'mythic': [
				`The ancient ones whisper: "${wish}" is not built, but grown. Plant seeds of ${values[0]} and tend them with ${values[1] || 'care'}.`,
				`From the realm between worlds, I see your path. Honor ${values[0]} as sacred, and your wish shall unfold naturally.`,
				`The spirits of place must consent. Offer ${values[1] || 'respect'} before you begin, and ask permission of the land itself.`
			],
			'archetype': [
				`Ha! You think too much! ${wish}? Just begin! Let ${values[0]} be your compass, and ${values[1] || 'joy'} your fuel.`,
				`The old ways are breaking. Your "${wish}" needs new rules. Make ${values[0]} your rebellion.`,
				`Every ending is a beginning. Your wish carries both creation and destruction. Embrace the chaos of ${values[0]}.`
			]
		};
		
		const typeResponses = responses[advisor.type] || responses['real'];
		return typeResponses[Math.floor(Math.random() * typeResponses.length)];
	}

	async function generateDesignStreams() {
		isGeneratingDesign = true;
		
		try {
			await new Promise(resolve => setTimeout(resolve, 2000));
			
			// Generate design streams based on the council dialogue
			ritualSession.design_streams = [
				{
					name: `${ritualSession.declared_values[0] || 'Sacred'} Path`,
					description: `A gentle approach emphasizing ${ritualSession.declared_values[0]} and deep listening.`,
					materials: ['Natural materials', 'Simple tools', 'Gathered community', 'Time for reflection'],
					steps: [
						'Begin with a circle of intention',
						`Honor ${ritualSession.declared_values[0]} in every decision`,
						'Create space for emergence',
						'Celebrate each milestone'
					]
				},
				{
					name: `${ritualSession.declared_values[1] || 'Bold'} Stream`,
					description: `A dynamic approach that embraces ${ritualSession.declared_values[1]} and playful experimentation.`,
					materials: ['Flexible resources', 'Collaborative tools', 'Creative supplies', 'Learning mindset'],
					steps: [
						'Prototype quickly and iterate',
						`Let ${ritualSession.declared_values[1]} guide the process`,
						'Invite unexpected perspectives',
						'Document the journey'
					]
				}
			];
			
			// Generate ritual artifact
			ritualSession.ritual_artifact = {
				format: 'scroll',
				text: `The council has spoken. Your path to "${ritualSession.wish_statement}" weaves through ${ritualSession.declared_values.join(', ')}. May wisdom guide your steps.`,
				quotes: Object.fromEntries(
					ritualSession.council_dialogue.map(d => [d.advisor, d.response.split('.')[0] + '.'])
				),
				ascii_glyph: generateGlyph()
			};
			
			nextStage();
		} catch (error) {
			console.error('Error generating design streams:', error);
		} finally {
			isGeneratingDesign = false;
		}
	}

	function generateGlyph(): string {
		const symbols = ['◯', '△', '◇', '✦', '⬟', '◈'];
		const valueCount = ritualSession.declared_values.length;
		const advisorCount = ritualSession.advisors.length;
		
		const centerSymbol = symbols[0];
		const valueSymbols = symbols.slice(1, valueCount + 1).join(' - ');
		const advisorSymbols = symbols.slice(1, advisorCount + 1).join(' ');
		
		return `( ${valueSymbols} ) - ${centerSymbol} - ( ${advisorSymbols} )`;
	}

	function closeRitual() {
		showRitual = false;
		ritualStage = 0;
		// Keep the ritual session data for potential reuse
	}

	// Load history data from holosphere
	async function loadHistoryData() {
		if (!holosphere || !holonID) return;
		
		try {
			// Load previous values
			const valuesData = await fetchWithTimeout(holosphere.get(holonID, "ritual_previous_values", holonID), 2000);
			if (valuesData && Array.isArray(valuesData)) {
				previousValues = [...new Set(valuesData)]; // Remove duplicates
			}
		} catch (error) {
			console.log('No previous values found');
		}
		
		try {
			// Load previous advisors
			const advisorsData = await fetchWithTimeout(holosphere.get(holonID, "ritual_previous_advisors", holonID), 2000);
			if (advisorsData && Array.isArray(advisorsData)) {
				previousAdvisors = advisorsData as any;
			}
		} catch (error) {
			console.log('No previous advisors found');
		}
	}

	// Save history data to holosphere
	async function saveHistoryData() {
		if (!holosphere || !holonID) return;
		
		try {
			// Save values history
			if (previousValues.length > 0) {
				await holosphere.put(holonID, "ritual_previous_values", previousValues);
			}
			
			// Save advisors history
			if (previousAdvisors.length > 0) {
				await holosphere.put(holonID, "ritual_previous_advisors", previousAdvisors);
			}
		} catch (error) {
			console.error('Error saving history data:', error);
		}
	}

	// Create new holon from ritual
	async function createHolonFromRitual() {
		if (!ritualSession.wish_statement.trim()) return;
		
		// Generate hash for new holon ID
		const newHolonID = hashString(ritualSession.wish_statement);
		
		try {
			// Save ritual as completed
			const completedRitual = {
				id: ritualSession.session_id,
				title: ritualSession.wish_statement,
				date: new Date().toISOString(),
				artifact: ritualSession.ritual_artifact,
				design_streams: ritualSession.design_streams
			};
			
			// Add to previous rituals
			previousRituals = [completedRitual, ...previousRituals];
			await savePreviousRituals();
			
			// Create tasks in new holon based on design streams
			if (holosphere) {
				const tasks = ritualSession.design_streams.flatMap((stream, streamIndex) => 
					stream.steps.map((step, stepIndex) => ({
						id: `${streamIndex}-${stepIndex}`,
						title: step,
						description: `From ${stream.name}: ${stream.description}`,
						status: 'pending',
						created: new Date().toISOString(),
						stream: stream.name
					}))
				);
				
				// Save tasks to new holon
				await holosphere.put(newHolonID, "tasks", tasks);
				
				// Save ritual metadata
				await holosphere.put(newHolonID, "ritual_origin", {
					origin_ritual: ritualSession.session_id,
					wish: ritualSession.wish_statement,
					values: ritualSession.declared_values,
					advisors: ritualSession.advisors,
					created: new Date().toISOString()
				});
			}
			
			// Navigate to new holon
			window.location.href = `/${newHolonID}`;
			
		} catch (error) {
			console.error('Error creating holon from ritual:', error);
		}
	}

	// Load previous rituals
	async function loadPreviousRituals() {
		if (!holosphere || !holonID) return;
		
		try {
			const ritualsData = await fetchWithTimeout(holosphere.get(holonID, "previous_rituals", holonID), 2000);
			if (ritualsData && Array.isArray(ritualsData)) {
				previousRituals = ritualsData as any;
			}
		} catch (error) {
			console.log('No previous rituals found');
		}
	}

	// Save previous rituals
	async function savePreviousRituals() {
		if (!holosphere || !holonID) return;
		
		try {
			await holosphere.put(holonID, "previous_rituals", previousRituals);
		} catch (error) {
			console.error('Error saving previous rituals:', error);
		}
	}

	// Get active members count
	$: activeMembers = Object.values(councilData.members).filter(member => member.status === 'active').length;

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
			let updateTimeout: ReturnType<typeof setTimeout> | undefined;
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
		
		checkConnection().then((cleanup) => {
			if (cleanup) idStoreUnsubscribe = cleanup;
		});
	});

	// Watch for page ID changes with debouncing
	let pageUpdateTimeout: ReturnType<typeof setTimeout> | undefined;
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

	// Clean up subscriptions on destroy
	onDestroy(() => {
		try { if (councilUnsubscribe) councilUnsubscribe(); } catch {}
		try { if (idStoreUnsubscribe) idStoreUnsubscribe(); } catch {}
	});

	// Select previous value
	function selectPreviousValue(value: string) {
		if (!ritualSession.declared_values.includes(value) && ritualSession.declared_values.length < 5) {
			ritualSession.declared_values = [...ritualSession.declared_values, value];
		}
	}

	// Select previous advisor
	function selectPreviousAdvisor(advisor: { name: string; type: 'real' | 'mythic' | 'archetype'; lens: string; }) {
		if (ritualSession.advisors.length < 5) {
			const advisorExists = ritualSession.advisors.some(a => 
				a.name === advisor.name && a.lens === advisor.lens
			);
			if (!advisorExists) {
				ritualSession.advisors = [...ritualSession.advisors, advisor];
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
		<div class="lg:flex-1 bg-gray-800 rounded-3xl shadow-xl">
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

						<!-- Ritual Button -->
						<div class="flex justify-center mt-8">
							<button 
								on:click={startRitual}
								class="group relative bg-gray-800 hover:bg-gray-700 border-2 border-indigo-500/50 hover:border-indigo-400 text-white py-6 px-12 rounded-3xl transition-all duration-300 flex items-center justify-center gap-4 text-xl font-medium shadow-2xl hover:shadow-indigo-500/25 backdrop-blur-sm"
							>
								<div class="w-12 h-12 rounded-full bg-indigo-600 flex items-center justify-center text-2xl group-hover:bg-indigo-500 transition-colors duration-300">
									✨
								</div>
								Begin Council Ritual
								<div class="absolute inset-0 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 rounded-3xl transition-opacity duration-300"></div>
							</button>
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
										bind:value={circleInputs[editingCircle!]}
										placeholder="Enter advisor name..."
										class="w-full bg-gray-700 border border-gray-600 rounded-xl px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
										on:keydown={(e) => {
											if (e.key === 'Enter') {
												saveCircleInput(editingCircle!);
											} else if (e.key === 'Escape') {
												cancelCircleInput();
											}
										}}
									/>
</div>
											
											<div class="flex gap-3">
																					<button
										on:click={() => saveCircleInput(editingCircle!)}
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
			<!-- Previous Rituals -->
			<div class="bg-gray-800 rounded-3xl shadow-xl p-6">
				<h3 class="text-xl font-bold text-white mb-4">Previous Rituals</h3>
				<div class="space-y-4 max-h-[500px] overflow-y-auto">
					{#each previousRituals as ritual}
						<div class="bg-gray-700 rounded-xl p-4 hover:bg-gray-600 transition-colors cursor-pointer">
							<h4 class="text-white font-medium text-sm mb-2 line-clamp-2">{ritual.title}</h4>
							<div class="flex items-center justify-between text-xs text-gray-400 mb-3">
								<span>{new Date(ritual.date).toLocaleDateString()}</span>
								<span>{ritual.design_streams.length} streams</span>
							</div>
							<div class="text-xs text-gray-300">
								<div class="mb-2">{ritual.artifact.ascii_glyph}</div>
								<p class="line-clamp-2 italic">"{ritual.artifact.text}"</p>
							</div>
							<button 
								on:click={() => window.location.href = `/${hashString(ritual.title)}`}
								class="mt-3 w-full bg-indigo-600 hover:bg-indigo-700 text-white py-1 px-3 rounded-lg text-xs transition-colors"
							>
								View Holon
							</button>
						</div>
					{:else}
						<div class="text-center text-gray-400 py-8">
							<div class="text-4xl mb-3">✨</div>
							<p class="text-sm">No rituals completed yet</p>
							<p class="text-xs mt-2">Begin your first ritual to create sacred artifacts</p>
						</div>
					{/each}
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

<!-- Ritual Interface Modal -->
{#if showRitual}
	<div class="fixed inset-0 z-50 overflow-auto bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
		<div class="bg-gray-800 rounded-3xl shadow-2xl w-full max-w-4xl relative border border-gray-700">
			<!-- Ritual Header -->
			<div class="p-6 border-b border-gray-700">
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-4">
						<div class="w-12 h-12 rounded-full bg-indigo-600 flex items-center justify-center text-2xl">
							{#if ritualStage === 0}✨{:else if ritualStage === 1}💠{:else if ritualStage === 2}🧙‍♀️{:else if ritualStage === 3}🔍{:else if ritualStage === 4}🛠{:else}🎴{/if}
						</div>
						<div>
							<h2 class="text-2xl font-bold text-white">Council Ritual</h2>
							<p class="text-gray-300">
								{#if ritualStage === 0}Initiation - Speak Your Wish
								{:else if ritualStage === 1}Value Naming - Sacred Words
								{:else if ritualStage === 2}Advisor Summoning - Call Your Guides
								{:else if ritualStage === 3}Council Dialogue - Listen to Wisdom
								{:else if ritualStage === 4}Design Streams - Pathways Forward
								{:else}Closure & Gift - Your Sacred Artifact
								{/if}
							</p>
						</div>
					</div>
					<button
						on:click={closeRitual}
						class="text-gray-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-gray-700"
					>
						<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
						</svg>
					</button>
				</div>
				<!-- Progress Bar -->
				<div class="mt-6 w-full bg-gray-700 rounded-full h-2">
					<div class="bg-indigo-500 h-2 rounded-full transition-all duration-500" style="width: {((ritualStage + 1) / 6) * 100}%"></div>
				</div>
			</div>

			<!-- Ritual Content -->
			<div class="p-8 min-h-[400px]">
				{#if ritualStage === 0}
					<!-- Stage 1: Initiation -->
					<div class="text-center space-y-6">
						<div class="text-6xl mb-4">✨</div>
						<h3 class="text-3xl font-bold text-white mb-4">Welcome to the Circle</h3>
						<p class="text-gray-300 text-lg max-w-2xl mx-auto leading-relaxed">
							Enter this sacred space with intention. Here, imagination meets implementation. 
							Your wish will be witnessed, your values honored, and your path illuminated by wise council.
						</p>
						<div class="mt-8 space-y-4">
							<label class="block text-gray-300 text-lg font-medium">Speak your wish. What do you seek to bring into being?</label>
							<textarea
								bind:value={ritualSession.wish_statement}
								placeholder="I wish to create..."
								class="w-full bg-gray-700 border border-gray-600 rounded-xl px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent min-h-[120px] resize-none"
							></textarea>
						</div>
					</div>

				{:else if ritualStage === 1}
					<!-- Stage 2: Value Naming -->
					<div class="space-y-6">
						<div class="text-center">
							<div class="text-5xl mb-4">💠</div>
							<h3 class="text-3xl font-bold text-white mb-4">Name Your Sacred Values</h3>
							<p class="text-gray-300 text-lg">These are not checkboxes, but sacred words that will guide your journey.</p>
						</div>
						
						<div class="flex gap-4 mb-6">
							<input
								bind:value={currentValue}
								placeholder="Enter a core value..."
								class="flex-1 bg-gray-700 border border-gray-600 rounded-xl px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
								on:keydown={(e) => e.key === 'Enter' && addValue()}
							/>
							<button
								on:click={addValue}
								disabled={!currentValue.trim() || ritualSession.declared_values.length >= 5}
								class="group relative bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 disabled:from-gray-600 disabled:to-gray-600 text-white px-8 py-3 rounded-xl transition-all duration-200 font-medium shadow-lg hover:shadow-xl disabled:hover:shadow-lg transform hover:scale-105 disabled:hover:scale-100"
							>
								Add Value
								<div class="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 disabled:opacity-0 rounded-xl transition-opacity duration-200"></div>
							</button>
						</div>
						
						{#if previousValues.length > 0}
							<div class="bg-gray-700 rounded-xl p-4 mb-6">
								<h4 class="text-gray-300 font-medium mb-3">Previous Values:</h4>
								<div class="flex flex-wrap gap-2">
									{#each previousValues.filter(v => !ritualSession.declared_values.includes(v)) as value}
										<button
											on:click={() => selectPreviousValue(value)}
											class="group relative bg-gray-600 hover:bg-gradient-to-r hover:from-indigo-600 hover:to-purple-600 text-white px-4 py-2 rounded-full text-sm transition-all duration-200 font-medium hover:shadow-lg transform hover:scale-105"
										>
											+ {value}
											<div class="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 rounded-full transition-opacity duration-200"></div>
										</button>
									{/each}
								</div>
							</div>
						{/if}
						
						<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
							{#each ritualSession.declared_values as value, index}
								<div class="bg-gray-700 rounded-xl p-4 flex items-center justify-between group hover:bg-gray-600 transition-colors">
									<span class="text-white font-medium">✦ {value}</span>
									<button
										on:click={() => removeValue(index)}
										class="text-gray-400 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
									>
										✕
									</button>
								</div>
							{/each}
						</div>
						
						{#if ritualSession.declared_values.length === 0}
							<p class="text-center text-gray-400 italic">Add 3-5 values that will guide your manifestation...</p>
						{/if}
					</div>

				{:else if ritualStage === 2}
					<!-- Stage 3: Advisor Summoning -->
					<div class="space-y-6">
						<div class="text-center">
							<div class="text-5xl mb-4">🧙‍♀️</div>
							<h3 class="text-3xl font-bold text-white mb-4">Summon Your Advisors</h3>
							<p class="text-gray-300 text-lg">Call upon wise guides - ancestors, archetypes, or inspiring figures.</p>
						</div>
						
						<div class="bg-gray-700 rounded-xl p-6 space-y-4">
							<div class="grid md:grid-cols-3 gap-4">
								<div>
									<label class="block text-gray-300 mb-2">Advisor Name</label>
									<input
										bind:value={currentAdvisorName}
										placeholder="e.g., Joanna Macy"
										class="w-full bg-gray-600 border border-gray-500 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
									/>
								</div>
								<div>
									<label class="block text-gray-300 mb-2">Type</label>
									<select
										bind:value={selectedAdvisorType}
										class="w-full bg-gray-600 border border-gray-500 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
									>
										<option value="real">Historical/Real Person</option>
										<option value="mythic">Mythic/Spiritual Being</option>
										<option value="archetype">Archetypal Force</option>
									</select>
								</div>
								<div>
									<label class="block text-gray-300 mb-2">Lens/Wisdom</label>
									<input
										bind:value={currentAdvisorLens}
										placeholder="e.g., deep ecology"
										class="w-full bg-gray-600 border border-gray-500 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
									/>
								</div>
							</div>
							<button
								on:click={addAdvisor}
								disabled={!currentAdvisorName.trim() || !currentAdvisorLens.trim() || ritualSession.advisors.length >= 5}
								class="group relative w-full bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 disabled:from-gray-600 disabled:to-gray-600 text-white py-4 rounded-xl transition-all duration-200 font-semibold shadow-lg hover:shadow-xl disabled:hover:shadow-lg transform hover:scale-105 disabled:hover:scale-100"
							>
								Summon Advisor
								<div class="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 disabled:opacity-0 rounded-xl transition-opacity duration-200"></div>
							</button>
						</div>
						
						{#if previousAdvisors.length > 0}
							<div class="bg-gray-700 rounded-xl p-4 mb-4">
								<h4 class="text-gray-300 font-medium mb-3">Previous Advisors:</h4>
								<div class="grid grid-cols-1 md:grid-cols-2 gap-3">
									{#each previousAdvisors.filter(advisor => 
										!ritualSession.advisors.some(a => a.name === advisor.name && a.lens === advisor.lens)
									) as advisor}
										<button
											on:click={() => selectPreviousAdvisor(advisor)}
											class="group relative bg-gray-600 hover:bg-gradient-to-r hover:from-indigo-600 hover:to-purple-600 text-left p-4 rounded-xl transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105"
										>
											<div class="font-medium text-white">+ {advisor.name}</div>
											<div class="text-gray-300 text-sm capitalize">{advisor.type}</div>
											<div class="text-gray-400 text-sm italic">"{advisor.lens}"</div>
											<div class="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 rounded-xl transition-opacity duration-200"></div>
										</button>
									{/each}
								</div>
								{#if previousAdvisors.filter(advisor => 
									!ritualSession.advisors.some(a => a.name === advisor.name && a.lens === advisor.lens)
								).length === 0}
									<p class="text-gray-400 text-sm italic">All previous advisors are already selected</p>
								{/if}
							</div>
						{/if}
						
						<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
							{#each ritualSession.advisors as advisor, index}
								<div class="bg-gray-700 rounded-xl p-4 group hover:bg-gray-600 transition-colors">
									<div class="flex items-start justify-between">
										<div class="flex-1">
											<h4 class="text-white font-bold">{advisor.name}</h4>
											<p class="text-gray-300 text-sm capitalize">{advisor.type}</p>
											<p class="text-gray-300 text-sm italic">"{advisor.lens}"</p>
										</div>
										<button
											on:click={() => removeAdvisor(index)}
											class="text-gray-400 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
										>
											✕
										</button>
									</div>
								</div>
							{/each}
						</div>
					</div>

				{:else if ritualStage === 3}
					<!-- Stage 4: Council Dialogue -->
					<div class="space-y-6">
						<div class="text-center">
							<div class="text-5xl mb-4">🔍</div>
							<h3 class="text-3xl font-bold text-white mb-4">The Council Speaks</h3>
							<p class="text-gray-300 text-lg">Listen as your advisors respond to your wish through the lens of your values.</p>
						</div>
						
						{#if ritualSession.council_dialogue.length === 0}
							<div class="text-center">
								<button
									on:click={generateCouncilDialogue}
									disabled={isGeneratingCouncil}
									class="group relative bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:from-gray-600 disabled:to-gray-600 text-white px-12 py-5 rounded-2xl transition-all duration-300 text-lg font-semibold shadow-xl hover:shadow-2xl disabled:hover:shadow-xl transform hover:scale-105 disabled:hover:scale-100"
								>
									{#if isGeneratingCouncil}
										<div class="flex items-center gap-3">
											<div class="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
											Summoning Council Wisdom...
										</div>
									{:else}
										Convene the Council
									{/if}
									<div class="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 disabled:opacity-0 rounded-2xl transition-opacity duration-300"></div>
								</button>
							</div>
						{:else}
							<div class="space-y-4">
								{#each ritualSession.council_dialogue as dialogue}
									<div class="bg-gray-700 rounded-xl p-6 border border-gray-600">
										<h4 class="text-gray-300 font-bold mb-3 flex items-center gap-2">
											<span class="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-sm">
												{dialogue.advisor.charAt(0)}
											</span>
											{dialogue.advisor}
										</h4>
										<p class="text-white italic leading-relaxed">"{dialogue.response}"</p>
									</div>
								{/each}
							</div>
						{/if}
					</div>

				{:else if ritualStage === 4}
					<!-- Stage 5: Design Streams -->
					<div class="space-y-6">
						<div class="text-center">
							<div class="text-5xl mb-4">🛠</div>
							<h3 class="text-3xl font-bold text-white mb-4">Pathways Forward</h3>
							<p class="text-gray-300 text-lg">From wisdom comes action. Choose your path of manifestation.</p>
						</div>
						
						{#if ritualSession.design_streams.length === 0}
							<div class="text-center">
								<button
									on:click={generateDesignStreams}
									disabled={isGeneratingDesign}
									class="group relative bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:from-gray-600 disabled:to-gray-600 text-white px-12 py-5 rounded-2xl transition-all duration-300 text-lg font-semibold shadow-xl hover:shadow-2xl disabled:hover:shadow-xl transform hover:scale-105 disabled:hover:scale-100"
								>
									{#if isGeneratingDesign}
										<div class="flex items-center gap-3">
											<div class="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
											Weaving Design Streams...
										</div>
									{:else}
										Generate Design Paths
									{/if}
									<div class="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 disabled:opacity-0 rounded-2xl transition-opacity duration-300"></div>
								</button>
							</div>
						{:else}
							<div class="grid md:grid-cols-2 gap-6">
								{#each ritualSession.design_streams as stream}
									<div class="bg-gray-700 rounded-xl p-6 border border-gray-600 hover:bg-gray-600 transition-colors">
										<h4 class="text-xl font-bold text-white mb-3">{stream.name}</h4>
										<p class="text-gray-300 mb-4">{stream.description}</p>
										
										<div class="space-y-3">
											<div>
												<h5 class="text-gray-300 font-medium mb-2">Materials Needed:</h5>
												<div class="flex flex-wrap gap-2">
													{#each stream.materials as material}
														<span class="bg-gray-600 text-gray-200 px-3 py-1 rounded-full text-sm">{material}</span>
													{/each}
												</div>
											</div>
											
											<div>
												<h5 class="text-gray-300 font-medium mb-2">Steps:</h5>
												<ol class="space-y-1">
													{#each stream.steps as step, index}
														<li class="text-gray-200 text-sm flex items-start gap-2">
															<span class="text-gray-400 font-medium">{index + 1}.</span>
															{step}
														</li>
													{/each}
												</ol>
											</div>
										</div>
									</div>
								{/each}
							</div>
						{/if}
					</div>

				{:else if ritualStage === 5}
					<!-- Stage 6: Closure & Gift -->
					<div class="space-y-6 text-center">
						<div class="text-6xl mb-4">🎴</div>
						<h3 class="text-3xl font-bold text-white mb-4">Your Sacred Artifact</h3>
						<p class="text-gray-300 text-lg">The ritual is complete. Receive your gift from the council.</p>
						
						<div class="bg-gray-700 rounded-2xl p-8 border border-gray-600 max-w-2xl mx-auto">
							<div class="text-4xl mb-4">{ritualSession.ritual_artifact.ascii_glyph}</div>
							<blockquote class="text-xl text-white italic leading-relaxed mb-6">
								"{ritualSession.ritual_artifact.text}"
							</blockquote>
							
							<div class="space-y-3 text-left">
								<h4 class="text-gray-300 font-bold text-center mb-4">Voices from the Council:</h4>
								{#each Object.entries(ritualSession.ritual_artifact.quotes) as [advisor, quote]}
									<div class="bg-gray-600 rounded-lg p-3">
										<span class="text-gray-300 font-medium">{advisor}:</span>
										<span class="text-white"> "{quote}"</span>
									</div>
								{/each}
							</div>
						</div>
						
						<div class="flex gap-4 justify-center">
							<button 
								on:click={createHolonFromRitual}
								class="group relative bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white px-10 py-5 rounded-2xl transition-all duration-300 text-lg font-semibold shadow-xl hover:shadow-2xl transform hover:scale-105 flex items-center gap-2"
							>
								📜 Receive Scroll
								<div class="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 rounded-2xl transition-opacity duration-300"></div>
							</button>
							<button 
								on:click={closeRitual}
								class="group relative bg-gray-600 hover:bg-gray-700 text-white px-10 py-5 rounded-2xl transition-all duration-300 text-lg font-semibold shadow-lg hover:shadow-xl transform hover:scale-105"
							>
								Quit Ritual
								<div class="absolute inset-0 bg-white opacity-0 group-hover:opacity-5 rounded-2xl transition-opacity duration-300"></div>
							</button>
						</div>
					</div>
				{/if}
			</div>

			<!-- Navigation Footer -->
			<div class="p-6 border-t border-gray-700 flex justify-between items-center">
				<button
					on:click={prevStage}
					disabled={ritualStage === 0}
					class="bg-gray-600 hover:bg-gray-700 disabled:bg-gray-800 disabled:text-gray-500 text-white px-6 py-2 rounded-xl transition-colors"
				>
					← Previous
				</button>
				
				<div class="text-gray-300">
					Stage {ritualStage + 1} of 6
				</div>
				
				<button
					on:click={nextStage}
					disabled={ritualStage === 5 || 
						(ritualStage === 0 && !ritualSession.wish_statement.trim()) ||
						(ritualStage === 1 && ritualSession.declared_values.length === 0) ||
						(ritualStage === 2 && ritualSession.advisors.length === 0)}
					class="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 text-white px-6 py-2 rounded-xl transition-colors"
				>
					{ritualStage === 5 ? 'Complete' : 'Next →'}
				</button>
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