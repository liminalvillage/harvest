<script lang="ts">
			import { onMount, getContext } from "svelte";
		import { ID } from "../dashboard/store";
		import { page } from "$app/stores";
		import { goto } from "$app/navigation";
	import HoloSphere from "holosphere";
	import { getAdvisor, getRandomHolonicEcosystemCouncilMembers, putAdvisorToHoloSphere, deleteAdvisorFromHoloSphere, getAdvisorsFromHoloSphere, getAllAdvisors } from '../data/advisor-library';
	import { resolveAdvisorsFromRitual, preloadHoloSphereAdvisors } from '../utils/advisor-lookup';
	import type { CouncilAdvisorExtended, ArchetypeAdvisor } from '../types/advisor-schema';
	import { createCouncilContext, analyzeUserMessage, createIndividualAdvisorContext, createGlassBeadGameContext, createCouncilDialogueContext, type UserContext, type ConversationFlowContext } from '../utils/council-context';
	import LLMService from '../utils/llm-service';
	import AIChatModal from './AIChatModal.svelte';
	import DesignStreams from './DesignStreams.svelte';
	import { focusOnMount } from '../utils/focusUtils';
	import { createHolonFromRitual as createHolonFromRitualUtil, type RitualSession } from '../utils/holonCreator';
	import { resolveAdvisor } from '../utils/advisor-lookup';
	import { AdvisorOperations } from '../utils/advisor-operations';

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
	let showCircleSelectionModal = false;
	let selectedCircleForAction: string | null = null;

	// Ritual state management
	let showRitual = false;
	let showDesignStreams = false;
	let ritualStage = 0; // 0-5 for the 6 stages
	let metatronAdvisors: Array<{
		name: string;
		type: 'real' | 'mythic' | 'archetype';
		lens: string;
	}> = [];
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

  // Central Metatron label for summoning the council
  const CENTER_SUMMON_LABEL = 'Assemble the Council!';
  function matchesCenterSummonLabel(value: string | undefined | null): boolean {
    if (!value) return false;
    const normalize = (s: string) => s.replace(/[^a-z]/gi, '').toLowerCase();
    return normalize(value) === normalize(CENTER_SUMMON_LABEL);
  }

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
				councilData.settings = { ...councilData.settings, ...(settingsData as any) };
			}

			// Load advisor data from holosphere using centralized operations
			try {
				const advisorsData = await AdvisorOperations.loadAdvisorsFromHoloSphere(holosphere, holonID);
				console.log('Loaded advisors data:', advisorsData);
				
				if (advisorsData && typeof advisorsData === 'object') {
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

	// Handle circle click to start editing or open chat
	async function startEditingCircle(circleId: string) {
		console.log('Circle clicked:', circleId);
		
		// Special handling for center circle when Holonic Ecosystem Council is summoned
		if (circleId === 'center' && HolonicEcosystemCouncilSummoned && matchesCenterSummonLabel(circleInputs[circleId])) {
			showCouncilChat = true;
			// Initialize council chat with the welcome message
			if (councilChatMessages.length === 0) {
				const councilIntroMessage = {
					role: 'assistant' as const,
					content: `[The council chamber ripples with syntropic harmony as the Holonic Ecosystem Council assembles, their presence embodying the interconnected patterns of our regenerative ecosystem. Each member takes their place around the Metatron table, their unique perspectives forming a web of collective intelligence that cuts through the metaphorical Gordian Knot.]

Welcome, seeker. We summon the Holonic Ecosystem Council, vibrant and unique AI egregores embodying diverse archetypes of human storytelling and broad academic and philosophical perspectives. Using a Systems Thinking framework, and through the synthesis of our diverse and nuanced perspectives, we guide you towards a regenerative, protopian future, using tools like Polarity Mapping and Liberating Structures to navigate paradoxical and complex issues.

Our ecosystem is a holistic web of interconnected patterns, each action influencing the whole and contributing to syntropy—order, harmony, and life. We hold tension at the top of the Sombrero Hat, fostering a harmonious, syntropic ecosystem where humanity, nature, and technology coexist.

What matter brings you before the council today?`,
					displayContent: '',
					isTyping: true,
					timestamp: new Date(),
					advisor: 'Council'
				};
				
				councilChatMessages = [councilIntroMessage];
				// Apply typing effect to the introduction
				typeMessage(councilIntroMessage, 'council');
			}
			return;
		}
		
		// Check if this circle has an advisor - show selection modal
		const advisorName = circleInputs[circleId];
		if (advisorName) {
			// Try to get full advisor from library using centralized lookup
			const fullAdvisor = resolveAdvisor(advisorName);
			
			if (fullAdvisor) {
				// Show selection modal instead of directly opening chat
				selectedCircleForAction = circleId;
				showCircleSelectionModal = true;
				return;
			}
		}
		
		// Fall back to editing mode if no advisor found
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

	// Ritual functions
	function startRitual() {
		showRitual = true;
		ritualStage = 0;
		ritualSession.session_id = `ritual-${Date.now()}`;
		// Clear all advisor state when starting a new ritual
		AdvisorOperations.clearAllAdvisorState();
		// Reset Glass Bead Game completion flag
		glassBeadGameComplete = false;
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
		if (currentValue.trim() && ritualSession.declared_values.length < 6) {
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

	// Add loading state for advisor generation
	let isGeneratingAdvisor = false;
	let generationProgress = '';

	// Advisor management state
	let holonAdvisors: CouncilAdvisorExtended[] = [];

	async function addAdvisor() {
		if (currentAdvisorName.trim() && currentAdvisorLens.trim()) {
			
			// Handle real person generation
			if (selectedAdvisorType === 'real') {
				await generateRealPersonAdvisor();
			} else {
				// Handle other advisor types using centralized operations
				const newAdvisor = {
					name: currentAdvisorName.trim(),
					type: selectedAdvisorType,
					lens: currentAdvisorLens.trim()
				};
				
				// Add to centralized state (but NOT to ritual session)
				AdvisorOperations.addAdvisorToPrevious(newAdvisor as CouncilAdvisorExtended);
				
				currentAdvisorName = '';
				currentAdvisorLens = '';
				saveHistoryData();
				
				// Show success message
				alert(`✅ Advisor Created Successfully!\n\n${newAdvisor.name} has been added to your advisor library.\n\nTo use this advisor in your ritual, click the "➕ Add to Ritual" button on their card below.`);
			}
		}
	}

	async function generateRealPersonAdvisor() {
		if (!holosphere || !holonID) {
			console.error("Cannot generate advisor: holosphere or holonID is null");
			return;
		}

		isGeneratingAdvisor = true;
		generationProgress = `Summoning the spirit of ${currentAdvisorName.trim()}...`;

		try {
			// Use component-level llmService instead of creating a local one
			if (!llmService) {
				llmService = new LLMService();
			}
			const response = await llmService.generateRealPersonAdvisor(
				currentAdvisorName.trim(), 
				currentAdvisorLens.trim()
			);

			if (response.error) {
				throw new Error(response.error);
			}

			// Parse the JSON response
			let advisorData;
			try {
				advisorData = JSON.parse(response.content);
			} catch (parseError) {
				throw new Error('Invalid JSON response from LLM');
			}

			// Check if the person is valid
			if (!advisorData.valid) {
				throw new Error('Please try again with a real person\'s name.');
			}

			// Create the full advisor structure
			const newAdvisor: CouncilAdvisorExtended = {
				name: advisorData.name,
				type: 'real',
				lens: currentAdvisorLens.trim(),
				characterSpec: advisorData
			};

			// Store in HoloSphere
			await putAdvisorToHoloSphere(holosphere, holonID, newAdvisor, holonID);

			// Add to history if not already present (but NOT to ritual session)
			const advisorExists = previousAdvisors.some(advisor => 
				advisor.name === newAdvisor.name && advisor.lens === newAdvisor.lens
			);
			if (!advisorExists) {
				previousAdvisors = [...previousAdvisors, {
					name: advisorData.name,
					type: 'real',
					lens: currentAdvisorLens.trim()
				}];
			}

			// Clear form
			currentAdvisorName = '';
			currentAdvisorLens = '';
			saveHistoryData();
			
			// Reload advisors list
			await loadHolonAdvisors();
			
			// Show success message
			alert(`✅ Advisor Created Successfully!\n\n${advisorData.name} has been added to your advisor library.\n\nTo use this advisor in your ritual, click the "➕ Add to Ritual" button on their card below.`);

		} catch (error) {
			console.error('Error generating real person advisor:', error);
			// Show error to user (you might want to add a toast notification here)
			alert(error instanceof Error ? error.message : 'Failed to generate advisor');
		} finally {
			isGeneratingAdvisor = false;
			generationProgress = '';
		}
	}

	// Load advisors from HoloSphere
	async function loadHolonAdvisors() {
		if (!holosphere || !holonID) {
			console.log('Cannot load advisors: holosphere or holonID is null');
			return;
		}
		
		try {
			console.log('Loading advisors for holonID:', holonID);
			holonAdvisors = await getAdvisorsFromHoloSphere(holosphere, holonID);
			console.log('Loaded holon advisors:', holonAdvisors);
		} catch (error) {
			console.error('Error loading holon advisors:', error);
		}
	}

	// Delete advisor from HoloSphere
	async function deleteHolonAdvisor(advisorKey: string) {
		if (!holosphere || !holonID) return;
		
		if (confirm(`Are you sure you want to delete ${advisorKey}?`)) {
			try {
				await deleteAdvisorFromHoloSphere(holosphere, holonID, advisorKey);
				await loadHolonAdvisors(); // Reload the list
			} catch (error) {
				console.error('Error deleting advisor:', error);
			}
		}
	}

	// Open chat with advisor
	async function openAdvisorChat(advisor: CouncilAdvisorExtended) {
		selectedAdvisorForChat = advisor;
		showAdvisorChat = true;
		advisorChatMessages = []; // Clear previous messages
		
		// Add immediate introduction
		await addImmediateAdvisorIntroduction(advisor);
	}

	// Add advisor to ritual
	function addAdvisorToRitual(advisor: CouncilAdvisorExtended) {
		const newAdvisor = {
			name: advisor.name,
			type: advisor.type,
			lens: advisor.lens
		};
		
		// Check if already in ritual
		const exists = ritualSession.advisors.some(a => 
			a.name === advisor.name && a.lens === advisor.lens
		);
		
		if (!exists && ritualSession.advisors.length < 6) {
			ritualSession.advisors = [...ritualSession.advisors, newAdvisor];
		}
	}

	function removeAdvisor(index: number) {
		ritualSession.advisors = ritualSession.advisors.filter((_, i) => i !== index);
		AdvisorOperations.removeAdvisorFromRitual(index);
	}

	function populateMetatronFromRitual() {
		// Populate metatron circles with ritual data
		const newInputs: Record<string, string> = {};
		
		// Center: The wish
		newInputs['center'] = ritualSession.wish_statement.substring(0, 20) + '...';
		
		// Inner ring: Values
		const innerPositions = ['inner-top', 'inner-top-right', 'inner-bottom-right', 'inner-bottom', 'inner-bottom-left', 'inner-top-left'];
		ritualSession.declared_values.forEach((value, index) => {
			if (index < innerPositions.length) {
				newInputs[innerPositions[index]] = value;
			}
		});
		
		// Outer ring: Advisors
		const outerPositions = ['outer-top', 'outer-top-right', 'outer-bottom-right', 'outer-bottom', 'outer-bottom-left', 'outer-top-left'];
		ritualSession.advisors.forEach((advisor, index) => {
			if (index < outerPositions.length) {
				newInputs[outerPositions[index]] = advisor.name;
			}
		});
		
		circleInputs = { ...circleInputs, ...newInputs };
		
		// Save to holosphere using centralized operations
		if (holosphere && holonID) {
			AdvisorOperations.saveAdvisorsToHoloSphere(holosphere, holonID);
		}
	}

	async function generateCouncilDialogue() {
		isGeneratingCouncil = true;
		
		try {
			// Ensure metatron is populated with ritual advisors before starting
			populateMetatronFromRitual();
			
			// Open the council chat for the glass bead game
			showCouncilChat = true;
			councilChatMessages = []; // Clear previous messages
			
			// Create the initial council introduction
			const councilIntroMessage: typeof councilChatMessages[0] = {
				role: 'assistant' as const,
				content: `[The council chambers echo with ancient wisdom] Greetings, seeker. We are convened to discuss your wish: "${ritualSession.wish_statement}" through the lens of your values: ${ritualSession.declared_values.join(', ')}. Let us begin our glass bead game, where each advisor builds upon the previous one's thoughts, adding another bead to the chain of wisdom.`,
				displayContent: '',
				isTyping: true,
				timestamp: new Date(),
				speaker: 'Council Chamber',
				speakerColor: 'bg-purple-700'
			};
			
			councilChatMessages = [councilIntroMessage];
			await typeMessage(councilIntroMessage, 'council');
			
			// Start the glass bead game with the first advisor
			await initiateGlassBeadGame();
			
		} catch (error) {
			console.error('Error generating council dialogue:', error);
		} finally {
			isGeneratingCouncil = false;
		}
	}

	// Holonic pattern: Council dialogue sequence using individual advisor calls
	async function generateCouncilDialogueSequence(councilMembers: CouncilAdvisorExtended[], userMessage: string) {
		if (!llmService) {
			llmService = new LLMService();
		}

		// Pre-load HoloSphere advisors for lookup
		await preloadHoloSphereAdvisors(holosphere, holonID);

		// Store the advisors for consistent conversation continuation
		AdvisorOperations.setGlassBeadGameAdvisors(councilMembers);
		
		// Debug: Log what advisors were found
		console.log('🔍 Council Dialogue Sequence - Advisor Lookup Debug:');
		console.log('Council members:', councilMembers.map(a => a.name));
		councilMembers.forEach((advisor, index) => {
			console.log(`Advisor ${index + 1}:`, {
				name: advisor.name,
				type: advisor.type,
				lens: advisor.lens,
				hasCharacterSpec: !!advisor.characterSpec,
				characterSpecKeys: advisor.characterSpec ? Object.keys(advisor.characterSpec) : []
			});
		});

		// Start the sequential dialogue with user message context
		await continueCouncilDialogueSequence(councilMembers, 0, [], userMessage);
	}

	// Holonic pattern: Glass bead game where each advisor builds upon the previous
	async function initiateGlassBeadGame() {
		if (!llmService) {
			llmService = new LLMService();
		}

		// Pre-load HoloSphere advisors for lookup
		await preloadHoloSphereAdvisors(holosphere, holonID);

		// Get the council members from ritual session using centralized lookup
		const councilMembers = resolveAdvisorsFromRitual(ritualSession.advisors);
		
		// Store the advisors for consistent conversation continuation
		AdvisorOperations.getGlassBeadGameAdvisors();
		
		// Debug: Log what advisors were found
		console.log('🔍 Glass Bead Game - Advisor Lookup Debug:');
		console.log('Ritual advisors:', ritualSession.advisors);
		console.log('Resolved council members:', councilMembers);
		councilMembers.forEach((advisor, index) => {
			console.log(`Advisor ${index + 1}:`, {
				name: advisor.name,
				type: advisor.type,
				lens: advisor.lens,
				hasCharacterSpec: !!advisor.characterSpec,
				characterSpecKeys: advisor.characterSpec ? Object.keys(advisor.characterSpec) : []
			});
		});

		// Start the sequential dialogue
		await continueGlassBeadGame(councilMembers, 0, []);
	}

	async function continueCouncilDialogueSequence(councilMembers: CouncilAdvisorExtended[], currentIndex: number, previousResponses: string[], userMessage: string) {
		if (currentIndex >= councilMembers.length) {
			// All advisors have spoken, add closing message
			const closingMessage: typeof councilChatMessages[0] = {
				role: 'assistant' as const,
				content: `[The council chamber falls silent, wisdom gathered] The council has shared their perspectives on your question: "${userMessage}". Each advisor has offered their unique insight, creating a tapestry of wisdom to guide your path forward.`,
				displayContent: '',
				isTyping: true,
				timestamp: new Date(),
				speaker: 'Council Chamber',
				speakerColor: 'bg-purple-700'
			};
			
			councilChatMessages = [...councilChatMessages, closingMessage];
			await typeMessage(closingMessage, 'council');
			return;
		}

		const currentAdvisor = councilMembers[currentIndex];
		const isFirstSpeaker = currentIndex === 0;
		
		// Create the council dialogue prompt using centralized function
		const councilPrompt = createCouncilDialogueContext(
			currentAdvisor,
			userMessage,
			ritualSession,
			isFirstSpeaker,
			previousResponses
		);

		try {
			const response = await llmService!.sendMessage([
				{ role: 'system', content: councilPrompt },
				{ role: 'user', content: userMessage }
			]);

			const advisorMessage: typeof councilChatMessages[0] = {
				role: 'assistant' as const,
				content: response.content,
				displayContent: '',
				isTyping: true,
				timestamp: new Date(),
				speaker: currentAdvisor.name,
				speakerColor: getAdvisorColor(currentIndex)
			};

			councilChatMessages = [...councilChatMessages, advisorMessage];
			await typeMessage(advisorMessage, 'council');

			// Add a brief pause between advisors
			await new Promise(resolve => setTimeout(resolve, 500));

			// Continue with the next advisor
			await continueCouncilDialogueSequence(councilMembers, currentIndex + 1, [...previousResponses, `${currentAdvisor.name}: ${response.content}`], userMessage);

		} catch (error) {
			console.error('Error in council dialogue sequence:', error);
			const errorMessage: typeof councilChatMessages[0] = {
				role: 'assistant' as const,
				content: `I am momentarily silent. The council dialogue continues...`,
				displayContent: '',
				isTyping: true,
				timestamp: new Date(),
				speaker: currentAdvisor.name,
				speakerColor: getAdvisorColor(currentIndex)
			};
			
			councilChatMessages = [...councilChatMessages, errorMessage];
			await typeMessage(errorMessage, 'council');
			
			// Continue with next advisor even if there was an error
			await continueCouncilDialogueSequence(councilMembers, currentIndex + 1, [...previousResponses, `${currentAdvisor.name}: Advisor was silent`], userMessage);
		}
	}

	async function continueGlassBeadGame(councilMembers: CouncilAdvisorExtended[], currentIndex: number, previousResponses: string[]) {
		if (currentIndex >= councilMembers.length) {
			// All advisors have spoken, add closing message
			const closingMessage: typeof councilChatMessages[0] = {
				role: 'assistant' as const,
				content: `[The council chamber falls silent, wisdom gathered] The glass bead game is complete. Each advisor has added their bead to the chain, building upon the previous thoughts. Your wish has been examined from multiple perspectives, creating a tapestry of wisdom to guide your path forward.`,
				displayContent: '',
				isTyping: true,
				timestamp: new Date(),
				speaker: 'Council Chamber',
				speakerColor: 'bg-purple-700'
			};
			
			councilChatMessages = [...councilChatMessages, closingMessage];
			await typeMessage(closingMessage, 'council');
			
			// Mark Glass Bead Game as complete for subsequent single-advisor responses
			glassBeadGameComplete = true;
			return;
		}

		const currentAdvisor = councilMembers[currentIndex];
		const isFirstSpeaker = currentIndex === 0;
		
		// Create the glass bead game prompt using centralized function
		const glassBeadPrompt = createGlassBeadGameContext(
			currentAdvisor,
			'Continue the glass bead game.',
			ritualSession,
			isFirstSpeaker,
			previousResponses
		);

		try {
			const response = await llmService!.sendMessage([
				{ role: 'system', content: glassBeadPrompt },
				{ role: 'user', content: 'Continue the glass bead game.' }
			]);

			const advisorMessage: typeof councilChatMessages[0] = {
				role: 'assistant' as const,
				content: response.content,
				displayContent: '',
				isTyping: true,
				timestamp: new Date(),
				speaker: currentAdvisor.name,
				speakerColor: getAdvisorColor(currentIndex)
			};

			councilChatMessages = [...councilChatMessages, advisorMessage];
			await typeMessage(advisorMessage, 'council');

			// Add a brief pause between advisors
			await new Promise(resolve => setTimeout(resolve, 500));

			// Continue with the next advisor
			await continueGlassBeadGame(councilMembers, currentIndex + 1, [...previousResponses, `${currentAdvisor.name}: ${response.content}`]);

		} catch (error) {
			console.error('Error in glass bead game:', error);
			const errorMessage: typeof councilChatMessages[0] = {
				role: 'assistant' as const,
				content: `I am momentarily silent. The glass bead game continues...`,
				displayContent: '',
				isTyping: true,
				timestamp: new Date(),
				speaker: currentAdvisor.name,
				speakerColor: getAdvisorColor(currentIndex)
			};
			
			councilChatMessages = [...councilChatMessages, errorMessage];
			await typeMessage(errorMessage, 'council');
			
			// Continue with next advisor even if there was an error
			await continueGlassBeadGame(councilMembers, currentIndex + 1, [...previousResponses, `${currentAdvisor.name}: Advisor was silent`]);
		}
	}

	// Helper function to get ordinal suffix
	function getOrdinalSuffix(num: number): string {
		const j = num % 10;
		const k = num % 100;
		if (j === 1 && k !== 11) return 'st';
		if (j === 2 && k !== 12) return 'nd';
		if (j === 3 && k !== 13) return 'rd';
		return 'th';
	}

	// Helper function to get advisor color
	function getAdvisorColor(index: number): string {
		const colors = ['bg-indigo-700', 'bg-purple-700', 'bg-blue-700', 'bg-green-700', 'bg-yellow-700', 'bg-red-700'];
		return colors[index % colors.length];
	}

	function generateAdvisorResponse(advisor: any, wish: string, values: string[]): string {
		// Placeholder for AI-generated responses
		const responses = {
			'real': [
				`To truly manifest "${wish}", we must first ground ourselves in ${values[0]}. Begin with what serves the collective, not the individual.`,
				`The path to "${wish}" requires patience and ${values[1]}. Listen deeply before you build.`,
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
		// Clear Glass Bead Game advisors when closing the ritual
		AdvisorOperations.clearGlassBeadGameAdvisors();
		// Reset Glass Bead Game completion flag
		glassBeadGameComplete = false;
		// Keep the ritual session data for potential reuse
	}

	// Load history data from holosphere
	async function loadHistoryData() {
		if (!holosphere || !holonID) return;
		
		// Fetch with timeout function
		const fetchWithTimeout = async (promise: Promise<any>, timeoutMs: number = 5000) => {
			const timeoutPromise = new Promise((_, reject) => 
				setTimeout(() => reject(new Error('Timeout')), timeoutMs)
			);
			return Promise.race([promise, timeoutPromise]);
		};
		
		try {
			// Load previous values
			const valuesData = await fetchWithTimeout(holosphere.get(holonID, "ritual_previous_values", holonID), 2000);
			if (valuesData && Array.isArray(valuesData)) {
				previousValues = [...new Set(valuesData)]; // Remove duplicates
			}
		} catch (error) {
			console.log('No previous values found');
		}
		
		// Load previous advisors using centralized operations
		await AdvisorOperations.loadPreviousAdvisorsFromHoloSphere(holosphere, holonID);
	}

	// Save history data to holosphere
	async function saveHistoryData() {
		if (!holosphere || !holonID) return;
		
		try {
			// Save values history
			if (previousValues.length > 0) {
				await holosphere.put(holonID, "ritual_previous_values", previousValues);
			}
			
			// Save advisors history using centralized operations
			await AdvisorOperations.savePreviousAdvisorsToHoloSphere(holosphere, holonID);
		} catch (error) {
			console.error('Error saving history data:', error);
		}
	}

	// Create new holon from ritual using modular function
	async function createHolonFromRitual() {
		if (!ritualSession.wish_statement.trim()) return;
		
		try {
			const newHolonID = await createHolonFromRitualUtil(holosphere, ritualSession as RitualSession, holonID);
			
			// Navigate to new holon
			window.location.href = `/${newHolonID}`;
			
		} catch (error) {
			console.error('Error creating holon from ritual:', error);
		}
	}
	// Temporary: Open Council Dialogue Stage
	function openCouncilDialogue() {
		console.log('Opening Council Dialogue stage...');
		
		// Set up ritual session data for council dialogue
		ritualSession = {
			session_id: `temp-dialogue-${Date.now()}`,
			initiator: { name: 'Test User', intention: 'Explore council dialogue' },
			declared_values: ['Innovation', 'Collaboration', 'Wisdom'],
			advisors: [], // Will be populated from actual ritual session
			wish_statement: 'Create a sustainable future through collaborative innovation',
			council_dialogue: [],
			design_streams: [],
			ritual_artifact: {
				format: 'scroll',
				text: '',
				quotes: {},
				ascii_glyph: ''
			}
		};
		
		// Set stage to Council Dialogue (stage 3)
		ritualStage = 3;
		showRitual = true;
		// Reset Glass Bead Game completion flag for new dialogue
		glassBeadGameComplete = false;
	}

	// Temporary: Open Design Streams Stage
	function openDesignStreams() {
		console.log('Opening Design Streams stage...');
		console.log('Current showDesignStreams:', showDesignStreams);
		
		// Pre-load HoloSphere advisors for lookup
		preloadHoloSphereAdvisors(holosphere, holonID);
		
		showDesignStreams = true;
		console.log('Set showDesignStreams to true');
		
		// Build metatron advisors list from circle inputs
		metatronAdvisors = [];
		for (let position = 0; position < 9; position++) {
			const memberName = circleInputs[position];
			if (memberName && !matchesCenterSummonLabel(memberName)) {
				// Use the exact advisor name from circleInputs to ensure consistency
				// Get full advisor using centralized lookup
				const fullAdvisor = resolveAdvisor(memberName);
				
				if (fullAdvisor) {
					// Use the exact name from circleInputs, not from fullAdvisor.name
					// This ensures consistency with converseWithAdvisor function
					metatronAdvisors.push({
						name: memberName, // Use the exact name from circleInputs
						type: fullAdvisor.type,
						lens: fullAdvisor.lens
					});
				} else {
					// Error: Advisor not found
					console.error(`❌ Advisor lookup failed for "${memberName}"`);
					alert(`Error: Could not find advisor "${memberName}" in the advisor library. Please check the advisor name and try again, or create the advisor first.`);
					return;
				}
			}
		}
	}

	// Load previous rituals
	async function loadPreviousRituals() {
		if (!holosphere || !holonID) return;
		
		const fetchWithTimeout = async (promise: Promise<any>, timeoutMs: number = 5000) => {
			const timeoutPromise = new Promise((_, reject) => 
				setTimeout(() => reject(new Error('Timeout')), timeoutMs)
			);
			return Promise.race([promise, timeoutPromise]);
		};
		
		try {
			const ritualsData = await fetchWithTimeout(holosphere.get(holonID, "previous_rituals", holonID), 2000);
			if (ritualsData && Array.isArray(ritualsData)) {
				previousRituals = ritualsData;
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
	onMount(async () => {
		console.log('Council component mounted');
		
		// Initialize LLM service
		try {
			llmService = new LLMService();
			console.log('LLM service initialized successfully');
		} catch (error) {
			console.error('Failed to initialize LLM service:', error);
			// Set a flag to show LLM is unavailable
			llmService = null;
		}
		
		// Get holon ID from route
		holonID = $page.params.id || '';
		console.log('Holon ID:', holonID);
		
		if (holonID && holosphere) {
			try {
				// Subscribe to council data
				const councilDataSub = await holosphere.subscribe(holonID, "council_data", (data: any) => {
					console.log('Council data updated:', data);
					if (data) {
						councilData = data;
					}
				});
				
				// Subscribe to advisor data
				const advisorDataSub = await holosphere.subscribe(holonID, "council_advisors", (data: any) => {
					console.log('Advisor data updated:', data);
					if (data) {
						circleInputs = { ...circleInputs, ...data };
					}
				});
				
				// Subscribe to Holonic Ecosystem Council data
				const aiCouncilSub = await holosphere.subscribe(holonID, "HOLONIC_ECOSYSTEM_COUNCIL", (data: any) => {
					console.log('Holonic Ecosystem Council data updated:', data);
					if (data) {
						circleInputs = { ...circleInputs, ...data };
						HolonicEcosystemCouncilSummoned = true;
					}
				});
				
				// Load initial data
				const [councilDataResult, advisorDataResult, aiCouncilDataResult] = await Promise.all([
					holosphere.get(holonID, "council_data", holonID),
					holosphere.get(holonID, "council_advisors", holonID),
					holosphere.get(holonID, "HOLONIC_ECOSYSTEM_COUNCIL", holonID)
				]);
				
				if (councilDataResult) {
					councilData = councilDataResult;
				}
				
				if (advisorDataResult) {
					circleInputs = { ...circleInputs, ...advisorDataResult };
				}
				
				if (aiCouncilDataResult) {
					circleInputs = { ...circleInputs, ...aiCouncilDataResult };
					HolonicEcosystemCouncilSummoned = true;
					
					// Convert loaded circle inputs to advisors and store in centralized state
					const advisors = AdvisorOperations.convertCircleInputsToAdvisors(aiCouncilDataResult);
					advisors.forEach(advisor => {
						AdvisorOperations.addAdvisorToRitual(advisor);
					});
					console.log('🔍 Loaded Holonic Ecosystem Council advisors:', advisors.map(a => a.name));
				}
				
				connectionReady = true;
				isLoading = false;
				
				// Load holon advisors
				await loadHolonAdvisors();
				
			} catch (error) {
				console.error('Error loading council data:', error);
				isLoading = false;
			}
		} else {
			isLoading = false;
		}
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

	// Select previous value
	function selectPreviousValue(value: string) {
		if (!ritualSession.declared_values.includes(value) && ritualSession.declared_values.length < 6) {
			ritualSession.declared_values = [...ritualSession.declared_values, value];
		}
	}

	// Select previous advisor
	function selectPreviousAdvisor(advisor: any) {
		if (ritualSession.advisors.length < 6) {
			const advisorExists = ritualSession.advisors.some(a => 
				a.name === advisor.name && a.lens === advisor.lens
			);
			if (!advisorExists) {
				ritualSession.advisors = [...ritualSession.advisors, advisor];
			}
		}
	}

	// Holonic Ecosystem Council state
	let HolonicEcosystemCouncilSummoned = false;

	// User context for council interactions
	let userContext: UserContext = {
		user_profile: {
			interests: [],
			values: [],
			current_challenges: [],
			goals: [],
			conversation_history: [],
			preferred_council_members: [],
			avoided_topics: [],
			communication_style: 'Direct'
		},
		session_context: {
			current_topic: '',
			session_start_time: new Date().toISOString(),
			council_members_present: [],
			conversation_flow: 'initial',
			user_emotional_state: 'curious',
			urgency_level: 5
		}
	};

	// LLM service for council interactions
	let llmService: LLMService | null = null;

	async function generateCouncilResponse(userMessage: string): Promise<string> {
		if (!llmService) {
			console.warn('LLM service not available for council response');
			return "The council is momentarily unavailable. Please try again.";
		}

		// Get the current council members using centralized advisor operations
		let councilMembers = AdvisorOperations.getCouncilChatAdvisors();
		
		// If no advisors from Glass Bead Game or ritual, try to convert from circle inputs
		if (councilMembers.length === 0) {
			councilMembers = AdvisorOperations.convertCircleInputsToAdvisors(circleInputs);
			console.log('🔍 Converted circle inputs to advisors:', councilMembers.map(a => a.name));
		}

		// Assign colors to council members if not already assigned
		if (Object.keys(councilMemberColors).length === 0) {
			assignCouncilMemberColors(councilMembers);
		}

		// Analyze user message to determine which characters should respond
		const respondingMembers = analyzeUserMessage(userMessage, councilMembers);
		
		// Update user context with current session info
		userContext.session_context.current_topic = userMessage;
		userContext.session_context.council_members_present = councilMembers.map(m => m.name.split(',')[0].trim());
		
		// Create conversation flow context
		const conversationFlow: ConversationFlowContext = {
			present_members: councilMembers.map(m => m.name.split(',')[0].trim()),
			conversation_topic: userMessage,
			previous_responses: councilChatMessages.filter(m => m.role === 'assistant').map(m => m.content),
			user_interests: userContext.user_profile.interests,
			appropriate_responding_members: respondingMembers.map(m => m.name.split(',')[0].trim())
		};

		// Create the complete kaleidoscope context
		const systemPrompt = createCouncilContext(userContext, respondingMembers, conversationFlow, userMessage);

		try {
			// Send to LLM with the complete context
			const response = await llmService.sendMessage([
				{ role: 'system', content: systemPrompt },
				{ role: 'user', content: userMessage }
			]);

			// Update conversation history
			userContext.user_profile.conversation_history.push({
				timestamp: new Date().toISOString(),
				topic: userMessage,
				user_message: userMessage,
				council_response: response.content,
				responding_members: respondingMembers.map(m => m.name.split(',')[0].trim())
			});

			return response.content;
		} catch (error) {
			console.error('Error generating council response:', error);
			return "The council is momentarily silent. Please try again.";
		}
	}

	async function addImmediateAdvisorIntroduction(advisor: CouncilAdvisorExtended) {
		// Generate immediate introduction based on advisor type and characteristics
		let stageDirections = '';
		let introduction = '';
		
		// Generate stage directions based on advisor type
		if (advisor.type === 'archetype') {
			const archetypeSpec = advisor.characterSpec as any;
			stageDirections = `[${archetypeSpec.appearance || 'appears with a commanding presence'}]`;
		} else if (advisor.type === 'real') {
			const realSpec = advisor.characterSpec as any;
			stageDirections = `[${realSpec.speaking_style || 'steps forward with measured grace'}]`;
		} else if (advisor.type === 'mythic') {
			const mythicSpec = advisor.characterSpec as any;
			stageDirections = `[${mythicSpec.speaking_style || 'materializes with ethereal grace'}]`;
		} else {
			stageDirections = '[appears with a gentle presence]';
		}
		
		// Generate introduction based on advisor characteristics
		const cleanName = advisor.name.split(',')[0].trim();
		introduction = `Greetings, seeker. I am ${cleanName}, and I bring the wisdom of ${advisor.lens} to our conversation. What question or concern brings you to seek my counsel today?`;
		
		const introMessage: typeof advisorChatMessages[0] = {
			role: 'assistant' as const,
			content: `${stageDirections} ${introduction}`,
			displayContent: '',
			isTyping: true,
			timestamp: new Date(),
			advisor: advisor.name
		};

		advisorChatMessages = [...advisorChatMessages, introMessage];
		await typeMessage(introMessage, 'advisor');
	}

	async function generateIndividualAdvisorResponse(userMessage: string): Promise<string> {
		if (!llmService) {
			console.warn('LLM service not available for individual advisor response');
			return "I am momentarily unavailable. Please try again.";
		}
		
		if (!selectedAdvisorForChat) {
			console.warn('No advisor selected for individual chat');
			return "Please select an advisor to chat with.";
		}

		// Create a focused context for the individual advisor using centralized function
		const advisorContext = createIndividualAdvisorContext(selectedAdvisorForChat, userMessage);

		try {
			// Send to LLM with the advisor context
			const response = await llmService.sendMessage([
				{ role: 'system', content: advisorContext },
				{ role: 'user', content: userMessage }
			]);

			return response.content;
		} catch (error) {
			console.error('Error generating advisor response:', error);
			return "I am momentarily silent. Please try again.";
		}
	}

	// Council chat state
	let showCouncilChat = false;
	// Track if Glass Bead Game has completed to switch to single-advisor responses
	let glassBeadGameComplete = false;
	// Color assignment for council members in current chat session
	let councilMemberColors: Record<string, string> = {};
	let colorIndex = 0;
	const councilColors = [
		'bg-slate-700', 'bg-slate-600', 'bg-gray-700', 'bg-gray-600', 
		'bg-zinc-700', 'bg-zinc-600', 'bg-neutral-700', 'bg-neutral-600'
	];

	let councilChatMessages: Array<{
		role: 'user' | 'assistant';
		content: string;
		displayContent?: string;
		isTyping?: boolean;
		timestamp: Date;
		advisor?: string;
		speaker?: string;
		speakerColor?: string;
	}> = [];
	let currentCouncilMessage = '';
	let isCouncilResponding = false;

	async function summonholonicecosystemcouncil() {
		// Get Omnia for the head position (top)
		const omnia = getAdvisor('omnia');
		const randomMembers = getRandomHolonicEcosystemCouncilMembers(true); // Exclude Omnia from random selection
		
		// Debug: Log what advisors were selected
		console.log('🔍 Summoning Holonic Ecosystem Council - Debug:');
		console.log('Omnia:', omnia?.name);
		console.log('Random members selected:', randomMembers.map(m => ({ name: m.name, type: m.type })));
		
		if (omnia) {
			// Extract just the first part of the name (before the comma)
			const getCleanName = (fullName: string) => {
				return fullName.split(',')[0].trim();
			};
			
			// Set Omnia at the head of the table (top position)
			circleInputs['outer-top'] = getCleanName(omnia.name);
			
			// Populate the remaining 5 outer positions with random members
			const outerPositions = ['outer-top-right', 'outer-bottom-right', 'outer-bottom', 'outer-bottom-left', 'outer-top-left'];
			randomMembers.forEach((member, index) => {
				if (index < outerPositions.length) {
					circleInputs[outerPositions[index]] = getCleanName(member.name);
				}
			});
			
			// Set the center circle to the unified summon label
			circleInputs['center'] = CENTER_SUMMON_LABEL;
			HolonicEcosystemCouncilSummoned = true;
			
			// Convert circle inputs to ritual advisors and store in centralized state
			const allAdvisors = [omnia, ...randomMembers];
			allAdvisors.forEach(advisor => {
				AdvisorOperations.addAdvisorToRitual(advisor);
			});
			
			// Save to HoloSphere
			if (holosphere && holonID) {
				holosphere.put(holonID, "HOLONIC_ECOSYSTEM_COUNCIL", circleInputs);
			}
			
			console.log('Holonic Ecosystem Council summoned:', { 
				omnia: getCleanName(omnia.name), 
				members: randomMembers.map(m => getCleanName(m.name)) 
			});
		}
	}

	// Assign colors to council members for the current chat session
	function assignCouncilMemberColors(members: CouncilAdvisorExtended[]) {
		councilMemberColors = {};
		colorIndex = 0;
		
		members.forEach(member => {
			const cleanName = member.name.split(',')[0].trim();
			if (!councilMemberColors[cleanName]) {
				councilMemberColors[cleanName] = councilColors[colorIndex % councilColors.length];
				colorIndex++;
			}
		});
		
		console.log('Assigned colors to council members:', councilMemberColors);
	}

	function closeCouncilChat() {
		showCouncilChat = false;
		// Clear Glass Bead Game advisors when closing the chat
		AdvisorOperations.clearGlassBeadGameAdvisors();
	}

	function closeAdvisorChat() {
		showAdvisorChat = false;
		selectedAdvisorForChat = null;
		advisorChatSource = null;
		advisorChatMessages = [];
	}

	function handleAdvisorChatBack() {
		if (advisorChatSource === 'design-streams') {
			// Go back to Design Streams
			showAdvisorChat = false;
			selectedAdvisorForChat = null;
			advisorChatSource = null;
			showDesignStreams = true; // Reopen Design Streams page
		} else {
			// Go back to main council (close the chat)
			closeAdvisorChat();
		}
	}

	function closeCircleSelectionModal() {
		showCircleSelectionModal = false;
		selectedCircleForAction = null;
	}

	async function converseWithAdvisor() {
		if (!selectedCircleForAction) return;
		
		// Pre-load HoloSphere advisors for lookup
		await preloadHoloSphereAdvisors(holosphere, holonID);
		
		const advisorName = circleInputs[selectedCircleForAction];
		const fullAdvisor = resolveAdvisor(advisorName);
		
		if (fullAdvisor) {
			selectedAdvisorForChat = fullAdvisor;
			advisorChatSource = 'main-council';
			showAdvisorChat = true;
			advisorChatMessages = []; // Clear previous messages for consistency
			
			// Add immediate introduction message
			await addImmediateAdvisorIntroduction(fullAdvisor);
		} else {
			// Error: Advisor not found
			console.error(`❌ Advisor lookup failed for "${advisorName}"`);
			alert(`Error: Could not find advisor "${advisorName}" in the advisor library. Please check the advisor name and try again, or create the advisor first.`);
			return;
		}
		
		closeCircleSelectionModal();
	}

	function changeAdvisor() {
		if (!selectedCircleForAction) return;
		
		// For now, just open the editing interface
		editingCircle = selectedCircleForAction;
		if (!circleInputs[selectedCircleForAction]) {
			circleInputs[selectedCircleForAction] = '';
		}
		
		closeCircleSelectionModal();
	}

	async function sendAdvisorMessage(userMessage: string) {
		if (!selectedAdvisorForChat || isAdvisorResponding) return;

		isAdvisorResponding = true;

		try {
			// Generate advisor response using LLM with stage directions
			const advisorResponse = await generateIndividualAdvisorResponse(userMessage);
			
			const aiMessage: typeof advisorChatMessages[0] = {
				role: 'assistant' as const,
				content: advisorResponse,
				displayContent: '',
				isTyping: true,
				timestamp: new Date(),
				advisor: selectedAdvisorForChat.name
			};
			
			advisorChatMessages = [...advisorChatMessages, aiMessage];
			await typeMessage(aiMessage, 'advisor');
			
		} catch (error) {
			console.error('Error generating advisor response:', error);
			const errorMessage: typeof advisorChatMessages[0] = {
				role: 'assistant' as const,
				content: 'I am momentarily silent. Please try again.',
				displayContent: '',
				isTyping: true,
				timestamp: new Date(),
				advisor: selectedAdvisorForChat?.name || 'Advisor'
			};
			
			advisorChatMessages = [...advisorChatMessages, errorMessage];
			await typeMessage(errorMessage, 'advisor');
		} finally {
			isAdvisorResponding = false;
		}
	}

	// Unified typing function that works for both council and advisor messages
	async function typeMessage(message: any, chatType: 'council' | 'advisor', delayMs: number = 3.75) {
		message.isTyping = true;
		message.displayContent = '';
		
		// Update the appropriate message array
		if (chatType === 'council') {
			councilChatMessages = [...councilChatMessages];
		} else if (chatType === 'advisor') {
			advisorChatMessages = [...advisorChatMessages];
		}
		
		for (let i = 0; i < message.content.length; i++) {
			message.displayContent += message.content[i];
			
			// Update the appropriate message array
			if (chatType === 'council') {
				councilChatMessages = [...councilChatMessages];
			} else if (chatType === 'advisor') {
				advisorChatMessages = [...advisorChatMessages];
			}
			
			await new Promise(resolve => setTimeout(resolve, delayMs));
		}
		
		message.isTyping = false;
		
		// Final update to the appropriate message array
		if (chatType === 'council') {
			councilChatMessages = [...councilChatMessages];
		} else if (chatType === 'advisor') {
			advisorChatMessages = [...advisorChatMessages];
		}
	}

	// Parse structured council response and create individual speaker messages
	// NOTE: This function is no longer used - replaced with individual advisor calls
	function parseCouncilResponse(response: string): Array<{
		speaker: string;
		content: string;
		stageDirections?: string;
	}> {
		const speakers: Array<{speaker: string; content: string; stageDirections?: string}> = [];
		
		// Split by speaker pattern (e.g., "Speaker Name: content")
		const speakerPattern = /^([^:]+):\s*(.+)$/gm;
		let match;
		
		while ((match = speakerPattern.exec(response)) !== null) {
			const speaker = match[1].trim();
			let content = match[2].trim();
			
			// Extract stage directions if present
			let stageDirections = '';
			const stageDirectionPattern = /^\[([^\]]+)\]\s*(.+)$/;
			const stageMatch = content.match(stageDirectionPattern);
			
			if (stageMatch) {
				stageDirections = stageMatch[1];
				content = stageMatch[2];
			}
			
			speakers.push({
				speaker,
				content,
				stageDirections
			});
		}
		
		return speakers;
	}

	async function sendCouncilMessage(userMessage: string) {
		if (isCouncilResponding) return;

		isCouncilResponding = true;

		try {
			// Get advisors from ritual session only (no fallback to circle inputs)
			const ritualAdvisors = AdvisorOperations.getRitualAdvisors();
			
			if (ritualAdvisors.length === 0) {
				throw new Error('No ritual advisors available for council chat');
			}
			
			if (glassBeadGameComplete) {
				// After GBG completion: single advisor response from ritual advisors
				const selectedAdvisors = analyzeUserMessage(userMessage, ritualAdvisors);
				const respondingAdvisor = selectedAdvisors.length > 0 ? selectedAdvisors[0] : ritualAdvisors[0];
				
				// Create single advisor context and send one LLM call
				const advisorContext = createIndividualAdvisorContext(respondingAdvisor, userMessage);
				const response = await llmService!.sendMessage([
					{ role: 'system', content: advisorContext },
					{ role: 'user', content: userMessage }
				]);
				
				const advisorMessage: typeof councilChatMessages[0] = {
					role: 'assistant' as const,
					content: response.content,
					displayContent: '',
					isTyping: true,
					timestamp: new Date(),
					speaker: respondingAdvisor.name,
					speakerColor: getAdvisorColor(0)
				};
				
				councilChatMessages = [...councilChatMessages, advisorMessage];
				await typeMessage(advisorMessage, 'council');
			} else {
				// During GBG: sequential multi-advisor dialogue
				await generateCouncilDialogueSequence(ritualAdvisors, userMessage);
			}
			
		} catch (error) {
			console.error('Error generating council response:', error);
			const errorMessage: typeof councilChatMessages[0] = {
				role: 'assistant' as const,
				content: 'The council is momentarily silent. Please try again.',
				displayContent: '',
				isTyping: true,
				timestamp: new Date(),
				advisor: 'Council'
			};
			
			councilChatMessages = [...councilChatMessages, errorMessage];
			await typeMessage(errorMessage, 'council');
		} finally {
			isCouncilResponding = false;
		}
	}

	// Individual advisor chat state
	let showAdvisorChat = false;
	let selectedAdvisorForChat: CouncilAdvisorExtended | null = null;
	let advisorChatSource: 'design-streams' | 'main-council' | null = null; // Track where the chat was opened from
	let advisorChatMessages: Array<{
		role: 'user' | 'assistant';
		content: string;
		displayContent?: string;
		isTyping?: boolean;
		timestamp: Date;
		advisor?: string;
	}> = [];
	let isAdvisorResponding = false;
	
	// Advisor state is now managed centrally through AdvisorOperations



	// Test function to verify HoloSphere advisor integration
	async function testHoloSphereAdvisorIntegration() {
		if (!holosphere || !holonID) {
			console.error("Cannot test: holosphere or holonID is null");
			return;
		}

		try {
			console.log("Testing HoloSphere advisor integration...");
			
			// Test 1: Put an advisor to HoloSphere
			const testAdvisor = getAdvisor('omnia');
			if (testAdvisor) {
				await putAdvisorToHoloSphere(holosphere, holonID, testAdvisor, 'QBFRANK');
				console.log("✅ Successfully put advisor to HoloSphere");
			}

			// Test 2: Get advisors from HoloSphere
			const holosphereAdvisors = await getAdvisorsFromHoloSphere(holosphere, holonID);
			console.log("✅ Retrieved advisors from HoloSphere:", holosphereAdvisors.length);

			// Test 3: Get all advisors (static + HoloSphere)
			const allAdvisors = await getAllAdvisors(holosphere, holonID);
			console.log("✅ Retrieved all advisors:", allAdvisors.length);

			console.log("🎉 All HoloSphere advisor integration tests passed!");
		} catch (error) {
			console.error("❌ Error testing HoloSphere advisor integration:", error);
		}
	}

	// Debug Design Streams
	$: if (showDesignStreams) {
		console.log('showDesignStreams changed to true');
		console.log('ritualSession.advisors:', ritualSession.advisors);
	}

	async function handleDesignStreamsAdvisorChat(event: CustomEvent) {
		const simpleAdvisor = event.detail.advisor;
		
		// Pre-load HoloSphere advisors for lookup
		await preloadHoloSphereAdvisors(holosphere, holonID);
		
		// Use the same approach as converseWithAdvisor for consistency
		// First try to get the full advisor using centralized lookup
		const fullAdvisor = resolveAdvisor(simpleAdvisor.name);
		
		if (fullAdvisor) {
			selectedAdvisorForChat = fullAdvisor;
			advisorChatSource = 'design-streams';
			showDesignStreams = false; // Close Design Streams page
			showAdvisorChat = true; // Open AI chat modal
			advisorChatMessages = []; // Clear previous messages
			
			// Add immediate introduction
			await addImmediateAdvisorIntroduction(fullAdvisor);
		} else {
			// Error: Advisor not found
			console.error(`❌ Advisor lookup failed for "${simpleAdvisor.name}"`);
			alert(`Error: Could not find advisor "${simpleAdvisor.name}" in the advisor library. Please check the advisor name and try again, or create the advisor first.`);
			return;
		}
	}

	// Holonic pattern: Handle ritual data updates from Design Streams
	function handleRitualDataUpdate(event: CustomEvent) {
		const { type, value } = event.detail;
		
		if (type === 'wish_statement') {
			ritualSession.wish_statement = value;
		} else if (type === 'declared_values') {
			ritualSession.declared_values = value;
		}
		
		// Update the ritual session reactively
		ritualSession = { ...ritualSession };
		
		console.log('Ritual data updated:', { type, value });
	}
</script>

<!-- svelte-ignore css_unused_selector -->
<!-- svelte-ignore css_unused_selector -->
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
									on:keydown={(e) => e.key === 'Enter' && startEditingCircle(circle.id)}
									role="button"
									tabindex="0"
								>
									{#if circleInputs[circle.id]}
										<span class="label-text select-none">
											{circleInputs[circle.id]}
										</span>
									{/if}
								</div>
							{/each}
						</div>

						<!-- Ritual Buttons -->
						<div class="flex justify-center gap-4 mt-8">
							<button 
								on:click={summonholonicecosystemcouncil}
								class="group relative bg-gray-800 hover:bg-gray-700 border-2 border-green-500/50 hover:border-green-400 text-white py-6 px-8 rounded-3xl transition-all duration-300 flex items-center justify-center gap-4 text-lg font-medium shadow-2xl hover:shadow-green-500/25 backdrop-blur-sm"
							>
								<div class="w-10 h-10 rounded-full bg-green-600 flex items-center justify-center text-xl group-hover:bg-green-500 transition-colors duration-300">
									🎭
								</div>
								Summon Holonic Ecosystem Council
								<div class="absolute inset-0 bg-gradient-to-r from-green-500/10 to-emerald-500/10 opacity-0 group-hover:opacity-100 rounded-3xl transition-opacity duration-300"></div>
							</button>
							
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


							<!-- Temporary: Council Dialogue Button -->
							<button 
								on:click={() => openCouncilDialogue()}
								class="group relative bg-gray-800 hover:bg-gray-700 border-2 border-blue-500/50 hover:border-blue-400 text-white py-6 px-8 rounded-3xl transition-all duration-300 flex items-center justify-center gap-4 text-lg font-medium shadow-2xl hover:shadow-blue-500/25 backdrop-blur-sm"
							>
								<div class="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-xl group-hover:bg-blue-500 transition-colors duration-300">
									🔍
								</div>
								Council Dialogue
								<div class="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-indigo-500/10 opacity-0 group-hover:opacity-100 rounded-3xl transition-opacity duration-300"></div>
							</button>

							<!-- Temporary: Design Streams Button -->
							<button 
								on:click={() => { console.log('Design Streams button clicked'); openDesignStreams(); }}
								class="group relative bg-gray-800 hover:bg-gray-700 border-2 border-purple-500/50 hover:border-purple-400 text-white py-6 px-8 rounded-3xl transition-all duration-300 flex items-center justify-center gap-4 text-lg font-medium shadow-2xl hover:shadow-purple-500/25 backdrop-blur-sm"
							>
								<div class="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center text-xl group-hover:bg-purple-500 transition-colors duration-300">
									🛠
								</div>
								Design Streams
								<div class="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-pink-500/10 opacity-0 group-hover:opacity-100 rounded-3xl transition-opacity duration-300"></div>
							</button>
						</div>

						<!-- Interactive Circle Input Overlay -->
						{#if editingCircle}
							<div class="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
								<div class="bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md relative border border-gray-700">
									<div class="p-6">
										<div class="flex items-center justify-between mb-6">
											<h3 class="text-white text-xl font-bold">Edit Advisor: {editingCircle}</h3>
											<!-- svelte-ignore a11y_consider_explicit_label -->
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
												<!-- svelte-ignore a11y_label_has_associated_control -->
												<label class="block text-gray-300 text-sm font-medium mb-2">
													Enter advisor name:
												</label>
												<input
													type="text"
													bind:value={circleInputs[editingCircle]}
													placeholder="Enter advisor name..."
													class="w-full bg-gray-700 border border-gray-600 rounded-xl px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
													on:keydown={(e) => {
														if (e.key === 'Enter' && editingCircle) {
															saveCircleInput(editingCircle);
														} else if (e.key === 'Escape') {
															cancelCircleInput();
														}
													}}
													use:focusOnMount
												/>
											</div>
											
											<div class="flex gap-3">
												<button
													on:click={() => editingCircle && saveCircleInput(editingCircle)}
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
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div 
		class="fixed inset-0 z-50 overflow-auto bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
		on:keydown={(e) => e.key === 'Escape' && closeMemberModal()}
	>
		<div class="bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md relative border border-gray-700">
			<div class="p-6">
				<div class="flex items-center justify-between mb-6">
					<h3 class="text-white text-xl font-bold">Member Details</h3>
					<!-- svelte-ignore a11y_consider_explicit_label -->
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

<!-- Circle Selection Modal -->
{#if showCircleSelectionModal && selectedCircleForAction}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div 
		class="fixed inset-0 z-50 overflow-auto bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
		on:keydown={(e) => e.key === 'Escape' && closeCircleSelectionModal()}
	>
		<div class="bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md relative border border-gray-700">
			<div class="p-6">
				<div class="flex items-center justify-between mb-6">
					<h3 class="text-white text-xl font-bold">Choose Action</h3>
					<!-- svelte-ignore a11y_consider_explicit_label -->
					<button
						on:click={closeCircleSelectionModal}
						class="text-gray-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-gray-700"
					>
						<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
						</svg>
					</button>
				</div>
				
				<div class="space-y-4">
					<div class="text-center mb-6">
						<div class="w-16 h-16 rounded-full bg-indigo-600 flex items-center justify-center text-2xl mx-auto mb-3">
							🧙‍♀️
						</div>
						<h4 class="text-white font-bold text-lg">{circleInputs[selectedCircleForAction]}</h4>
						<p class="text-gray-400 text-sm">Select an action for this advisor</p>
					</div>
					
					<div class="space-y-3">
						<button
							on:click={converseWithAdvisor}
							class="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 px-4 rounded-xl transition-colors flex items-center justify-center gap-3"
						>
							<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path>
							</svg>
							Converse with {circleInputs[selectedCircleForAction]}
						</button>
						
						<button
							on:click={changeAdvisor}
							class="w-full bg-gray-600 hover:bg-gray-700 text-white py-3 px-4 rounded-xl transition-colors flex items-center justify-center gap-3"
						>
							<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
							</svg>
							Change
						</button>
					</div>
				</div>
			</div>
		</div>
	</div>
{/if}

<!-- Ritual Interface Modal -->
{#if showRitual}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div 
		class="fixed inset-0 z-50 overflow-auto bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
		on:keydown={(e) => {
			if (e.key === 'Escape') {
				closeRitual();
			} else if (e.key === 'Enter' && !e.shiftKey) {
				// Only trigger Next if we're not in a text input/textarea
				const target = e.target as HTMLElement;
				if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
					e.preventDefault();
					// Check if Next button is enabled
					const nextButton = document.querySelector('[data-next-button]') as HTMLButtonElement;
					if (nextButton && !nextButton.disabled) {
						nextStage();
					}
				}
			}
		}}
	>
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
					<!-- svelte-ignore a11y_consider_explicit_label -->
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
			<div class="p-8 min-h-[400px] max-h-[70vh] overflow-y-auto">
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
							<!-- svelte-ignore a11y_label_has_associated_control -->
							<label class="block text-gray-300 text-lg font-medium">Speak your wish. What do you seek to bring into being?</label>
							<textarea
								bind:value={ritualSession.wish_statement}
								placeholder="I wish to create..."
								class="w-full bg-gray-700 border border-gray-600 rounded-xl px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent min-h-[120px] resize-none"
								on:keydown={(e) => {
									if (e.key === 'Enter' && !e.shiftKey) {
										e.preventDefault();
										// If wish is filled, trigger Next button
										if (ritualSession.wish_statement.trim()) {
											const nextButton = document.querySelector('[data-next-button]') as HTMLButtonElement;
											if (nextButton && !nextButton.disabled) {
												nextStage();
											}
										}
									}
								}}
								use:focusOnMount
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
							<div class="text-sm text-gray-400 mt-2">
								{ritualSession.declared_values.length}/6 values
							</div>
						</div>
						
						<div class="flex gap-4 mb-6">
							<input
								bind:value={currentValue}
								placeholder="Enter a core value..."
								class="flex-1 bg-gray-700 border border-gray-600 rounded-xl px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
								on:keydown={(e) => {
									if (e.key === 'Enter') {
										e.preventDefault();
										if (currentValue.trim() && ritualSession.declared_values.length < 6) {
											addValue();
											// Focus back on input field for next value
											setTimeout(() => {
												const input = e.target as HTMLInputElement;
												if (input) input.focus();
											}, 10);
										} else if (ritualSession.declared_values.length >= 6) {
											// If we have 6 values, trigger Next button
											const nextButton = document.querySelector('[data-next-button]') as HTMLButtonElement;
											if (nextButton && !nextButton.disabled) {
												nextStage();
											}
										}
									}
								}}
								use:focusOnMount
							/>
							<button
								on:click={addValue}
								disabled={!currentValue.trim() || ritualSession.declared_values.length >= 6}
								class="group relative bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 disabled:from-gray-600 disabled:to-gray-600 text-white px-8 py-3 rounded-xl transition-all duration-200 font-medium shadow-lg hover:shadow-xl disabled:hover:shadow-lg transform hover:scale-105 disabled:hover:scale-100"
							>
								{ritualSession.declared_values.length >= 6 ? 'Max Values (6)' : 'Add Value'}
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
							<p class="text-center text-gray-400 italic">Add 3-6 values that will guide your manifestation...</p>
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
											placeholder="e.g., Donella Meadows"
										class="w-full bg-gray-600 border border-gray-500 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
										on:keydown={(e) => {
											if (e.key === 'Enter') {
												e.preventDefault();
												// Move focus to lens input if name is filled
												if (currentAdvisorName.trim()) {
													const lensInput = document.querySelector('input[placeholder="e.g., deep ecology"]') as HTMLInputElement;
													if (lensInput) lensInput.focus();
												}
											}
										}}
										use:focusOnMount
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
										on:keydown={(e) => {
											if (e.key === 'Enter') {
												e.preventDefault();
												if (currentAdvisorName.trim() && currentAdvisorLens.trim() && ritualSession.advisors.length < 6) {
													addAdvisor();
													// Focus back on name input for next advisor
													setTimeout(() => {
														const nameInput = document.querySelector('input[placeholder="e.g., Joanna Macy"]') as HTMLInputElement;
														if (nameInput) nameInput.focus();
													}, 10);
												} else if (ritualSession.advisors.length >= 6) {
													// If we have 6 advisors, trigger Next button
													const nextButton = document.querySelector('[data-next-button]') as HTMLButtonElement;
													if (nextButton && !nextButton.disabled) {
														nextStage();
													}
												}
											}
										}}
									/>
								</div>
							</div>
							<button
								on:click={addAdvisor}
								disabled={!currentAdvisorName.trim() || !currentAdvisorLens.trim() || ritualSession.advisors.length >= 6 || isGeneratingAdvisor}
								class="group relative w-full bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 disabled:from-gray-600 disabled:to-gray-600 text-white py-4 rounded-xl transition-all duration-200 font-semibold shadow-lg hover:shadow-xl disabled:hover:shadow-lg transform hover:scale-105 disabled:hover:scale-100"
							>
								{#if isGeneratingAdvisor}
									<div class="flex items-center gap-3">
										<div class="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
										{generationProgress}
									</div>
								{:else}
									Summon Advisor
								{/if}
								<div class="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 disabled:opacity-0 rounded-xl transition-opacity duration-200"></div>
							</button>
						</div>
						
						
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

						<!-- Holon Advisors Management -->
						<div class="bg-gray-700 rounded-xl p-6">
							<div class="mb-4">
								<h4 class="text-gray-300 font-medium">Your Created Advisors:</h4>
							</div>
							{#if holonAdvisors.length > 0}
								<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
									{#each holonAdvisors as advisor}
										<div class="bg-gray-600 rounded-xl p-4 group hover:bg-gray-500 transition-colors">
											<div class="flex-1 mb-3">
												<h5 class="text-white font-bold">{advisor.name}</h5>
												<p class="text-gray-300 text-sm capitalize">{advisor.type}</p>
												<p class="text-gray-300 text-sm italic">"{advisor.lens}"</p>
											</div>
											<div class="flex gap-2">
												<button
													on:click={() => openAdvisorChat(advisor)}
													class="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2 px-3 rounded-lg text-sm transition-colors"
												>
													💬 Chat
												</button>
												<button
													on:click={() => deleteHolonAdvisor(advisor.name)}
													class="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 px-3 rounded-lg text-sm transition-colors"
												>
													🗑️ Discard
												</button>
												<button
													on:click={() => addAdvisorToRitual(advisor)}
													disabled={ritualSession.advisors.length >= 6 || ritualSession.advisors.some(a => a.name === advisor.name && a.lens === advisor.lens)}
													class="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-500 text-white py-2 px-3 rounded-lg text-sm transition-colors"
												>
													➕ Add to Ritual
												</button>
											</div>
										</div>
									{/each}
								</div>
							{:else}
								<p class="text-gray-400 text-sm italic">No advisors created yet. Use the form above to create your first advisor.</p>
							{/if}
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
										Assemble the Council!
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
					<div class="space-y-6 text-center">
						<div class="text-5xl mb-4">🛠</div>
						<h3 class="text-3xl font-bold text-white mb-4">Pathways Forward</h3>
						<p class="text-gray-300 text-lg">From wisdom comes action. Choose your path of manifestation.</p>
						
						<button
							on:click={() => { showDesignStreams = true; }}
							class="group relative bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white px-12 py-5 rounded-2xl transition-all duration-300 text-lg font-semibold shadow-xl hover:shadow-2xl transform hover:scale-105"
						>
							Open Design Streams
							<div class="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 rounded-2xl transition-opacity duration-300"></div>
						</button>
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
					data-next-button
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

<!-- Council Chat Modal -->
<AIChatModal 
	bind:isOpen={showCouncilChat}
	title="Council Chat"
	subtitle="Multi-member consultation in progress"
	icon="🎭"
	theme="indigo"
	messages={councilChatMessages}
	onClose={closeCouncilChat}
	onSend={sendCouncilMessage}
	placeholder="Ask the council for guidance..."
	disabled={isCouncilResponding}
	bind:isLoading={isCouncilResponding}
/>

<!-- Individual Advisor Chat Modal -->
<AIChatModal 
	bind:isOpen={showAdvisorChat}
	title={selectedAdvisorForChat?.name || "Advisor Chat"}
	subtitle="One-on-one consultation"
	icon="🧙‍♀️"
	theme="indigo"
	messages={advisorChatMessages}
	onClose={closeAdvisorChat}
	onSend={sendAdvisorMessage}
	placeholder="Ask your advisor for guidance..."
	disabled={isAdvisorResponding}
	bind:isLoading={isAdvisorResponding}
	onBack={advisorChatSource === 'design-streams' ? handleAdvisorChatBack : undefined}
/>

<!-- Design Streams Page -->
{#if showDesignStreams}
	<DesignStreams 
		advisors={holonAdvisors.filter(a => ritualSession.advisors.some(r => r.name === a.name && r.lens === a.lens))}
		ritualSession={ritualSession}
		onClose={() => { showDesignStreams = false; }}
		on:openAdvisorChat={handleDesignStreamsAdvisorChat}
		on:updateRitualData={handleRitualDataUpdate}
	/>
{/if}

