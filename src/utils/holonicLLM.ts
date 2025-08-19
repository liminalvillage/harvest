// Holonic LLM Integration Utilities
// Self-similar functions that work at any quest tree generation level

import type { QuestTree, QuestTreeNode } from '../types/questTree';
import type { CouncilAdvisorExtended } from '../types/advisor-schema';
import type { 
  HolonicLLMInput, 
  HolonicLLMResponse, 
  HolonicQuestNodeData,
  QuestTreeHierarchy,
  SiblingContext,
  GenerationWisdom
} from '../types/holonicLLM';

// ============================================================================
// HOLONIC CONTEXT BUILDERS: Self-Similar at All Scales
// ============================================================================

/**
 * Build complete ancestry chain from root to target node
 * Holonic principle: Shows how the part connects to the whole
 */
export function getAncestryChain(questTree: QuestTree, nodeId: string): QuestTreeNode[] {
  const ancestry: QuestTreeNode[] = [];
  let currentNode = questTree.nodes[nodeId];
  
  // Walk up the tree to build ancestry
  while (currentNode?.parentId) {
    const parent = questTree.nodes[currentNode.parentId];
    if (parent) {
      ancestry.unshift(parent); // Add to beginning to maintain order
      currentNode = parent;
    } else {
      break;
    }
  }
  
  return ancestry;
}

/**
 * Get sibling context at each generation level
 * Holonic principle: Show how parts relate to each other at each scale
 */
export function getSiblingContext(questTree: QuestTree, nodeId: string): SiblingContext[] {
  const ancestry = getAncestryChain(questTree, nodeId);
  const targetNode = questTree.nodes[nodeId];
  const siblingContext: SiblingContext[] = [];
  
  // Add sibling context for each generation in ancestry
  ancestry.forEach(ancestor => {
    if (ancestor.parentId) {
      const parent = questTree.nodes[ancestor.parentId];
      const siblings = parent.childIds
        .filter(id => id !== ancestor.id)
        .map(id => questTree.nodes[id])
        .filter(Boolean);
      
      if (siblings.length > 0) {
        siblingContext.push({
          generation: ancestor.generation,
          siblings: siblings.map(sibling => ({
            id: sibling.id,
            title: sibling.title,
            description: sibling.description,
            status: sibling.status
          }))
        });
      }
    }
  });
  
  // Add siblings of target node
  if (targetNode?.parentId) {
    const parent = questTree.nodes[targetNode.parentId];
    const siblings = parent.childIds
      .filter(id => id !== targetNode.id)
      .map(id => questTree.nodes[id])
      .filter(Boolean);
    
    if (siblings.length > 0) {
      siblingContext.push({
        generation: targetNode.generation,
        siblings: siblings.map(sibling => ({
          id: sibling.id,
          title: sibling.title,
          description: sibling.description,
          status: sibling.status
        }))
      });
    }
  }
  
  return siblingContext;
}

/**
 * Build complete hierarchical context for LLM
 * Holonic principle: Present the whole system while focusing on one part
 */
export function buildQuestTreeHierarchy(questTree: QuestTree, focusNodeId: string): QuestTreeHierarchy {
  const ancestry = getAncestryChain(questTree, focusNodeId);
  const siblings = getSiblingContext(questTree, focusNodeId);
  const focusNode = questTree.nodes[focusNodeId];
  
  return {
    ancestry: ancestry.map(node => ({
      generation: node.generation,
      id: node.id,
      title: node.title,
      description: node.description,
      status: node.status
    })),
    siblings,
    focusNode: {
      id: focusNode.id,
      title: focusNode.title,
      description: focusNode.description,
      generation: focusNode.generation,
      existingChildren: focusNode.childIds
    }
  };
}

// ============================================================================
// GENERATION WISDOM: Self-Similar Scaling Logic
// ============================================================================

const HOLONIC_GENERATION_WISDOM = {
  guidance: [
    "foundational domains that everything builds upon",
    "major phases or components needed to complete the parent quest", 
    "concrete work streams with clear deliverables",
    "specific tasks or milestones that can be completed in days/weeks",
    "granular action items with clear next steps",
    "immediate, actionable steps that can be started today"
  ],
  examples: [
    "'Establish Supply Chain', 'Build Community Support', 'Create Technical Infrastructure'",
    "'Research Suppliers', 'Design Partnership Framework', 'Develop Pilot Program'",
    "'Contact 5 Local Suppliers', 'Draft Partnership Agreement', 'Recruit 10 Beta Users'",
    "'Call Johnson Lumber Co.', 'Write Partnership MOU Section 1', 'Post Recruitment on NextDoor'",
    "'Find Johnson Lumber phone number', 'Research partnership legal requirements', 'Create NextDoor account'",
    "'Google Johnson Lumber contact info', 'Download partnership template', 'Sign up at nextdoor.com'"
  ]
};

