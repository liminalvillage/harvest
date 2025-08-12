// Timeline Mapping / Recursive Backcasting Utilities

import type { QuestTree, QuestTreeNode, BackcastingSession, InquiryLoop, GenerationConfig } from '../types/questTree';
import type { RitualSession } from './holonCreator';
import type { CouncilAdvisorExtended } from '../types/advisor-schema';

/**
 * Creates a new quest tree from a ritual session
 */
export function createQuestTreeFromRitual(
  ritualSession: RitualSession,
  headAdvisor: string,
  config: GenerationConfig
): QuestTree {
  const treeId = `tree-${Date.now()}`;
  
  return {
    id: treeId,
    vision: {
      statement: ritualSession.wish_statement,
      principles: ritualSession.declared_values || [],
      successIndicators: []
    },
    nodes: {},
    rootNodeIds: [],
    maxGenerations: config.number,
    branchingFactor: config.branchingFactor,
    impactDimensions: [], // Will be co-defined with user
    created: new Date().toISOString(),
    createdBy: 'council_ritual',
    lastModified: new Date().toISOString(),
    sourceRitualId: ritualSession.session_id,
    headAdvisor
  };
}

/**
 * Creates seed quests (generation 1) from the vision
 */
export function createSeedQuests(
  questTree: QuestTree,
  seedQuestTitles: string[]
): QuestTreeNode[] {
  const seedQuests: QuestTreeNode[] = [];
  
  seedQuestTitles.forEach((title, index) => {
    const nodeId = `seed-${index}-${Date.now()}`;
    
    const seedQuest: QuestTreeNode = {
      id: nodeId,
      title,
      parentId: null, // Seeds have no parent - they connect directly to vision
      childIds: [],
      generation: 1,
      generationIndex: index,
      status: 'pending',
      dependencies: [],
      skillsRequired: [],
      resourcesRequired: [],
      impactCategory: 'social', // Default, can be updated
      participants: [],
      assumptions: [],
      questions: [],
      actions: [],
      created: new Date().toISOString(),
      createdBy: 'timeline_mapping',
      lastModified: new Date().toISOString()
    };
    
    seedQuests.push(seedQuest);
    questTree.nodes[nodeId] = seedQuest;
    questTree.rootNodeIds.push(nodeId);
  });
  
  return seedQuests;
}

/**
 * Creates child quests for a given parent quest
 */
export function createChildQuests(
  questTree: QuestTree,
  parentNodeId: string,
  childQuestTitles: string[]
): QuestTreeNode[] {
  const parentNode = questTree.nodes[parentNodeId];
  if (!parentNode) {
    throw new Error(`Parent node ${parentNodeId} not found`);
  }
  
  const childQuests: QuestTreeNode[] = [];
  
  childQuestTitles.forEach((title, index) => {
    const nodeId = `${parentNodeId}-child-${index}-${Date.now()}`;
    
    const childQuest: QuestTreeNode = {
      id: nodeId,
      title,
      parentId: parentNodeId,
      childIds: [],
      generation: parentNode.generation + 1,
      generationIndex: index,
      status: 'pending',
      dependencies: [parentNodeId], // Child depends on parent by default
      skillsRequired: [],
      resourcesRequired: [],
      impactCategory: parentNode.impactCategory, // Inherit from parent
      participants: [],
      assumptions: [],
      questions: [],
      actions: [],
      created: new Date().toISOString(),
      createdBy: 'timeline_mapping',
      lastModified: new Date().toISOString(),
      facilitatingAdvisor: parentNode.facilitatingAdvisor
    };
    
    childQuests.push(childQuest);
    questTree.nodes[nodeId] = childQuest;
    parentNode.childIds.push(nodeId);
  });
  
  return childQuests;
}

/**
 * Creates the recursive inquiry loop context for AI council
 */
