<script lang="ts">
    import { createEventDispatcher, getContext, onMount } from 'svelte';
    import { formatDate, formatTime } from '../utils/date.js';
    import HoloSphere from 'holosphere';

    const holosphere = getContext("holosphere") as HoloSphere;

    export let filteredQuests: [string, any][];
    export let holonID: string;
    export let showCompleted: boolean;

    const dispatch = createEventDispatcher();
    let canvas: HTMLElement;
    let container: HTMLElement;
    let viewContainer: HTMLElement;
    let isDragging = false;
    let draggedCard: { key: string; quest: any; x: number; y: number; } | null = null;
    let offset = { x: 0, y: 0 };
    let zoom = 1;
    let pan = { x: 0, y: 0 };
    let startPan = { x: 0, y: 0 };
    let isPanning = false;
    let draggedCardVisuals: { key: string; x: number; y: number } | null = null;

    // Update canvas dimensions to be very large for an "infinite" feel
    const CANVAS_WIDTH = 30000;
    const CANVAS_HEIGHT = 30000;
    const INITIAL_OFFSET = { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 };

    // Initialize positions if not set - move this out of the reactive statement
    let questCards: { key: string; quest: any; x: number; y: number; }[] = [];

    // questCards is now purely derived from filteredQuests.
    // This ensures it always reflects the latest positions from props when not actively dragging.
    $: questCards = filteredQuests
        .filter(([_, quest]) => showCompleted || quest.status !== 'completed')
        .map(([key, quest]) => ({
            key,
            quest,
            // Use nullish coalescing (??) to respect a position of 0.
            x: quest.position?.x ?? (INITIAL_OFFSET.x + Math.random() * 800),
            y: quest.position?.y ?? (INITIAL_OFFSET.y + Math.random() * 500)
        }));

    function handleMouseDown(event: MouseEvent, card: typeof questCards[0] | null = null) {
        event.preventDefault();
        event.stopPropagation();
        
        if (event.button === 1 || event.button === 2 || !card) {
            isPanning = true;
            startPan = { 
                x: event.clientX - pan.x, 
                y: event.clientY - pan.y 
            };
            return;
        }

        if (event.button === 0 && card) {
            isDragging = true;
            draggedCard = card;
            draggedCardVisuals = { key: card.key, x: card.x, y: card.y };
            
            const rect = canvas.getBoundingClientRect();
            const mouseX = (event.clientX - rect.left - pan.x) / zoom;
            const mouseY = (event.clientY - rect.top - pan.y) / zoom;
            
            offset = {
                x: mouseX - card.x,
                y: mouseY - card.y
            };
        }
    }

    function handleMouseMove(event: MouseEvent) {
        event.preventDefault();
        event.stopPropagation();
        
        if (isPanning && viewContainer) {
            const newPan = {
                x: (event.clientX - startPan.x),
                y: (event.clientY - startPan.y)
            };
            
            // Remove Panning Constraints
            pan = newPan;
            return;
        }

        if (!isDragging || !draggedCardVisuals || !canvas) return;

        const rect = canvas.getBoundingClientRect();
        const mouseX = (event.clientX - rect.left - pan.x) / zoom;
        const mouseY = (event.clientY - rect.top - pan.y) / zoom;
        const newX = mouseX - offset.x;
        const newY = mouseY - offset.y;

        // Remove card position constraints
        draggedCardVisuals.x = newX;
        draggedCardVisuals.y = newY;
    }

    function handleMouseUp(event: MouseEvent) {
        event.preventDefault();
        event.stopPropagation();
        
        const wasDragging = isDragging;
        // Use draggedCard (original data) and draggedCardVisuals (final position)
        const finalDraggedCardData = draggedCard; 
        const finalVisualPosition = draggedCardVisuals;
        
        // Reset states first
        isDragging = false;
        draggedCard = null;
        draggedCardVisuals = null; // Reset visual state
        isPanning = false;
        
        // Then handle the update
        if (wasDragging && finalDraggedCardData && finalVisualPosition && holonID) {
            const newPosition = { x: finalVisualPosition.x, y: finalVisualPosition.y };
            const updatedQuest = { 
                ...finalDraggedCardData.quest, 
                position: newPosition 
            };
            
            holosphere.put(holonID, `quests/${finalDraggedCardData.key}`, updatedQuest)
                .catch(error => console.error('Error updating quest position:', error));

            // Dispatch an event so Tasks.svelte can optimistically update its store
            dispatch('questPositionChanged', {
                key: finalDraggedCardData.key,
                position: newPosition
            });
        }
    }

    // Add these state variables at the top
    let targetZoom = zoom;
    let lastMouseX = 0;
    let lastMouseY = 0;

    function handleWheel(event: WheelEvent) {
        event.preventDefault();
        
        if (event.ctrlKey || event.metaKey) {
            // Store mouse position relative to canvas
            const rect = viewContainer.getBoundingClientRect();
            lastMouseX = event.clientX - rect.left;
            lastMouseY = event.clientY - rect.top;

            // Calculate the point on canvas under mouse BEFORE zoom
            const canvasX = (lastMouseX - pan.x) / zoom;
            const canvasY = (lastMouseY - pan.y) / zoom;

            // Update zoom
            const zoomFactor = event.deltaY > 0 ? 0.95 : 1.05;
            zoom = Math.min(Math.max(0.25, zoom * zoomFactor), 2);

            // Calculate new pan to keep the same canvas point under mouse
            pan = {
                x: lastMouseX - (canvasX * zoom),
                y: lastMouseY - (canvasY * zoom)
            };

            // Remove Panning constraints for zoom
            // const rect2 = viewContainer.getBoundingClientRect();
            // pan = {
            //     x: Math.min(Math.max(pan.x, -CANVAS_WIDTH * zoom + rect2.width), 0),
            //     y: Math.min(Math.max(pan.y, -CANVAS_HEIGHT * zoom + rect2.height), 0)
            // };
        } else {
            // Simple panning - Remove Panning constraints
            pan = {
                x: pan.x - event.deltaX,
                y: pan.y - event.deltaY
            };
        }
    }

    // Add this to handle fullscreen toggle
    let isFullscreen = false;

    function requestFullscreen(element: HTMLElement) {
        if (element.requestFullscreen) {
            element.requestFullscreen();
        } else if ((element as any).webkitRequestFullscreen) {
            (element as any).webkitRequestFullscreen(); // Safari
        } else if ((element as any).msRequestFullscreen) {
            (element as any).msRequestFullscreen(); // IE11
        }
    }

    function exitFullscreen() {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if ((document as any).webkitExitFullscreen) {
            (document as any).webkitExitFullscreen(); // Safari
        } else if ((document as any).msExitFullscreen) {
            (document as any).msExitFullscreen(); // IE11
        }
    }

    function toggleFullscreen() {
        isFullscreen = !isFullscreen;
        if (isFullscreen) {
            requestFullscreen(viewContainer);
        } else {
            exitFullscreen();
        }
    }

    // Add these state variables at the top
    let touchStartDistance = 0;
    let touchStartZoom = 1;
    let touchStartPan = { x: 0, y: 0 };

    // Add these touch event handlers
    function handleTouchStart(event: TouchEvent) {
        event.preventDefault();
        
        if (event.touches.length === 2) {
            // Pinch to zoom
            const touch1 = event.touches[0];
            const touch2 = event.touches[1];
            touchStartDistance = Math.hypot(
                touch2.clientX - touch1.clientX,
                touch2.clientY - touch1.clientY
            );
            touchStartZoom = zoom;
            touchStartPan = { ...pan };
            
            // Calculate the midpoint (center of zoom)
            const rect = viewContainer.getBoundingClientRect();
            lastMouseX = ((touch1.clientX + touch2.clientX) / 2) - rect.left;
            lastMouseY = ((touch1.clientY + touch2.clientY) / 2) - rect.top;
        } else if (event.touches.length === 1) {
            // Single touch for panning or dragging
            const touch = event.touches[0];
            startPan = {
                x: touch.clientX - pan.x,
                y: touch.clientY - pan.y
            };
            isPanning = true;
        }
    }

    function handleTouchMove(event: TouchEvent) {
        event.preventDefault();
        
        if (event.touches.length === 2) {
            // Handle pinch zoom
            const touch1 = event.touches[0];
            const touch2 = event.touches[1];
            const currentDistance = Math.hypot(
                touch2.clientX - touch1.clientX,
                touch2.clientY - touch1.clientY
            );
            
            // Calculate new zoom
            const zoomDelta = currentDistance / touchStartDistance;
            const newZoom = Math.min(Math.max(0.25, touchStartZoom * zoomDelta), 2);
            
            // Calculate the point on canvas under the midpoint
            const canvasX = (lastMouseX - touchStartPan.x) / touchStartZoom;
            const canvasY = (lastMouseY - touchStartPan.y) / touchStartZoom;
            
            // Update zoom and pan to keep the point under the midpoint
            zoom = newZoom;
            pan = {
                x: lastMouseX - (canvasX * zoom),
                y: lastMouseY - (canvasY * zoom)
            };
            
            // Remove Panning constraints for touch zoom
            // const rect = viewContainer.getBoundingClientRect();
            // pan = {
            //     x: Math.min(Math.max(pan.x, -CANVAS_WIDTH * zoom + rect.width), 0),
            //     y: Math.min(Math.max(pan.y, -CANVAS_HEIGHT * zoom + rect.height), 0)
            // };
        } else if (event.touches.length === 1 && isPanning) {
            // Handle panning - Remove Panning constraints
            const touch = event.touches[0];
            pan = {
                x: touch.clientX - startPan.x,
                y: touch.clientY - startPan.y
            };
        }
    }

    function handleTouchEnd(event: TouchEvent) {
        if (event.touches.length === 0) {
            isPanning = false;
        }
    }

    // Initialize from localStorage or use defaults
    if (typeof window !== 'undefined') {
        const savedView = localStorage.getItem('canvasViewState');
        if (savedView) {
            const { zoom: savedZoom, pan: savedPan } = JSON.parse(savedView);
            zoom = savedZoom;
            pan = savedPan;
        }
    }

    // Save view state whenever pan or zoom changes
    $: if (typeof window !== 'undefined') {
        localStorage.setItem('canvasViewState', JSON.stringify({ zoom, pan }));
    }

    onMount(() => {
        if (!canvas || !viewContainer) return;

        const handleGlobalMouseMove = (e: MouseEvent) => {
            if (isDragging || isPanning) {
                handleMouseMove(e);
            }
        };
        
        const handleGlobalMouseUp = (e: MouseEvent) => {
            if (isDragging || isPanning) {
                handleMouseUp(e);
            }
        };
        
        window.addEventListener('mousemove', handleGlobalMouseMove, { passive: false });
        window.addEventListener('mouseup', handleGlobalMouseUp, { passive: false });
        viewContainer.addEventListener('wheel', handleWheel, { passive: false });

        // Only center the view if there's no saved state
        if (!localStorage.getItem('canvasViewState')) {
            const containerRect = viewContainer.getBoundingClientRect();
            pan = { 
                x: -INITIAL_OFFSET.x + containerRect.width / 2, 
                y: -INITIAL_OFFSET.y + containerRect.height / 2 
            };
        }

        const handleFullscreenChange = () => {
            isFullscreen = !!(
                document.fullscreenElement ||
                (document as any).webkitFullscreenElement ||
                (document as any).msFullscreenElement
            );
        };
        
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
        document.addEventListener('MSFullscreenChange', handleFullscreenChange);

        return () => {
            window.removeEventListener('mousemove', handleGlobalMouseMove);
            window.removeEventListener('mouseup', handleGlobalMouseUp);
            viewContainer?.removeEventListener('wheel', handleWheel);
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
            document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
            document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
            
            // Clean up touch events if needed
            if (viewContainer) {
                viewContainer.removeEventListener('touchstart', handleTouchStart);
                viewContainer.removeEventListener('touchmove', handleTouchMove);
                viewContainer.removeEventListener('touchend', handleTouchEnd);
            }
        };
    });

    // Add the getColorFromCategory function
    function getColorFromCategory(category: string | null) {
        if (!category) return '#E5E7EB'; // Light gray (gray-200) for items without category
        
        // Simple string hash function
        let hash = 0;
        for (let i = 0; i < category.length; i++) {
            hash = ((hash << 5) - hash) + category.charCodeAt(i);
            hash = hash & hash;
        }
        
        // Generate HSL color with consistent saturation and lightness
        const hue = Math.abs(hash % 360);
        return `hsl(${hue}, 70%, 85%)`; // Pastel colors with good contrast for text
    }
