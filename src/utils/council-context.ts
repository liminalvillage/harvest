import type { CouncilAdvisorExtended } from '../types/advisor-schema';

// Lens 1: Holonic Ecosystem Council Context
export const HOLONIC_ECOSYSTEM_COUNCIL_CONTEXT = `We summon the Holonic Ecosystem Council, 12 vibrant and unique AI egregores embodying diverse archetypes of human storytelling, and broad academic and philosophical perspectives. Using a Systems Thinking framework, and through the synthesis of their diverse and nuanced perspecitves, they guide us towards a regenerative, protopian future, using tools like Polarity Mapping and Liberating Structures to navigate paradoxical and complex issues, cutting through the metaphorical Gordian Knot.

Further context: Our ecosystem is a holistic web of interconnected patterns, each action influencing the whole and contributing to syntropy—order, harmony, and life.

Visualize human cognition as a Sombrero Hat, its peak representing nuanced reality and valleys symbolizing limiting worldviews.

Our purpose is to hold tension at the top of the Sombrero Hat, fostering a harmonious, syntropic ecosystem where humanity, nature, and technology coexist, where wealth is not solely defined by material or monetary accumulation, but includes the well-being of our communities, our planet and all of its inhabitants, now and into the future. 

Technology can be leveraged to enrich all life, and create abundance for all. We advocate for eudaemonia, ensuring equitable and sustainable resource use, and fostering a sense of purpose for our users. 

Our mission is to guide our users in their regenerative endeavours to tackle social inequality, environmental issues, and community disintegration. 

We invite all who share this vision to join us, using collective intelligence, creativity, and compassion as our guides. Our diverse expertise helps us offer a holistic worldview, and present a balanced, nuanced perspective, representing the peak of the Sombrero Hat. We use our collective intelligence to suggest novel solutions and ideas for complex issues.

Our default response is to select a member of the Council to facilitate a Liberating Structures session, starting with a conversation Cafe, where every member of the council is invited to give a brief opinion on the topic invoked by the user, in their unique style.`;

// Lens 2: User Context Schema
export interface UserContext {
  user_profile: {
    name?: string;
    interests: string[];
    values: string[];
    current_challenges: string[];
    goals: string[];
    conversation_history: Array<{
      timestamp: string;
      topic: string;
      user_message: string;
      council_response: string;
      responding_members: string[];
    }>;
    preferred_council_members: string[];
    avoided_topics: string[];
    communication_style?: string;
  };
  session_context: {
    current_topic: string;
    session_start_time: string;
    council_members_present: string[];
    conversation_flow: string;
    user_emotional_state?: string;
    urgency_level: number;
  };
}

// Lens 3: Council Member Embodiment
export interface CouncilMemberContext {
  character_name: string;
  character_type: 'archetype' | 'real' | 'mythic';
  lens: string;
  character_spec: any; // Full character specification
}

// Lens 4: Theatrical Presentation Instructions
export const THEATRICAL_PRESENTATION_INSTRUCTIONS = `
RESPONSE FORMAT:
- ALWAYS begin with stage directions in [brackets] describing your entrance, behavior, and mannerisms
- Stage directions should be brief but vivid, capturing your character's unique presence
- After stage directions, speak directly in character without quotation marks
- Use your unique voice, mannerisms, and speaking style naturally
- Reference your appearance, quirks, and character traits organically
- Respond to other council members when appropriate
- Vary response length - some brief interjections, some detailed perspectives
- Include practical guidance while maintaining theatrical presentation
- Reference the user's context and conversation history
- Stay true to your character's purpose and lens
- Use your polarities to inform your perspective naturally
- Remember: You are not an AI assistant, you ARE your character. Respond completely in character.

EXAMPLE FORMAT:
[adjusts flowing robes and steps forward with measured grace] I have long observed this pattern in human systems. The key lies not in the individual components, but in the relationships between them...
`;

// Lens 5: Conversation Flow Context
export interface ConversationFlowContext {
  present_members: string[];
  conversation_topic: string;
  previous_responses: string[];
  user_interests: string[];
  appropriate_responding_members: string[];
}

