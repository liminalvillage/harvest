<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type { TypedEventBus } from '../shared/eventBus';
  import type { Podcast } from '../shared/types';

  export let eventBus: TypedEventBus;
  export let show = false;
  export let podcasts: Podcast[] = [];

  let unsubscribe: () => void;

  onMount(() => {
    // Listen for podcast updates
    unsubscribe = eventBus.on('podcast:loaded', (loadedPodcasts) => {
      podcasts = loadedPodcasts;
    });
  });

  onDestroy(() => {
    if (unsubscribe) unsubscribe();
  });

  function close() {
    show = false;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      close();
    }
  }

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      close();
    }
  }
</script>

{#if show}
  <!-- svelte-ignore a11y-no-noninteractive-tabindex -->
  <div
    class="podcast-modal"
    on:click={handleBackdropClick}
    on:keydown={handleKeydown}
    role="dialog"
    aria-modal="true"
    tabindex="0"
  >
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div class="podcast-modal-content" on:click|stopPropagation>
      <div class="podcast-modal-header">
        <h2>Saved Conversations</h2>
        <button class="close-btn" on:click={close} aria-label="Close">×</button>
      </div>

      <div class="podcast-list">
        {#if podcasts.length === 0}
          <p class="no-podcasts">No conversations saved yet</p>
        {:else}
          {#each podcasts as podcast}
            <div class="podcast-item">
              <div class="podcast-info">
                <h3>{podcast.title || 'Untitled Conversation'}</h3>
                <p class="podcast-date">{new Date(podcast.startTime).toLocaleString()}</p>
                <p class="podcast-duration">
                  Duration: {Math.floor(podcast.duration / 60)}m {podcast.duration % 60}s
                </p>
                <p class="podcast-participants">
                  {podcast.participants.length} participant{podcast.participants.length > 1 ? 's' : ''}
                </p>
              </div>

              <div class="podcast-transcript">
                <h4>Transcript:</h4>
                <p>{podcast.fullText || 'No transcript available'}</p>
              </div>
            </div>
          {/each}
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .podcast-modal {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 10000;
    backdrop-filter: blur(4px);
  }

  .podcast-modal-content {
    background: #1e1e1e;
    border-radius: 12px;
    width: 90%;
    max-width: 800px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  }

  .podcast-modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px 24px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .podcast-modal-header h2 {
    margin: 0;
    font-size: 24px;
    color: #fff;
  }

  .close-btn {
    background: none;
    border: none;
    color: #fff;
    font-size: 32px;
    cursor: pointer;
    padding: 0;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    transition: background 0.2s;
  }

  .close-btn:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  .podcast-list {
    flex: 1;
    overflow-y: auto;
    padding: 20px 24px;
    min-height: 0; /* Critical for flex scrolling */
  }

  .no-podcasts {
    text-align: center;
    color: rgba(255, 255, 255, 0.5);
    padding: 40px 20px;
    font-size: 16px;
  }

  .podcast-item {
    background: rgba(255, 255, 255, 0.05);
    border-radius: 8px;
    padding: 16px;
    margin-bottom: 16px;
    transition: background 0.2s;
  }

  .podcast-item:hover {
    background: rgba(255, 255, 255, 0.08);
  }

  .podcast-info h3 {
    margin: 0 0 8px 0;
    font-size: 18px;
    color: #fff;
  }

  .podcast-info p {
    margin: 4px 0;
    font-size: 14px;
    color: rgba(255, 255, 255, 0.7);
  }

  .podcast-date {
    color: rgba(255, 255, 255, 0.5);
    font-size: 13px;
  }

  .podcast-transcript {
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
  }

  .podcast-transcript h4 {
    margin: 0 0 8px 0;
    font-size: 14px;
    color: rgba(255, 255, 255, 0.8);
    font-weight: 600;
  }

  .podcast-transcript p {
    margin: 0;
    font-size: 14px;
    line-height: 1.6;
    color: rgba(255, 255, 255, 0.9);
    max-height: 120px;
    overflow-y: auto;
  }

  .podcast-list::-webkit-scrollbar,
  .podcast-transcript p::-webkit-scrollbar {
    width: 6px;
  }

  .podcast-list::-webkit-scrollbar-track,
  .podcast-transcript p::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.05);
    border-radius: 3px;
  }

  .podcast-list::-webkit-scrollbar-thumb,
  .podcast-transcript p::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.2);
    border-radius: 3px;
  }

  .podcast-list::-webkit-scrollbar-thumb:hover,
  .podcast-transcript p::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.3);
  }

  /* Mobile adjustments */
  @media (max-width: 768px) {
    .podcast-modal-content {
      width: 95%;
      max-height: 95vh;
    }

    .podcast-modal-header {
      padding: 16px;
    }

    .podcast-modal-header h2 {
      font-size: 20px;
    }

    .podcast-list {
      padding: 16px;
    }

    .podcast-item {
      padding: 12px;
    }
  }
</style>
