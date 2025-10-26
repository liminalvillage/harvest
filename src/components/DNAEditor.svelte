<script lang="ts">
  // DNAEditor component - Main DNA editor interface
  // Feature: 001-holon-dna-editor

  import { onMount, onDestroy } from 'svelte';
  import type HoloSphere from 'holosphere';
  import type { Chromosome } from '$lib/dna/types';
  import {
    getDNASequence,
    getChromosomeLibrary,
    getChromosome,
    saveDNASequence,
    subscribeToDNASequence,
    subscribeToChromosomeLibrary
  } from '$lib/dna/holosphere';
  import { validateDNASequence } from '$lib/dna/validation';
  import ChromosomeLibrary from './ChromosomeLibrary.svelte';
  import DNASequence from './DNASequence.svelte';

  interface Props {
    holosphere: HoloSphere;
    holonId: string;
  }

  let { holosphere, holonId }: Props = $props();

  // State
  let library = $state<Chromosome[]>([]);
  let currentSequence = $state<Chromosome[]>([]);
  let isLoadingLibrary = $state(true);
  let isLoadingSequence = $state(true);
  let isSaving = $state(false);
  let showLibrary = $state(true);
  let saveError = $state<string | null>(null);
  let saveSuccess = $state(false);
  let currentVersion = $state(0);
  let isOnline = $state(true);
  let isSyncing = $state(false);

  // Unsubscribe functions
  let unsubscribeDNA: (() => void) | null = null;
  let unsubscribeLibrary: (() => void) | null = null;

  // Derived
  const selectedChromosomeIds = $derived(currentSequence.map(c => c.id));
  const hasUnsavedChanges = $state(false);

  onMount(async () => {
    await loadInitialData();
    setupRealTimeSync();
  });

  onDestroy(() => {
    // Clean up subscriptions
    if (unsubscribeDNA) unsubscribeDNA();
    if (unsubscribeLibrary) unsubscribeLibrary();
  });

  async function loadInitialData() {
    try {
      // Load library and DNA sequence in parallel
      const [libraryData, dnaData] = await Promise.all([
        getChromosomeLibrary(holosphere, holonId),
        getDNASequence(holosphere, holonId)
      ]);

      library = libraryData;
      isLoadingLibrary = false;

      if (dnaData) {
        // Load full chromosome objects from IDs
        const chromosomePromises = dnaData.chromosomeIds.map(id =>
          getChromosome(holosphere, holonId, id)
        );
        const chromosomes = await Promise.all(chromosomePromises);
        currentSequence = chromosomes.filter(c => c !== null) as Chromosome[];
        currentVersion = dnaData.version || 0;
      }

      isLoadingSequence = false;
    } catch (error) {
      console.error('Failed to load DNA editor data:', error);
      isLoadingLibrary = false;
      isLoadingSequence = false;
    }
  }

  function setupRealTimeSync() {
    // Subscribe to DNA sequence changes
    unsubscribeDNA = subscribeToDNASequence(holosphere, holonId, async (dna) => {
      if (dna && dna.version > currentVersion) {
        isSyncing = true;
        // Load updated chromosomes
        const chromosomePromises = dna.chromosomeIds.map(id =>
          getChromosome(holosphere, holonId, id)
        );
        const chromosomes = await Promise.all(chromosomePromises);
        currentSequence = chromosomes.filter(c => c !== null) as Chromosome[];
        currentVersion = dna.version;
        isSyncing = false;
      }
    });

    // Subscribe to library changes
    unsubscribeLibrary = subscribeToChromosomeLibrary(holosphere, holonId, (chromosome, chromosomeId) => {
      if (chromosome === null) {
        // Chromosome removed
        library = library.filter(c => c.id !== chromosomeId);
      } else {
        // Chromosome added or updated
        const existingIndex = library.findIndex(c => c.id === chromosome.id);
        if (existingIndex >= 0) {
          library[existingIndex] = chromosome;
        } else {
          library = [...library, chromosome];
        }
      }
    });
  }

  async function handleSave() {
    if (isSaving) return;

    try {
      isSaving = true;
      saveError = null;
      saveSuccess = false;

      // Validate before saving
      const validation = validateDNASequence(
        {
          holonId,
          chromosomeIds: currentSequence.map(c => c.id),
          createdAt: Date.now(),
          updatedAt: Date.now(),
          version: currentVersion + 1
        },
        library
      );

      if (!validation.isValid) {
        saveError = validation.errors.join(', ');
        isSaving = false;
        return;
      }

      // Save to holosphere
      const saved = await saveDNASequence(
        holosphere,
        holonId,
        currentSequence.map(c => c.id),
        currentVersion
      );

      currentVersion = saved.version;
      saveSuccess = true;
      setTimeout(() => {
        saveSuccess = false;
      }, 3000);
    } catch (error) {
      console.error('Failed to save DNA:', error);
      saveError = error instanceof Error ? error.message : 'Failed to save DNA sequence';
      isOnline = false; // Assume offline on error
    } finally {
      isSaving = false;
    }
  }

  function handleSelectChromosome(chromosomeId: string) {
    // Check if already in sequence
    if (selectedChromosomeIds.includes(chromosomeId)) {
      return;
    }

    // Check max length
    if (currentSequence.length >= 20) {
      alert('Maximum 20 chromosomes allowed in DNA sequence');
      return;
    }

    // Find chromosome in library and add to sequence
    const chromosome = library.find(c => c.id === chromosomeId);
    if (chromosome) {
      currentSequence = [...currentSequence, chromosome];
    }
  }

  function handleRemoveChromosome(chromosomeId: string) {
    currentSequence = currentSequence.filter(c => c.id !== chromosomeId);
  }

  function handleReorderSequence(newOrder: Chromosome[]) {
    currentSequence = newOrder;
  }

  function toggleLibrary() {
    showLibrary = !showLibrary;
  }