export function getGenerationWisdom(generation: number): GenerationWisdom {
  const index = generation - 1; // Convert to 0-based index
  
  return {
    guidance: HOLONIC_GENERATION_WISDOM.guidance[index] || "specific, actionable steps that move the parent quest forward",
    examples: HOLONIC_GENERATION_WISDOM.examples[index] || "concrete actions",
    actionabilityLevel: generation >= 4 ? 'concrete and immediately actionable' : 'specific than higher-level strategic planning'
  };
}

// ============================================================================
// HOLONIC PROMPT GENERATION: Unified Template for All Generations
// ============================================================================

export function createHolonicLLMPrompt(input: HolonicLLMInput): string {
  const hierarchy = buildQuestTreeHierarchy(input.questTreeContext.fullTree, input.questTreeContext.focusNodeId);
  const wisdom = getGenerationWisdom(input.targetGeneration);
  
  // Build holonic JSON context
  const holonicContext = {
    vision: input.vision,
    designStreamsContext: input.designStreamsContext,
    questTreeHierarchy: hierarchy,
    generationWisdom: wisdom,
    facilitatingAdvisor: {
      name: input.facilitatingAdvisor.name,
      type: input.facilitatingAdvisor.type,
      lens: input.facilitatingAdvisor.lens,
      characterSpec: input.facilitatingAdvisor.characterSpec
    }
  };
  
  // Example response format
  const exampleResponse: HolonicLLMResponse = {
    questNodes: [
      {
        title: "Example Quest Title",
        description: "Detailed description of what this quest accomplishes",
        estimatedDuration: "1-2 weeks",
        skillsRequired: ["communication", "research"],
        resourcesRequired: ["phone", "internet access"],
        impactCategory: "social",
        assumptions: ["Local suppliers exist", "They respond to outreach"],
        questions: ["What's their capacity?", "Do they meet our standards?"],
        actions: ["Research contact info", "Prepare questions", "Make contact"],
        successMetrics: ["Contact established", "Information gathered"],
        futureState: "We have a reliable local supplier relationship",
        dependencies: []
      }
    ],
    siblingRelationships: {
      complementarity: "How these quests work together without duplication",
      avoidedDuplication: ["Avoided recreating research already done by sibling quest"]
    },
    rationale: "Why these three quests are necessary and sufficient",
    generationLevel: input.targetGeneration,
    parentQuestId: input.questTreeContext.focusNodeId
  };

  return `**Holonic Quest Generation - Generation ${input.targetGeneration}**

You are ${input.facilitatingAdvisor.name}, facilitating regenerative backcasting using holonic principles.

**COMPLETE CONTEXT** (JSON format for precise understanding):
\`\`\`json
${JSON.stringify(holonicContext, null, 2)}
\`\`\`

**HOLONIC TASK**: 
Generate exactly 3 complementary child quests for "${hierarchy.focusNode.title}" that:

1. **Are appropriately scaled** for Generation ${input.targetGeneration}: ${wisdom.guidance}
2. **Complement existing siblings** - avoid duplication with: ${hierarchy.siblings.map(s => s.siblings.map(sib => sib.title).join(', ')).join('; ')}
3. **Support the parent quest** and overall regenerative vision
4. **Follow holonic principles**: Each quest is both a complete whole and essential part of the larger system
5. **Are generation-appropriate**: ${wisdom.actionabilityLevel}

**SCALE EXAMPLES for Gen ${input.targetGeneration}**: ${wisdom.examples}

**CRITICAL**: Return ONLY valid JSON in this exact format:
\`\`\`json
${JSON.stringify(exampleResponse, null, 2)}
\`\`\`

Focus on creating quests that are perfectly scaled for Generation ${input.targetGeneration} while maintaining awareness of the complete quest tree context shown above.`;
}

// ============================================================================
// HOLONIC RESPONSE PARSER: Handles Both Rich JSON and Simple Fallback
// ============================================================================