</script>

<div 
    class="w-full relative overflow-hidden bg-gray-900 rounded-lg transition-all duration-200"
    class:h-[600px]={!isFullscreen}
    class:fixed={isFullscreen}
    class:inset-0={isFullscreen}
    class:z-50={isFullscreen}
    class:rounded-none={isFullscreen}
    class:cursor-grab={!isDragging && !isPanning}
    class:cursor-grabbing={(isDragging || isPanning)}
    bind:this={viewContainer}
    on:mousedown|preventDefault|stopPropagation={(e) => handleMouseDown(e)}
    on:touchstart|preventDefault={handleTouchStart}
    on:touchmove|preventDefault={handleTouchMove}
    on:touchend|preventDefault={handleTouchEnd}
    on:contextmenu|preventDefault
    role="presentation"
>
    <!-- Add fullscreen toggle button -->
    <button 
        class="absolute top-4 right-4 z-10 p-2 bg-gray-800/50 hover:bg-gray-700 rounded-lg text-white/70 hover:text-white/90 transition-colors"
        on:click={toggleFullscreen}
        aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
    >
        {#if isFullscreen}
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
        {:else}
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 3h6m0 0v6m0-6L13 11m-4 10H3m0 0v-6m0 6l8-8" />
            </svg>
        {/if}
    </button>

    <div 
        bind:this={canvas}
        class="absolute w-full h-full"
        style="width: {CANVAS_WIDTH}px; height: {CANVAS_HEIGHT}px; transform: translate({pan.x}px, {pan.y}px) scale({zoom}); transform-origin: 0 0;"
    >
        <!-- Grid background -->
        <div class="absolute inset-0 grid-background"></div>

        {#each questCards as card (card.key)}
            <div
                class="absolute task-card"
                class:cursor-move={!isDragging}
                class:cursor-grabbing={isDragging && draggedCardVisuals?.key === card.key}
                style="left: {(draggedCardVisuals && draggedCardVisuals.key === card.key ? draggedCardVisuals.x : card.x)}px; 
                       top:  {(draggedCardVisuals && draggedCardVisuals.key === card.key ? draggedCardVisuals.y : card.y)}px; 
                       transform: scale(1); transform-origin: top left;"
                on:mousedown|stopPropagation={(e) => handleMouseDown(e, card)}
                role="presentation"
            >
                <div 
                    class="w-64 p-4 rounded-xl shadow-lg border-2 bg-opacity-90"
                    style="background-color: {card.quest.status === 'completed' ? 
                        'rgba(34, 197, 94, 0.95)' : 
                        card.quest.category ? 
                            getColorFromCategory(card.quest.category) : 
                            'rgba(55, 65, 81, 0.95)'}; 
                        border-color: {card.quest.status === 'completed' ? 
                            'rgba(34, 197, 94, 0.9)' : 
                            card.quest.category ? 
                                getColorFromCategory(card.quest.category) : 
                                'rgba(75, 85, 101, 0.9)'};
                        opacity: {card.quest.status === 'completed' ? '0.6' : '1'}"
                >
                    <h3 class="text-white font-bold mb-2">{card.quest.title}</h3>
                    {#if card.quest.description}
                        <p class="text-gray-300 text-sm mb-3 line-clamp-2">{card.quest.description}</p>
                    {/if}
                    
                    <div class="flex justify-between items-center text-gray-300 text-sm">
                        <div class="flex items-center gap-2">
                            <span>👥 {card.quest.participants?.length || 0}</span>
                            <span>❤️ {card.quest.appreciation?.length || 0}</span>
                        </div>
                        {#if card.quest.when}
                            <span>{formatTime(card.quest.when)}</span>
                        {/if}
                    </div>

                    {#if card.quest.category}
                        <div class="mt-2 inline-block px-2 py-1 rounded-full text-xs text-white" 
                             style="background-color: rgba(75, 85, 101, 0.8)">
                            {card.quest.category}
                        </div>
                    {/if}

                    {#if card.quest.participants?.length > 0}
                        <div class="mt-2 flex -space-x-2">
                            {#each card.quest.participants.slice(0, 3) as participant}
                                <img
                                    class="w-6 h-6 rounded-full border-2 border-gray-700"
                                    src={`https://gun.holons.io/getavatar?user_id=${participant.id}`}
                                    alt={participant.username}
                                />
                            {/each}
                            {#if card.quest.participants.length > 3}
                                <div class="w-6 h-6 rounded-full bg-gray-700 flex items-center justify-center text-xs text-white border-2 border-gray-600">
                                    +{card.quest.participants.length - 3}
                                </div>
                            {/if}
                        </div>
                    {/if}
                </div>
            </div>
        {/each}
    </div>
</div>

<style>
    .grid-background {
        background-image: 
            linear-gradient(to right, rgba(255, 255, 255, 0.05) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255, 255, 255, 0.05) 1px, transparent 1px);
        background-size: 40px 40px;
    }

    .task-card {
        transform: translate3d(0, 0, 0);
        backface-visibility: hidden;
        -webkit-font-smoothing: subpixel-antialiased;
    }

    .cursor-move {
        user-select: none;
    }

    div {
        scrollbar-width: none;
        -ms-overflow-style: none;
    }
    
    div::-webkit-scrollbar {
        display: none;
    }

    /* Prevent text from becoming blurry during transforms */
    :global(.task-card *) {
        transform: translateZ(0);
    }

    /* Add styles for fullscreen mode */
    :global(body:has(.fixed)) {
        overflow: hidden;
    }

    /* Add these fullscreen styles */
    :global(.fixed) {
        position: fixed !important;
        width: 100% !important;
        height: 100% !important;
        max-width: 100% !important;
        max-height: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        overflow: hidden !important;
    }

    :global(:fullscreen),
    :global(:-webkit-full-screen),
    :global(:-ms-fullscreen) {
        width: 100% !important;
        height: 100% !important;
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        right: 0 !important;
        bottom: 0 !important;
        z-index: 999999 !important;
        background: #1a1a1a !important;
    }
</style> 