</script>

<div class="dna-editor">
  <!-- Header with Save Button and Status -->
  <header class="editor-header">
    <div class="header-content">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">
        DNA Editor
      </h1>

      <div class="header-actions">
        <!-- Connection Status -->
        <div class="status-indicator">
          {#if isSyncing}
            <span class="status-badge syncing">
              <svg class="animate-spin w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Syncing...
            </span>
          {:else if !isOnline}
            <span class="status-badge offline">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414" />
              </svg>
              Offline
            </span>
          {:else}
            <span class="status-badge online">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
              Online
            </span>
          {/if}
        </div>

        <!-- Save Button -->
        <button
          type="button"
          class="btn-save"
          onclick={handleSave}
          disabled={isSaving || currentSequence.length === 0}
        >
          {#if isSaving}
            <svg class="animate-spin w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Saving...
          {:else}
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
            </svg>
            Save DNA
          {/if}
        </button>
      </div>
    </div>

    <!-- Notifications -->
    {#if saveSuccess}
      <div class="notification success">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        DNA sequence saved successfully!
      </div>
    {/if}

    {#if saveError}
      <div class="notification error">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        {saveError}
        <button
          type="button"
          class="ml-2 text-sm underline"
          onclick={() => saveError = null}
        >
          Dismiss
        </button>
      </div>
    {/if}
  </header>

  <!-- Main Content Area -->
  <div class="editor-content">
    <!-- Sidebar: Chromosome Library -->
    <aside class="library-sidebar" class:collapsed={!showLibrary}>
    <button
      type="button"
      class="toggle-btn"
      onclick={toggleLibrary}
      aria-label={showLibrary ? 'Hide library' : 'Show library'}
    >
      <svg
        class="w-5 h-5 transition-transform"
        class:rotate-180={!showLibrary}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
      </svg>
    </button>

    {#if showLibrary}
      <ChromosomeLibrary
        {library}
        {selectedChromosomeIds}
        onSelectChromosome={handleSelectChromosome}
        isLoading={isLoadingLibrary}
      />
    {/if}
  </aside>

    <!-- Main: DNA Sequence -->
    <main class="sequence-main">
      <DNASequence
        sequence={currentSequence}
        onRemoveChromosome={handleRemoveChromosome}
        onReorderSequence={handleReorderSequence}
        isLoading={isLoadingSequence}
      />
    </main>
  </div>
</div>

<style>
  .dna-editor {
    @apply flex flex-col h-full bg-gray-50 dark:bg-gray-900;
  }

  .editor-header {
    @apply bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700;
    @apply px-6 py-4 flex-shrink-0;
  }

  .header-content {
    @apply flex items-center justify-between gap-4;
  }

  .header-actions {
    @apply flex items-center gap-4;
  }

  .status-indicator {
    @apply flex items-center;
  }

  .status-badge {
    @apply flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium;
  }

  .status-badge.online {
    @apply bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200;
  }

  .status-badge.offline {
    @apply bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200;
  }

  .status-badge.syncing {
    @apply bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200;
  }

  .btn-save {
    @apply flex items-center gap-2 px-4 py-2 rounded-lg;
    @apply bg-blue-600 dark:bg-blue-500 text-white;
    @apply hover:bg-blue-700 dark:hover:bg-blue-600;
    @apply disabled:opacity-50 disabled:cursor-not-allowed;
    @apply transition-all font-medium shadow-sm;
  }

  .btn-save:not(:disabled):hover {
    @apply shadow-md;
  }

  .notification {
    @apply flex items-center gap-2 px-4 py-3 mt-3 rounded-lg text-sm font-medium;
  }

  .notification.success {
    @apply bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200;
  }

  .notification.error {
    @apply bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200;
  }

  .editor-content {
    @apply flex flex-1 overflow-hidden;
  }

  .library-sidebar {
    @apply w-96 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700;
    @apply flex-shrink-0 relative transition-all duration-300;
  }

  .library-sidebar.collapsed {
    @apply w-12;
  }

  .toggle-btn {
    @apply absolute top-4 -right-3 z-10;
    @apply w-6 h-6 rounded-full bg-white dark:bg-gray-800;
    @apply border border-gray-300 dark:border-gray-600;
    @apply flex items-center justify-center;
    @apply text-gray-600 dark:text-gray-400;
    @apply hover:bg-gray-100 dark:hover:bg-gray-700;
    @apply transition-colors shadow-sm;
  }

  .sequence-main {
    @apply flex-1 bg-white dark:bg-gray-800;
    @apply overflow-hidden;
  }

  /* Responsive design */
  @media (max-width: 768px) {
    .editor-content {
      @apply flex-col;
    }

    .header-content {
      @apply flex-col items-start gap-3;
    }

    .header-actions {
      @apply w-full justify-between;
    }

    .library-sidebar {
      @apply w-full border-r-0 border-b border-gray-200 dark:border-gray-700;
      @apply max-h-64;
    }

    .library-sidebar.collapsed {
      @apply max-h-12 w-full;
    }

    .toggle-btn {
      @apply top-auto bottom-4 right-4;
    }
  }
</style>
