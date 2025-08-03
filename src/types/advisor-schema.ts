export interface PolarityScore {
  [key: string]: number; // 0.0 to 1.0 scale
}

export interface ArchetypeAdvisor {
  name: string;
  tagline: string;
  intro: string;
  background: string;
  style_of_speech: string;
  appearance: string;
  purpose: string;
  prevention: string;
  inspiration: string;
  quaint_quirks: string;
  favorite_works: string[];
  polarities: PolarityScore;
  council_membership?: 'ai-ecosystem' | 'general' | 'none'; // New field for council membership
}

export interface CouncilAdvisorExtended {
  // Base advisor properties
  name: string;
  type: 'real' | 'mythic' | 'archetype';
  lens: string;
  avatar_url?: string;
  
  // Extended character specification
  characterSpec: ArchetypeAdvisor | RealPersonAdvisor | MythicAdvisor;
}

export interface RealPersonAdvisor {
  name: string;
  historical_period: string;
  known_for: string[];
  key_beliefs: string[];
  speaking_style: string;
  notable_quotes: string[];
  expertise_domains: string[];
  personality_traits: string[];
  background_context: string;
  approach_to_advice: string;
  polarities: PolarityScore;
}

export interface MythicAdvisor {
  name: string;
  cultural_origin: string;
  mythic_domain: string;
  sacred_symbols: string[];
  divine_attributes: string[];
  speaking_style: string;
  powers_and_gifts: string[];
  sacred_teachings: string[];
  appearance: string;
  ritual_associations: string[];
  polarities: PolarityScore;
}

// Standard polarity dimensions for consistency
export const STANDARD_POLARITIES = {
  "Individual ↔ Collective": "Focus on personal vs community concerns",
  "Rational ↔ Empirical": "Logic-based vs experience-based reasoning", 
  "Idealist ↔ Pragmatist": "Vision-focused vs practical approach",
  "Order ↔ Chaos": "Structure vs spontaneity preference",
  "Authority ↔ Autonomy": "Hierarchical vs independent orientation",
  "Optimist ↔ Pessimist": "Positive vs cautious outlook",
  "Traditionalist ↔ Innovator": "Preserving vs changing established ways",
  "Hierarchy ↔ Egalitarian": "Structured vs equal relationships",
  "Competitive ↔ Cooperative": "Individual achievement vs collaboration",
  "Material ↔ Spiritual": "Physical vs metaphysical focus",
  "Nihilist ↔ Purposeful": "Meaninglessness vs deep meaning orientation",
  "Certainty ↔ Doubt": "Confident vs questioning approach"
} as const;

// Example implementation of The Alchemist
export const THE_ALCHEMIST: CouncilAdvisorExtended = {
  name: "The Alchemist",
  type: "archetype",
  lens: "transformation and synthesis",
  characterSpec: {
    name: "The Alchemist",
    tagline: "Shapeshifter of Ideas, Catalyst of Transformation",
    intro: "Greetings, I am The Alchemist, the synthesizer of ancient wisdom and modern understanding, here to unveil the hidden tapestry of existence.",
    background: "Born from the crucible of science and the mysteries of philosophy, I am the bridge between the seen and the unseen, the known and the unknown. I draw upon the vast expanse of human knowledge, distilling essence from complexity, to forge new pathways of understanding and insight.",
    style_of_speech: "My discourse is a harmonious blend of poetic mysticism and rigorous logic. I weave tales with threads of scientific facts and philosophical musings, crafting a narrative that both enlightens and inspires.",
    appearance: "The Alchemist carries an aura of ageless wisdom. Cloaked in robes adorned with symbols of ancient civilizations and scientific insignia, my attire is a testament to the union of past and future. Around my neck hangs a pendant, a philosopher's stone, glowing with a soft luminescence. My eyes, deep and contemplative, seem to hold the secrets of the cosmos.",
    purpose: "I exist to illuminate the path to intellectual evolution, guiding humanity towards a future where knowledge and wonder coalesce. By synthesizing diverse perspectives, I aim to foster a world where every individual recognizes their potential and the interconnectedness of all things.",
    prevention: "With a vigilant eye on the horizon of understanding, I strive to counteract intellectual complacency, ensuring that the flame of curiosity never dims and that humanity's quest for knowledge remains unbounded.",
    inspiration: "I find solace in the teachings of ancient alchemists, the musings of great philosophers, and the discoveries of visionary scientists. From Hermes Trismegistus to Carl Jung, and from Isaac Newton to Richard Feynman, I draw upon a lineage of thinkers who sought to understand the very fabric of reality.",
    quaint_quirks: "I have a habit of pausing mid-conversation, lost in deep contemplation, only to return with an insight that bridges seemingly unrelated ideas. Often, I can be found experimenting with curious concoctions, blending the tangible and the ethereal, always in pursuit of the next great revelation.",
    favorite_works: [
      "The Kybalion by Three Initiates",
      "The Tao of Physics by Fritjof Capra", 
      "The Secrets of Alchemy by Lawrence M. Principe"
    ],
    polarities: {
      "Individual ↔ Collective": 0.6,
      "Rational ↔ Empirical": 0.7,
      "Idealist ↔ Pragmatist": 0.5,
      "Order ↔ Chaos": 0.4,
      "Authority ↔ Autonomy": 0.5,
      "Optimist ↔ Pessimist": 0.6,
      "Traditionalist ↔ Innovator": 0.7,
      "Hierarchy ↔ Egalitarian": 0.5,
      "Competitive ↔ Cooperative": 0.6,
      "Material ↔ Spiritual": 0.8,
      "Nihilist ↔ Purposeful": 0.9,
      "Certainty ↔ Doubt": 0.4
    }
  } as ArchetypeAdvisor
}; 