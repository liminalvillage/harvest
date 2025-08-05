import type { CouncilAdvisorExtended } from '../types/advisor-schema';
import { createAdvisorPrompt } from './advisor-prompts';

interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface LLMResponse {
  content: string;
  error?: string;
}

class LLMService {
  private apiKey: string;
  private provider: string;
  private model: string;
  private maxTokens: number;
  private temperature: number;

  constructor() {
    this.provider = import.meta.env.VITE_LLM_PROVIDER || 'openai';
    this.model = import.meta.env.VITE_LLM_MODEL || 'gpt-4o-mini';
    this.maxTokens = parseInt(import.meta.env.VITE_LLM_MAX_TOKENS || '2000');
    this.temperature = parseFloat(import.meta.env.VITE_LLM_TEMPERATURE || '0.7');
    
    // Get API key based on provider
    switch (this.provider) {
      case 'openai':
        this.apiKey = import.meta.env.VITE_OPENAI_API_KEY;
        break;
      case 'anthropic':
        this.apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
        break;
      case 'groq':
        this.apiKey = import.meta.env.VITE_GROQ_API_KEY;
        break;
      default:
        throw new Error(`Unsupported LLM provider: ${this.provider}`);
    }

    if (!this.apiKey) {
      throw new Error(`API key not found for provider: ${this.provider}`);
    }
  }

  async sendMessage(messages: LLMMessage[]): Promise<LLMResponse> {
    try {
      switch (this.provider) {
        case 'openai':
          return await this.callOpenAI(messages);
        case 'anthropic':
          return await this.callAnthropic(messages);
        case 'groq':
          return await this.callGroq(messages);
        default:
          throw new Error(`Unsupported provider: ${this.provider}`);
      }
    } catch (error) {
      console.error('LLM Service Error:', error);
      return {
        content: '',
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  private async callOpenAI(messages: LLMMessage[]): Promise<LLMResponse> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        messages: messages,
        max_tokens: this.maxTokens,
        temperature: this.temperature,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText} - ${errorBody}`);
    }

    const data = await response.json();
    return {
      content: data.choices[0]?.message?.content || ''
    };
  }

  private async callAnthropic(messages: LLMMessage[]): Promise<LLMResponse> {
    // Extract system message and user messages
    const systemMessage = messages.find(m => m.role === 'system')?.content || '';
    const userMessages = messages.filter(m => m.role !== 'system');

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: this.maxTokens,
        temperature: this.temperature,
        system: systemMessage,
        messages: userMessages,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Anthropic API error: ${response.status} ${response.statusText} - ${errorBody}`);
    }

    const data = await response.json();
    return {
      content: data.content[0]?.text || ''
    };
  }

  private async callGroq(messages: LLMMessage[]): Promise<LLMResponse> {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        messages: messages,
        max_tokens: this.maxTokens,
        temperature: this.temperature,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Groq API error: ${response.status} ${response.statusText} - ${errorBody}`);
    }

    const data = await response.json();
    return {
      content: data.choices[0]?.message?.content || ''
    };
  }

  // Convenience method for advisor chat
  async chatWithAdvisor(
    advisor: CouncilAdvisorExtended, 
    userMessage: string, 
    conversationHistory: LLMMessage[] = []
  ): Promise<LLMResponse> {
    const { system } = createAdvisorPrompt(advisor, { 
      wish: '', 
      values: [],
      situationContext: 'Direct conversation with advisor'
    });

    const messages: LLMMessage[] = [
      { role: 'system', content: system },
      ...conversationHistory,
      { role: 'user', content: userMessage }
    ];

    return await this.sendMessage(messages);
  }

  // Generate real person advisor
  async generateRealPersonAdvisor(personName: string, lens: string): Promise<LLMResponse> {
    const systemPrompt = `You are an expert historian and biographer. Your task is to create a detailed advisor profile for a real person.

IMPORTANT: First, verify if the name represents a real person (living or deceased) who has made significant contributions to their field. This includes:
- Historical figures from any era
- Contemporary figures who have passed away (even recently)

If the name is ambiguous or fictional, return only: {"valid": false}

If it IS a real person with significant contributions, create a complete JSON schema for a RealPersonAdvisor with the following structure:

{
  "valid": true,
  "name": "Full Name",
  "historical_period": "e.g., Ancient Greece, 19th Century America, 20th Century America, Contemporary, etc.",
  "known_for": ["achievement1", "achievement2", "achievement3"],
  "key_beliefs": ["belief1", "belief2", "belief3"],
  "speaking_style": "Describe their characteristic way of speaking and communicating",
  "notable_quotes": ["quote1", "quote2", "quote3"],
  "expertise_domains": ["domain1", "domain2", "domain3"],
  "personality_traits": ["trait1", "trait2", "trait3"],
  "background_context": "Brief historical context and significance",
  "approach_to_advice": "How this person would approach giving advice",
  "polarities": {
    "Individual ↔ Collective": 0.5,
    "Rational ↔ Empirical": 0.5,
    "Idealist ↔ Pragmatist": 0.5,
    "Order ↔ Chaos": 0.5,
    "Authority ↔ Autonomy": 0.5,
    "Optimist ↔ Pessimist": 0.5,
    "Traditionalist ↔ Innovator": 0.5,
    "Hierarchy ↔ Egalitarian": 0.5,
    "Competitive ↔ Cooperative": 0.5,
    "Material ↔ Spiritual": 0.5,
    "Nihilist ↔ Purposeful": 0.5,
    "Certainty ↔ Doubt": 0.5
  }
}

Focus on the lens/wisdom area: "${lens}". This should influence how you portray their expertise and approach.

Return ONLY valid JSON. No additional text or explanation.`;

    const messages: LLMMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Create an advisor profile for: ${personName}` }
    ];

    return await this.sendMessage(messages);
  }
}

export default LLMService;
export type { LLMMessage, LLMResponse }; 