export function createRecursiveInquiryContext(
  questTree: QuestTree,
  currentNodeId: string,
  facilitatingAdvisor: CouncilAdvisorExtended
): string {
  const currentNode = questTree.nodes[currentNodeId];
  if (!currentNode) {
    throw new Error(`Quest node ${currentNodeId} not found`);
  }
  
  // Build context from the vision and values
  const vision = questTree.vision.statement;
  const principles = questTree.vision.principles.join(', ');
  
  // Build context from parent and sibling quests
  let questContext = '';
  if (currentNode.parentId) {
    const parentNode = questTree.nodes[currentNode.parentId];
    questContext += `Parent Quest: "${parentNode.title}"\n`;
    
    // Add sibling context
    const siblings = parentNode.childIds
      .filter(id => id !== currentNodeId)
      .map(id => questTree.nodes[id].title);
    if (siblings.length > 0) {
      questContext += `Sibling Quests: ${siblings.join(', ')}\n`;
    }
  }
  
  // Add any previous assumptions, questions, actions
  let previousWork = '';
  if (currentNode.assumptions.length > 0) {
    previousWork += `Previous Assumptions: ${currentNode.assumptions.join(', ')}\n`;
  }
  if (currentNode.questions.length > 0) {
    previousWork += `Previous Questions: ${currentNode.questions.join(', ')}\n`;
  }
  if (currentNode.actions.length > 0) {
    previousWork += `Previous Actions: ${currentNode.actions.join(', ')}\n`;
  }
  
  return `
**Recursive Backcasting Facilitation**

You are ${facilitatingAdvisor.name}, facilitating the council's recursive inquiry for quest creation.

**Vision**: ${vision}
**Principles**: ${principles}

**Current Quest**: "${currentNode.title}"
- Generation: ${currentNode.generation}
- Position: ${currentNode.generationIndex + 1} of ${questTree.branchingFactor}

${questContext}

${previousWork}

**Recursive Inquiry Protocol**:
Run this inquiry loop for the current quest:

1. **What do we know?** - from the vision, principles, and previous quests
2. **What assumptions are we making?** - about this quest and its execution
3. **What questions arise?** - from these assumptions
4. **What actions can we take?** - specific, achievable steps

As the facilitating advisor, guide the council through this inquiry to:
- Define 3 child quests that must be completed for this quest to succeed
- Identify key assumptions, questions, and actionable steps
- Ensure alignment with the vision and principles

Keep responses focused and actionable. Each child quest should be:
- Independently executable
- A clear step toward completing the parent quest
- Aligned with the regenerative vision
`;
}

/**
 * Creates AI prompt for generating child quests
 */
export function createChildQuestGenerationPrompt(
  questTree: QuestTree,
  parentNodeId: string,
  facilitatingAdvisor: CouncilAdvisorExtended
): string {
  const parentNode = questTree.nodes[parentNodeId];
  const vision = questTree.vision.statement;
  const principles = questTree.vision.principles.join(', ');
  
  return `
**Generate Child Quests**

You are ${facilitatingAdvisor.name}, working with the council to break down a quest into actionable sub-quests.

**Vision**: ${vision}
**Principles**: ${principles}

**Parent Quest**: "${parentNode.title}"
${parentNode.description ? `Description: ${parentNode.description}` : ''}

**Task**: Generate exactly 3 child quests that must be completed for "${parentNode.title}" to be successful.

Each child quest should be:
1. **Independently executable** - can be worked on separately
2. **Specific and actionable** - clear what needs to be done
3. **Necessary** - the parent quest cannot succeed without it
4. **Aligned** - supports the vision and principles

Please provide:
1. **Three child quest titles** (one line each)
2. **Brief rationale** for why these three are essential

Format your response as:
CHILD QUEST 1: [title]
CHILD QUEST 2: [title]  
CHILD QUEST 3: [title]

RATIONALE: [brief explanation of why these three are necessary and sufficient]
`;
}

/**
 * Parses AI response to extract quest titles (both seed and child quests)
 */