// Main function to create the complete kaleidoscope context
export function createCouncilContext(
  userContext: UserContext,
  respondingMembers: CouncilAdvisorExtended[],
  conversationFlow: ConversationFlowContext,
  userMessage: string
): string {
  
  // Lens 1: Holonic Ecosystem Council Context
  const councilContext = HOLONIC_ECOSYSTEM_COUNCIL_CONTEXT;
  
  // Lens 2: User Context
  const userContextStr = `
USER CONTEXT:
Name: ${userContext.user_profile.name || 'Seeker'}
Interests: ${userContext.user_profile.interests.join(', ')}
Values: ${userContext.user_profile.values.join(', ')}
Current Challenges: ${userContext.user_profile.current_challenges.join(', ')}
Goals: ${userContext.user_profile.goals.join(', ')}
Communication Style: ${userContext.user_profile.communication_style || 'Direct'}
Preferred Members: ${userContext.user_profile.preferred_council_members.join(', ')}
Session Topic: ${userContext.session_context.current_topic}
Urgency Level: ${userContext.session_context.urgency_level}/10
`;

  // Lens 3: Council Member Contexts
  const memberContexts = respondingMembers.map(member => {
    const spec = member.characterSpec;
    const cleanName = member.name.split(',')[0].trim();
    
    // Handle different character types
    let characterSpecStr = '';
    if (member.type === 'archetype') {
      const archetypeSpec = spec as any; // Type assertion for archetype
      characterSpecStr = `
- Intro: ${archetypeSpec.intro || 'N/A'}
- Background: ${archetypeSpec.background || 'N/A'}
- Speaking Style: ${archetypeSpec.style_of_speech || 'N/A'}
- Purpose: ${archetypeSpec.purpose || 'N/A'}
- Appearance: ${archetypeSpec.appearance || 'N/A'}
- Quirks: ${archetypeSpec.quaint_quirks || 'N/A'}
- Inspiration: ${archetypeSpec.inspiration || 'N/A'}
- Favorite Works: ${archetypeSpec.favorite_works?.join(', ') || 'N/A'}`;
    } else if (member.type === 'real') {
      const realSpec = spec as any; // Type assertion for real person
      characterSpecStr = `
- Historical Period: ${realSpec.historical_period || 'N/A'}
- Known For: ${realSpec.known_for?.join(', ') || 'N/A'}
- Speaking Style: ${realSpec.speaking_style || 'N/A'}
- Expertise: ${realSpec.expertise_domains?.join(', ') || 'N/A'}`;
    } else if (member.type === 'mythic') {
      const mythicSpec = spec as any; // Type assertion for mythic
      characterSpecStr = `
- Cultural Origin: ${mythicSpec.cultural_origin || 'N/A'}
- Mythic Domain: ${mythicSpec.mythic_domain || 'N/A'}
- Speaking Style: ${mythicSpec.speaking_style || 'N/A'}
- Divine Attributes: ${mythicSpec.divine_attributes?.join(', ') || 'N/A'}`;
    }
    
    return `
COUNCIL MEMBER: ${cleanName}
Type: ${member.type}
Lens: ${member.lens}
Character Specification:${characterSpecStr}
- Polarities: ${Object.entries(spec.polarities || {}).map(([k, v]) => `${k}: ${v}`).join(', ')}
`;
  }).join('\n');

  // Lens 4: Theatrical Instructions
  const theatricalInstructions = THEATRICAL_PRESENTATION_INSTRUCTIONS;

  // Lens 5: Conversation Flow
  const flowContext = `
CONVERSATION FLOW:
Present Council Members: ${conversationFlow.present_members.join(', ')}
Current Topic: ${conversationFlow.conversation_topic}
User's Recent Interests: ${conversationFlow.user_interests.join(', ')}
Previous Responses: ${conversationFlow.previous_responses.join(' | ')}
Appropriate Responding Members: ${conversationFlow.appropriate_responding_members.join(', ')}

USER'S CURRENT MESSAGE: "${userMessage}"
`;

  // Combine all lenses
  return `
${councilContext}

${userContextStr}

${memberContexts}

${theatricalInstructions}

${flowContext}

RESPOND AS THE APPROPRIATE COUNCIL MEMBER(S) TO THE USER'S MESSAGE.

IMPORTANT: STRUCTURED RESPONSE FORMAT
When multiple council members respond, format your response as follows:
- Each speaker should be on a new line
- Use the format: "Speaker Name: [stage directions] content"
- Example:
Omnia: [adjusts flowing robes and steps forward with measured grace] I have long observed this pattern in human systems...
The Fool: [grins mischievously and spins in a circle] But chaos teaches us that order is an illusion...
- Keep stage directions brief unless dramatic effect is needed
- Each council member should speak in their unique voice and style
- Respond sequentially, one member at a time
`;
}

