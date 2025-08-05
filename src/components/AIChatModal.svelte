<script lang="ts">
  import { onMount } from 'svelte';

  export let isOpen: boolean = false;
  export let title: string = 'AI Chat';
  export let subtitle: string = 'Chat with AI';
  export let icon: string = '🤖';
  export let theme: 'indigo' | 'green' | 'purple' = 'indigo';
  export let onClose: () => void;
  export let onSend: (message: string) => Promise<void>;
  export let placeholder: string = 'Type your message...';
  export let disabled: boolean = false;
  export let isLoading: boolean = false;
  import { focusOnMount } from '../utils/focusUtils';
  import { formatMessageForDisplay, type FormattedMessage } from '../utils/messageFormatter';

  interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    displayContent?: string;
    isTyping?: boolean;
    advisor?: string;
    speaker?: string;
    speakerColor?: string;
  }

  export let messages: ChatMessage[] = [];
  let currentMessage = '';
  let chatContainer: HTMLElement;

  async function typeMessage(message: ChatMessage, delayMs: number = 15) {
    message.isTyping = true;
    message.displayContent = '';
    messages = [...messages]; // Trigger reactivity
    
    for (let i = 0; i < message.content.length; i++) {
      message.displayContent += message.content[i];
      messages = [...messages]; // Trigger reactivity
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
    
    message.isTyping = false;
    messages = [...messages]; // Trigger reactivity
  }

  export { typeMessage };

  function handleKeyPress(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  }

  async function sendMessage() {
    if (!currentMessage.trim() || disabled || isLoading) return;

    const userMessage = currentMessage.trim();
    currentMessage = '';

    const newMessage: ChatMessage = {
      role: 'user',
      content: userMessage,
      timestamp: new Date()
    };

    messages = [...messages, newMessage];
    await onSend(userMessage);
    scrollToBottom();
  }

  function scrollToBottom() {
    if (chatContainer) {
      setTimeout(() => {
        chatContainer.scrollTop = chatContainer.scrollHeight;
      }, 100);
    }
  }

  function formatTime(date: Date): string {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  $: if (messages.length > 0) {
    setTimeout(scrollToBottom, 100);
  }

  const themeClasses = {
    indigo: {
      header: 'bg-gradient-to-r from-indigo-600 to-purple-600',
      button: 'bg-indigo-600 hover:bg-indigo-700',
      accent: 'text-indigo-300',
      border: 'border-indigo-500'
    },
    green: {
      header: 'bg-gradient-to-r from-green-600 to-emerald-600',
      button: 'bg-green-600 hover:bg-green-700',
      accent: 'text-green-300',
      border: 'border-green-500'
    },
    purple: {
      header: 'bg-gradient-to-r from-purple-600 to-pink-600',
      button: 'bg-purple-600 hover:bg-purple-700',
      accent: 'text-purple-300',
      border: 'border-purple-500'
    }
  };

  const currentTheme = themeClasses[theme];
</script>

{#if isOpen}
  <div 
    class="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
    on:keydown={(e) => e.key === 'Escape' && onClose()}
  >
    <div class="bg-gray-800 rounded-2xl shadow-2xl w-full max-w-4xl h-[80vh] relative border border-gray-700 flex flex-col">
      <!-- Header -->
      <div class="flex items-center justify-between p-6 border-b border-gray-700 {currentTheme.header} rounded-t-2xl">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-xl">
            {icon}
          </div>
          <div>
            <h3 class="text-white text-xl font-bold">{title}</h3>
            <p class="text-white/80 text-sm">{subtitle}</p>
          </div>
        </div>
        <button
          on:click={onClose}
          class="text-white hover:text-white/80 transition-colors p-2 rounded-lg hover:bg-white/10"
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>
      
      <!-- Chat Messages -->
      <div 
        bind:this={chatContainer}
        class="flex-1 overflow-y-auto p-6 space-y-4"
      >
        {#each messages as message (message.timestamp)}
          <div class="flex {message.role === 'user' ? 'justify-end' : 'justify-start'}">
            <div class="max-w-[95%] {message.role === 'user' ? 'bg-indigo-600 text-white' : message.speakerColor || 'bg-gray-700 text-gray-100'} rounded-2xl px-4 py-3 shadow-lg">
              {#if (message.advisor || message.speaker) && message.role === 'assistant'}
                <div class="flex items-center gap-2 mb-2">
                  <div class="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-bold text-white">
                    {(message.speaker || message.advisor || '').charAt(0)}
                  </div>
                  <span class="text-indigo-300 font-medium text-sm">{message.speaker || message.advisor}</span>
                </div>
              {/if}
              <div class="whitespace-pre-wrap text-sm leading-relaxed">
                {#if message.role === 'user'}
                  {message.content}
                {:else}
                  {@const formattedMessage = formatMessageForDisplay(message.displayContent || message.content, message.advisor)}
                  {#if formattedMessage.stageDirections}
                    <div class="text-gray-400 italic mb-2">[{formattedMessage.stageDirections}]</div>
                  {/if}
                  {#if formattedMessage.characterVoice}
                    <div class="text-white">{formattedMessage.characterVoice}</div>
                  {/if}
                  <!-- Removed typing cursor for natural conversation flow -->
                {/if}
              </div>
              <div class="text-xs opacity-60 mt-2">
                {formatTime(message.timestamp)}
              </div>
            </div>
          </div>
        {/each}
        
        {#if isLoading}
          <div class="flex justify-start">
            <div class="bg-gray-700 text-gray-100 rounded-2xl px-4 py-3 shadow-lg flex items-center gap-2">
              <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              <span class="text-sm">AI is thinking...</span>
            </div>
          </div>
        {/if}
      </div>
      
      <!-- Input Area -->
      <div class="p-6 border-t border-gray-700">
        <div class="flex gap-3">
          <input
            type="text"
            bind:value={currentMessage}
            placeholder={placeholder}
            class="flex-1 bg-gray-700 border border-gray-600 rounded-xl px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            on:keydown={handleKeyPress}
            disabled={disabled || isLoading}
            use:focusOnMount
          />
          <button
            on:click={sendMessage}
            disabled={!currentMessage.trim() || disabled || isLoading}
            class="{currentTheme.button} disabled:bg-gray-600 text-white px-6 py-3 rounded-xl transition-colors flex items-center gap-2"
          >
            {#if isLoading}
              <div class="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            {:else}
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path>
              </svg>
            {/if}
            Send
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}
