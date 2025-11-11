<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type { TypedEventBus } from '../shared/eventBus';
  import type { TranscriptionSegment } from '../shared/types';

  export let eventBus: TypedEventBus;
  export let isRecording = false;

  let segments: TranscriptionSegment[] = [];
  let transcriptContainer: HTMLDivElement;
  let unsubscribe: () => void;
  let showLoadingMessage = true;
  let loadingTimer: number;

  onMount(() => {
    // Listen for new transcription segments
    unsubscribe = eventBus.on('transcription:segment', (segment) => {
      showLoadingMessage = false; // Hide loading once first segment arrives
      segments = [...segments, segment];

      // Auto-scroll to bottom
      setTimeout(() => {
        if (transcriptContainer) {
          transcriptContainer.scrollTop = transcriptContainer.scrollHeight;
        }
      }, 50);
    });

    // Clear segments when recording starts
    eventBus.on('transcription:started', () => {
      segments = [];
      showLoadingMessage = true; // Show loading message

      // Hide loading message after 10 seconds even if no transcript
      if (loadingTimer) clearTimeout(loadingTimer);
      loadingTimer = window.setTimeout(() => {
        showLoadingMessage = false;
      }, 10000);
    });
  });

  onDestroy(() => {
    if (unsubscribe) unsubscribe();
  });

  // Create continuous text from segments
  $: fullText = segments.map(s => s.text).join(' ');
</script>

{#if isRecording}
  <div class="transcript-panel">
    <div class="transcript-header">
      <span class="transcript-title">Live Transcription</span>
      <span class="recording-indicator">● REC</span>
    </div>

    <div class="transcript-content" bind:this={transcriptContainer}>
      {#if segments.length === 0}
        <div class="transcript-waiting">
          {#if showLoadingMessage}
            <span>⏳ Transcription loading... (7 seconds)</span>
          {:else}
            <span>🎤 Listening... Speak into your microphone</span>
          {/if}
        </div>
      {:else}
        <div class="transcript-text">
          {fullText}
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .transcript-panel {
    position: fixed;
    bottom: 80px;
    right: 20px;
    width: 350px;
    max-height: 250px;
    background: rgba(0, 0, 0, 0.85);
    backdrop-filter: blur(10px);
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    display: flex;
    flex-direction: column;
    z-index: 50; /* Below everything */
    pointer-events: none; /* Don't block clicks */
  }

  .transcript-panel > * {
    pointer-events: auto; /* But allow interaction with panel content */
  }

  .transcript-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .transcript-title {
    font-size: 14px;
    font-weight: 600;
    color: #fff;
  }

  .recording-indicator {
    color: #ff4444;
    font-size: 12px;
    font-weight: 600;
    animation: pulse 2s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  .transcript-content {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    max-height: 250px;
  }

  .transcript-waiting {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100px;
    color: rgba(255, 255, 255, 0.5);
    font-size: 14px;
  }

  .transcript-text {
    color: #fff;
    font-size: 15px;
    line-height: 1.6;
    white-space: pre-wrap;
    word-wrap: break-word;
  }

  .transcript-content::-webkit-scrollbar {
    width: 6px;
  }

  .transcript-content::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.05);
    border-radius: 3px;
  }

  .transcript-content::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.2);
    border-radius: 3px;
  }

  .transcript-content::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.3);
  }

  /* Mobile adjustments */
  @media (max-width: 768px) {
    .transcript-panel {
      width: calc(100% - 40px);
      max-height: 150px;
      bottom: 70px; /* Above mobile controls */
      right: 20px;
      left: 20px;
    }
  }
</style>