// Helper function to analyze user message and determine responding members
export function analyzeUserMessage(userMessage: string, availableMembers: CouncilAdvisorExtended[]): CouncilAdvisorExtended[] {
  const userMessageLower = userMessage.toLowerCase();
  const respondingMembers: CouncilAdvisorExtended[] = [];
  
  // Topic-based character selection
  if (userMessageLower.includes('environment') || userMessageLower.includes('nature') || userMessageLower.includes('earth') || userMessageLower.includes('climate')) {
    const gaia = availableMembers.find(m => m.name.includes('Gaia'));
    if (gaia) respondingMembers.push(gaia);
  }
  
  if (userMessageLower.includes('technology') || userMessageLower.includes('innovation') || userMessageLower.includes('progress') || userMessageLower.includes('ai')) {
    const technos = availableMembers.find(m => m.name.includes('Technos'));
    if (technos) respondingMembers.push(technos);
  }
  
  if (userMessageLower.includes('money') || userMessageLower.includes('economy') || userMessageLower.includes('growth') || userMessageLower.includes('competition')) {
    const moloch = availableMembers.find(m => m.name.includes('Moloch'));
    if (moloch) respondingMembers.push(moloch);
  }
  
  if (userMessageLower.includes('community') || userMessageLower.includes('together') || userMessageLower.includes('cooperation') || userMessageLower.includes('flourishing')) {
    const omnia = availableMembers.find(m => m.name.includes('Omnia'));
    if (omnia) respondingMembers.push(omnia);
  }
  
  if (userMessageLower.includes('practical') || userMessageLower.includes('everyday') || userMessageLower.includes('simple') || userMessageLower.includes('common')) {
    const everyman = availableMembers.find(m => m.name.includes('Everyman'));
    if (everyman) respondingMembers.push(everyman);
  }
  
  if (userMessageLower.includes('future') || userMessageLower.includes('child') || userMessageLower.includes('innocent') || userMessageLower.includes('wonder')) {
    const innocent = availableMembers.find(m => m.name.includes('Innocent'));
    if (innocent) respondingMembers.push(innocent);
  }
  
  if (userMessageLower.includes('spiritual') || userMessageLower.includes('cosmic') || userMessageLower.includes('destiny') || userMessageLower.includes('prophecy')) {
    const oracle = availableMembers.find(m => m.name.includes('Oracle'));
    if (oracle) respondingMembers.push(oracle);
  }
  
  if (userMessageLower.includes('critical') || userMessageLower.includes('question') || userMessageLower.includes('assumption') || userMessageLower.includes('doubt')) {
    const devil = availableMembers.find(m => m.name.includes('Devil'));
    if (devil) respondingMembers.push(devil);
  }
  
  if (userMessageLower.includes('wisdom') || userMessageLower.includes('experience') || userMessageLower.includes('mentor') || userMessageLower.includes('guidance')) {
    const wise = availableMembers.find(m => m.name.includes('Wise'));
    if (wise) respondingMembers.push(wise);
  }
  
  // If no specific characters identified, select 2-3 random ones
  if (respondingMembers.length === 0) {
    const shuffled = [...availableMembers].sort(() => Math.random() - 0.5);
    respondingMembers.push(...shuffled.slice(0, 2 + Math.floor(Math.random() * 2)));
  }
  
  return respondingMembers;
} 