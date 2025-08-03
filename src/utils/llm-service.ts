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
}

export default LLMService;
export type { LLMMessage, LLMResponse }; 