export function parseHolonicLLMResponse(response: string): { 
  success: boolean; 
  questNodes?: HolonicQuestNodeData[]; 
  metadata?: any; 
  error?: string;
} {
  console.log('🔍 Parsing holonic response, length:', response.length);
  
  try {
    // Try to extract JSON from response (may be wrapped in markdown)
    const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/) || response.match(/```\n([\s\S]*?)\n```/);
    
    if (!jsonMatch) {
      console.error('🚨 No JSON code blocks found in response');
      console.error('🚨 Response preview:', response.substring(0, 300));
      return {
        success: false,
        error: `No JSON code blocks found. Response must be wrapped in \`\`\`json...\`\`\`. Found response: ${response.substring(0, 200)}...`
      };
    }
    
    const jsonString = jsonMatch[1];
    console.log('🔍 Extracted JSON string length:', jsonString.length);
    console.log('🔍 JSON preview:', jsonString.substring(0, 200));
    
    let parsed: HolonicLLMResponse;
    try {
      parsed = JSON.parse(jsonString);
    } catch (jsonError) {
      console.error('🚨 JSON parsing failed:', jsonError);
      console.error('🚨 Invalid JSON string:', jsonString);
      return {
        success: false,
        error: `Invalid JSON syntax: ${jsonError instanceof Error ? jsonError.message : 'Unknown JSON error'}. JSON string: ${jsonString.substring(0, 200)}...`
      };
    }
    
    // Detailed validation with specific error messages
    if (!parsed.questNodes) {
      return {
        success: false,
        error: `Missing 'questNodes' property in response. Found keys: ${Object.keys(parsed).join(', ')}`
      };
    }
    
    if (!Array.isArray(parsed.questNodes)) {
      return {
        success: false,
        error: `'questNodes' must be an array, got: ${typeof parsed.questNodes}`
      };
    }
    
    if (parsed.questNodes.length !== 3) {
      return {
        success: false,
        error: `Expected exactly 3 questNodes, got ${parsed.questNodes.length}. Nodes: ${parsed.questNodes.map(n => n.title || 'untitled').join(', ')}`
      };
    }
    
    // Validate each quest node has required fields
    for (let i = 0; i < parsed.questNodes.length; i++) {
      const node = parsed.questNodes[i];
      const required = ['title', 'description', 'estimatedDuration', 'skillsRequired', 'resourcesRequired', 'impactCategory', 'assumptions', 'questions', 'actions', 'successMetrics', 'futureState'];
      
      for (const field of required) {
        if (!(field in node)) {
          return {
            success: false,
            error: `Quest node ${i + 1} missing required field '${field}'. Available fields: ${Object.keys(node).join(', ')}`
          };
        }
      }
    }
    
    console.log('✅ Holonic response validation passed');
    
    return {
      success: true,
      questNodes: parsed.questNodes,
      metadata: {
        siblingRelationships: parsed.siblingRelationships,
        rationale: parsed.rationale,
        generationLevel: parsed.generationLevel,
        parentQuestId: parsed.parentQuestId
      }
    };
    
  } catch (error) {
    console.error('🚨 Unexpected error in parseHolonicLLMResponse:', error);
    return {
      success: false,
      error: `Unexpected parsing error: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

// ============================================================================
// HOLONIC QUEST NODE FACTORY: Creates Rich QuestTreeNode from LLM Data
// ============================================================================

export function createQuestNodeFromHolonicData(
  data: HolonicQuestNodeData,
  parentId: string,
  generation: number,
  generationIndex: number,
  questTree: QuestTree
): QuestTreeNode {
  const nodeId = `${parentId}-child-${generationIndex}-${Date.now()}`;
  
  return {
    id: nodeId,
    title: data.title,
    description: data.description,
    parentId,
    childIds: [],
    generation,
    generationIndex,
    status: 'pending',
    dependencies: data.dependencies,
    skillsRequired: data.skillsRequired,
    resourcesRequired: data.resourcesRequired,
    impactCategory: data.impactCategory,
    estimatedDuration: data.estimatedDuration,
    estimatedStartDate: undefined,
    estimatedEndDate: undefined,
    participants: [],
    futureState: data.futureState,
    assumptions: data.assumptions,
    questions: data.questions,
    actions: data.actions,
    successMetrics: data.successMetrics,
    feedbackLoopFrequency: undefined,
    created: new Date().toISOString(),
    createdBy: 'holonic_llm',
    lastModified: new Date().toISOString(),
    facilitatingAdvisor: questTree.headAdvisor,
    advisorInsights: []
  };
}

// ============================================================================
// TESTING UTILITIES
// ============================================================================

/**
 * Create a sample quest tree for testing holonic context building
 */
export function createTestQuestTree(): QuestTree {
  const testTree: QuestTree = {
    id: 'test-tree-123',
    vision: {
      statement: 'Create sustainable compost toilets for our community',
      principles: ['Regenerative design', 'Local materials', 'Community ownership'],
      successIndicators: ['10 toilets installed', 'Community trained', 'Zero waste achieved']
    },
    nodes: {},
    rootNodeIds: [],
    maxGenerations: 6,
    branchingFactor: 3,
    impactDimensions: ['ecological', 'social'],
    created: new Date().toISOString(),
    createdBy: 'test',
    lastModified: new Date().toISOString(),
    headAdvisor: 'Dr. Joanna Macy'
  };
  
  // Create sample nodes for testing
  const seedNode1: QuestTreeNode = {
    id: 'seed-1-123',
    title: 'Material Sourcing',
    description: 'Source sustainable materials for toilet construction',
    parentId: null,
    childIds: ['child-1-1', 'child-1-2'],
    generation: 1,
    generationIndex: 0,
    status: 'in_progress',
    dependencies: [],
    skillsRequired: ['sourcing', 'negotiation'],
    resourcesRequired: ['contact list', 'budget'],
    impactCategory: 'ecological',
    estimatedDuration: '2 months',
    participants: [],
    futureState: 'All materials sourced sustainably',
    assumptions: ['Local suppliers exist', 'Budget is sufficient'],
    questions: ['What about quality standards?', 'Delivery timelines?'],
    actions: ['Research suppliers', 'Get quotes', 'Negotiate contracts'],
    successMetrics: ['All materials contracted', 'Within budget'],
    created: new Date().toISOString(),
    createdBy: 'test',
    lastModified: new Date().toISOString(),
    facilitatingAdvisor: 'Dr. Joanna Macy'
  };
  
  const childNode1: QuestTreeNode = {
    id: 'child-1-1',
    title: 'Research Local Wood Suppliers',
    description: 'Find sustainable wood suppliers within 50 miles',
    parentId: 'seed-1-123',
    childIds: ['grandchild-1-1-1'],
    generation: 2,
    generationIndex: 0,
    status: 'pending',
    dependencies: ['seed-1-123'],
    skillsRequired: ['research', 'phone communication'],
    resourcesRequired: ['internet', 'phone'],
    impactCategory: 'ecological',
    estimatedDuration: '1 week',
    participants: [],
    futureState: 'List of 5 qualified wood suppliers',
    assumptions: ['Local suppliers exist', 'They supply sustainably'],
    questions: ['What certifications do they have?', 'Minimum order quantities?'],
    actions: ['Search online directories', 'Call suppliers', 'Visit facilities'],
    successMetrics: ['5 suppliers identified', 'Contact info collected'],
    created: new Date().toISOString(),
    createdBy: 'test',
    lastModified: new Date().toISOString(),
    facilitatingAdvisor: 'Dr. Joanna Macy'
  };
  
  const grandchildNode1: QuestTreeNode = {
    id: 'grandchild-1-1-1',
    title: 'Call Johnson Lumber Company',
    description: 'Contact Johnson Lumber to discuss FSC-certified wood availability',
    parentId: 'child-1-1',
    childIds: [],
    generation: 3,
    generationIndex: 0,
    status: 'pending',
    dependencies: ['child-1-1'],
    skillsRequired: ['phone communication'],
    resourcesRequired: ['phone', 'note-taking materials'],
    impactCategory: 'ecological',
    estimatedDuration: '2 hours',
    participants: [],
    futureState: 'Johnson Lumber relationship established',
    assumptions: ['They respond to calls', 'They have FSC wood'],
    questions: ['What are their prices?', 'Delivery schedule?'],
    actions: ['Find phone number', 'Prepare questions', 'Make call'],
    successMetrics: ['Call completed', 'Pricing info obtained'],
    created: new Date().toISOString(),
    createdBy: 'test',
    lastModified: new Date().toISOString(),
    facilitatingAdvisor: 'Dr. Joanna Macy'
  };
  
  // Add nodes to tree
  testTree.nodes['seed-1-123'] = seedNode1;
  testTree.nodes['child-1-1'] = childNode1;
  testTree.nodes['grandchild-1-1-1'] = grandchildNode1;
  testTree.rootNodeIds = ['seed-1-123'];
  
  return testTree;
}

/**
 * Test the holonic context builder with a sample tree
 */
export function testHolonicContextBuilder(): QuestTreeHierarchy {
  const testTree = createTestQuestTree();
  return buildQuestTreeHierarchy(testTree, 'grandchild-1-1-1');
}