export function parseChildQuestResponse(response: string): string[] {
  const lines = response.split('\n');
  const questTitles: string[] = [];
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    
    // Look for various quest patterns
    const questPatterns = [
      /^SEED QUEST \d+:\s*(.+)$/i,
      /^CHILD QUEST \d+:\s*(.+)$/i,
      /^QUEST \d+:\s*(.+)$/i,
      /^(\d+)\.\s*(.+)$/i, // Numbered lists
      /^[-*]\s*(.+)$/i     // Bullet points
    ];
    
    for (const pattern of questPatterns) {
      const match = trimmedLine.match(pattern);
      if (match) {
        const title = match[1].trim();
        if (title && !title.toLowerCase().includes('rationale') && !title.toLowerCase().includes('explanation')) {
          questTitles.push(title);
          break; // Only match one pattern per line
        }
      }
    }
  }
  
  // If we found quests, return them. Otherwise, try to extract from the full response
  if (questTitles.length > 0) {
    return questTitles;
  }
  
  // Fallback: Look for any lines that might be quest titles
  const fallbackLines = lines.filter(line => {
    const trimmed = line.trim();
    return trimmed.length > 5 && 
           trimmed.length < 100 && 
           !trimmed.toLowerCase().includes('rationale') &&
           !trimmed.toLowerCase().includes('explanation') &&
           !trimmed.toLowerCase().includes('vision') &&
           !trimmed.toLowerCase().includes('principle');
  });
  
  // Take the first 3 lines that look like quest titles
  return fallbackLines.slice(0, 3).map(line => line.trim());
}

/**
 * Calculates quest tree statistics
 */
export function calculateTreeStats(questTree: QuestTree): {
  totalNodes: number;
  nodesByGeneration: Record<number, number>;
  completionRate: number;
  criticalPath: string[];
} {
  const nodes = Object.values(questTree.nodes);
  const totalNodes = nodes.length;
  
  const nodesByGeneration: Record<number, number> = {};
  let completedNodes = 0;
  
  nodes.forEach(node => {
    nodesByGeneration[node.generation] = (nodesByGeneration[node.generation] || 0) + 1;
    if (node.status === 'completed') {
      completedNodes++;
    }
  });
  
  const completionRate = totalNodes > 0 ? (completedNodes / totalNodes) * 100 : 0;
  
  // Simple critical path calculation (nodes with most dependencies)
  const criticalPath = nodes
    .sort((a, b) => b.dependencies.length - a.dependencies.length)
    .slice(0, 3)
    .map(node => node.title);
  
  return {
    totalNodes,
    nodesByGeneration,
    completionRate,
    criticalPath
  };
}

/**
 * Validates quest tree structure
 */
export function validateQuestTree(questTree: QuestTree): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  // Check that all referenced nodes exist
  Object.values(questTree.nodes).forEach(node => {
    if (node.parentId && !questTree.nodes[node.parentId]) {
      errors.push(`Node ${node.id} references non-existent parent ${node.parentId}`);
    }
    
    node.childIds.forEach(childId => {
      if (!questTree.nodes[childId]) {
        errors.push(`Node ${node.id} references non-existent child ${childId}`);
      }
    });
    
    node.dependencies.forEach(depId => {
      if (!questTree.nodes[depId]) {
        errors.push(`Node ${node.id} has dependency on non-existent node ${depId}`);
      }
    });
  });
  
  // Check root nodes are actually in the tree
  questTree.rootNodeIds.forEach(rootId => {
    if (!questTree.nodes[rootId]) {
      errors.push(`Root node ${rootId} not found in tree nodes`);
    }
  });
  
  // Check generation consistency
  Object.values(questTree.nodes).forEach(node => {
    if (node.parentId) {
      const parent = questTree.nodes[node.parentId];
      if (parent && parent.generation !== node.generation - 1) {
        errors.push(`Node ${node.id} generation ${node.generation} inconsistent with parent generation ${parent.generation}`);
      }
    }
  });
  
  return {
    isValid: errors.length === 0,
    errors
  };
}