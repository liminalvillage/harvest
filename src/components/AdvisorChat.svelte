<script lang="ts">
  import { onMount } from 'svelte';
  import type { CouncilAdvisorExtended, ArchetypeAdvisor } from '../types/advisor-schema';
  import type { LLMMessage } from '../utils/llm-service';
  import LLMService from '../utils/llm-service';

  export let advisor: CouncilAdvisorExtended;
  export let isOpen: boolean = false;
  export let onClose: () => void;

  interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
  }

  let chatMessages: ChatMessage[] = [];
  let currentMessage = '';
  let isLoading = false;
  let llmService: LLMService;
  let chatContainer: HTMLElement;
  let error: string = '';

  onMount(() => {
    try {
      llmService = new LLMService();
      addAdvisorGreeting();
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to initialize LLM service';
    }
  });

  function addAdvisorGreeting() {
    if (advisor.type === 'archetype') {
      const spec = advisor.characterSpec as ArchetypeAdvisor;
      chatMessages = [{
        role: 'assistant',
        content: spec.intro || `Greetings! I am ${advisor.name}. How may I guide you today?`,
        timestamp: new Date()
      }];
    } else {
      chatMessages = [{
        role: 'assistant',
        content: `Hello! I'm ${advisor.name}. I'm here to offer guidance through the lens of ${advisor.lens}. What would you like to explore together?`,
        timestamp: new Date()
      }];
    }
  }

  async function sendMessage() {
    if (!currentMessage.trim() || isLoading || !llmService) return;

    const userMessage = currentMessage.trim();
    currentMessage = '';

    chatMessages = [...chatMessages, {
      role: 'user',
      content: userMessage,
      timestamp: new Date()
    }];

    isLoading = true;
    error = '';

    try {
      const conversationHistory: LLMMessage[] = chatMessages
        .slice(1) // Skip the initial greeting
        .map(msg => ({
          role: msg.role,
          content: msg.content
        }));

      const response = await llmService.chatWithAdvisor(
        advisor,
        userMessage,
        conversationHistory
      );

      if (response.error) {
        error = response.error;
      } else {
        chatMessages = [...chatMessages, {
          role: 'assistant',
          content: response.content,
          timestamp: new Date()
        }];
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'An error occurred';
    } finally {
      isLoading = false;
    }

    setTimeout(scrollToBottom, 100);
  }

  function scrollToBottom() {
    if (chatContainer) {
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }
  }

  function handleKeyPress(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  }

  function formatTime(date: Date): string {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  $: if (chatMessages.length > 0) {
    setTimeout(scrollToBottom, 100);
  }
</script>

{#if isOpen}
  <div class="fixed inset-0 z-50 overflow-auto bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
    <div class="bg-gray-800 rounded-3xl shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col border border-gray-700">
      
      <div class="p-6 border-b border-gray-700 flex items-center justify-between bg-gradient-to-r from-gray-800 to-gray-700 rounded-t-3xl">
        <div class="flex items-center gap-4">
          <div class="w-12 h-12 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-xl">
            {advisor.name.charAt(0)}
          </div>
          <div>
            <h2 class="text-2xl font-bold text-white">{advisor.name}</h2>
            <p class="text-gray-300">
              {#if advisor.type === 'archetype'}
                {(advisor.characterSpec as ArchetypeAdvisor).tagline}
              {:else}
                Speaking through the lens of {advisor.lens}
              {/if}
            </p>
          </div>
        </div>
        <button
          on:click={onClose}
          class="text-gray-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-gray-700"
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>

      <div 
        bind:this={chatContainer}
        class="flex-1 overflow-y-auto p-6 space-y-4"
      >
        {#each chatMessages as message (message.timestamp)}
          <div class="flex {message.role === 'user' ? 'justify-end' : 'justify-start'}">
            <div class="max-w-[80%] {message.role === 'user' ? 'bg-indigo-600' : 'bg-gray-700'} rounded-2xl p-4">
              <p class="text-white whitespace-pre-wrap">{message.content}</p>
              <div class="text-xs text-gray-300 mt-2 opacity-70">
                {formatTime(message.timestamp)}
              </div>
            </div>
          </div>
        {/each}

        {#if isLoading}
          <div class="flex justify-start">
            <div class="bg-gray-700 rounded-2xl p-4 flex items-center gap-2">
              <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              <span class="text-white text-sm">{advisor.name} is thinking...</span>
            </div>
          </div>
        {/if}

        {#if error}
          <div class="flex justify-center">
            <div class="bg-red-600 rounded-2xl p-4 max-w-[80%]">
              <p class="text-white text-sm">Error: {error}</p>
            </div>
          </div>
        {/if}
      </div>

      <div class="p-6 border-t border-gray-700 bg-gray-800 rounded-b-3xl">
        <div class="flex gap-3">
          <textarea
            bind:value={currentMessage}
            on:keydown={handleKeyPress}
            placeholder="Ask {advisor.name} for guidance..."
            class="flex-1 bg-gray-700 border border-gray-600 rounded-xl px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
            rows="2"
            disabled={isLoading || !!error}
          ></textarea>
          <button
            on:click={sendMessage}
            disabled={!currentMessage.trim() || isLoading || !!error}
            class="group relative bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 text-white px-6 py-3 rounded-xl transition-all duration-200 font-medium shadow-lg hover:shadow-xl disabled:hover:shadow-lg transform hover:scale-105 disabled:hover:scale-100"
          >
            {#if isLoading}
              <div class="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            {:else}
              Send
            {/if}
          </button>
        </div>
        <div class="text-xs text-gray-400 mt-2">
          Press Enter to send, Shift+Enter for new line
        </div>
      </div>
    </div>
  </div>
{/if} 