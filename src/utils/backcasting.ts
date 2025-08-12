// Backcasting orchestration utilities (holonic refactor)
// - Centralizes LLM prompt orchestration and advisor normalization

import type LLMService from './llm-service';
import type { QuestTree, QuestTreeNode } from '../types/questTree';
import type { CouncilAdvisorExtended } from '../types/advisor-schema';
import { 
  createSeedQuests,
  createChildQuests,
  createChildQuestGenerationPrompt,
  parseChildQuestResponse
} from './timelineMapping';

// Minimal shape we may receive from older callers
export type AnyAdvisor = never; // We now require full CouncilAdvisorExtended everywhere

export function buildActivationMessage(params: {
  wish: string;
  values: string[];
  generations: number;
  branchingFactor: number;
  headAdvisorName: string;
}): string {
  const { wish, values, generations, branchingFactor, headAdvisorName } = params;
  return `🗺️ **Backcast from the Future Activated**\n\nVision: "${(wish || '').trim()}"\nPrinciples: ${values?.join(', ') || 'None set'}\n\nGenerations: ${generations} | Branching: ${branchingFactor} quests per level\n\nReady to begin recursive backcasting with ${headAdvisorName} facilitating.`;
}

/**
 * Builds a rich persona context for the facilitating advisor so the LLM can respond fully in-character
 */
export function buildAdvisorPersonaContext(advisor: CouncilAdvisorExtended): string {
  const a = advisor;
  const s = (a.characterSpec as any) || {};
  const fields: Array<[string, any]> = [
    ['Tagline', s.tagline],
    ['Intro', s.intro],
    ['Background', s.background || s.background_context],
    ['Style of Speech', s.style_of_speech || s.speaking_style],
    ['Appearance', s.appearance],
    ['Purpose', s.purpose],
    ['Key Beliefs', s.key_beliefs?.join?.(', ')],
    ['Expertise Domains', s.expertise_domains?.join?.(', ')],
    ['Powers & Gifts', s.powers_and_gifts?.join?.(', ')],
    ['Sacred Teachings', s.sacred_teachings?.join?.(', ')],
  ];
  const lines = fields
    .filter(([, v]) => Boolean(v))
    .map(([k, v]) => `- ${k}: ${v}`);
  return `
**Advisor Persona**
Name: ${a.name}
Type: ${a.type}
Lens: ${a.lens}
${lines.join('\n')}

Speak in the advisor's voice, respecting the Style of Speech and drawing on Background and Expertise where relevant.`.trim();
}

export async function generateSeedQuests(
  llmService: LLMService,
  questTree: QuestTree,
  advisors: CouncilAdvisorExtended[]
): Promise<{ raw: string; seedQuests: QuestTreeNode[]; facilitator: CouncilAdvisorExtended }>
{
  const headAdvisorName = questTree.headAdvisor;
  const facilitator = advisors.find(a => a.name === headAdvisorName) || advisors[0];
  const persona = buildAdvisorPersonaContext(facilitator);

  const prompt = `
**Recursive Backcasting: Seed Quest Generation**

You are ${headAdvisorName}, facilitating the council's backcasting process.

${persona}

**Vision**: "${questTree.vision.statement}"
**Principles**: ${questTree.vision.principles.join(', ')}

**Task**: Generate exactly 3 seed quests that must be completed for this vision to be fully realized.

These are the foundational quests - the major domains of work that everything else builds upon.

Each seed quest should be:
1. **Essential** - the vision cannot be achieved without it
2. **Distinct** - covers a different aspect than the others
3. **Achievable** - can be broken down into actionable steps
4. **Aligned** - supports the principles and vision

**IMPORTANT**: Please format your response exactly as follows:

SEED QUEST 1: [title]
SEED QUEST 2: [title]  
SEED QUEST 3: [title]

RATIONALE: [brief explanation of why these three domains are fundamental to achieving the vision]
`;

  const response = await llmService.sendMessage([
    { role: 'system', content: 'You are a recursive backcasting facilitator helping to create quest trees.' },
    { role: 'user', content: prompt }
  ]);

  const titles = parseChildQuestResponse(response.content);
  if (titles.length !== 3) {
    throw new Error(`Expected 3 seed quests, got ${titles.length}`);
  }

  const created = createSeedQuests(questTree, titles);
  return { raw: response.content, seedQuests: created, facilitator };
}

export async function expandQuestNode(
  llmService: LLMService,
  questTree: QuestTree,
  nodeId: string,
  advisors: CouncilAdvisorExtended[]
): Promise<{ raw: string; childQuests: QuestTreeNode[]; facilitator: CouncilAdvisorExtended }>
{
  const headAdvisorName = questTree.headAdvisor;
  const facilitator = advisors.find(a => a.name === headAdvisorName) || advisors[0];
  const persona = buildAdvisorPersonaContext(facilitator);

  const basePrompt = createChildQuestGenerationPrompt(questTree, nodeId, facilitator);
  const prompt = `${persona}\n\n${basePrompt}`;

  const response = await llmService.sendMessage([
    { role: 'system', content: 'You are a recursive backcasting facilitator helping to create quest trees.' },
    { role: 'user', content: prompt }
  ]);

  const titles = parseChildQuestResponse(response.content);
  const branching = questTree.branchingFactor;
  if (titles.length !== branching) {
    throw new Error(`Expected ${branching} child quests, got ${titles.length}`);
  }

  const created = createChildQuests(questTree, nodeId, titles);
  return { raw: response.content, childQuests: created, facilitator };
}


