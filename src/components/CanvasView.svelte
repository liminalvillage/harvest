<script lang="ts">
    import { createEventDispatcher, getContext, onMount } from 'svelte';
    import { formatDate, formatTime } from '../utils/date.js';

    const holosphere = getContext("holosphere");

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

    // Update canvas dimensions
    const CANVAS_WIDTH = 3000;
    const CANVAS_HEIGHT = 3000;
    const INITIAL_OFFSET = { x: CANVAS_WIDTH / 4, y: CANVAS_HEIGHT / 4 };

    // Add viewport boundaries
    let bounds = {
        minX: -CANVAS_WIDTH + 100,
        maxX: CANVAS_WIDTH - 100,
        minY: -CANVAS_HEIGHT + 100,
        maxY: CANVAS_HEIGHT - 100
    };

    // Initialize positions if not set - move this out of the reactive statement
    let questCards: { key: string; quest: any; x: number; y: number; }[] = [];

    // Update this to only set initial positions once when filteredQuests changes
    $: {
        questCards = filteredQuests
            .filter(([_, quest]) => showCompleted || quest.status !== 'completed')
            .map(([key, quest]) => {
                // Try to find existing card to preserve its position
                const existingCard = questCards.find(card => card.key === key);
                if (existingCard) {
                    return existingCard;
                }
                
                // Only create new position for new cards
                return {
                    key,
                    quest,
                    x: quest.position?.x || INITIAL_OFFSET.x + Math.random() * 800,
                    y: quest.position?.y || INITIAL_OFFSET.y + Math.random() * 500
                };
            });
    }

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
            
            // Constrain panning
            pan = {
                x: Math.min(Math.max(newPan.x, -CANVAS_WIDTH + viewContainer.clientWidth), 0),
                y: Math.min(Math.max(newPan.y, -CANVAS_HEIGHT + viewContainer.clientHeight), 0)
            };
            return;
        }

        if (!isDragging || !draggedCard || !canvas) return;

        const rect = canvas.getBoundingClientRect();
        const mouseX = (event.clientX - rect.left - pan.x) / zoom;
        const mouseY = (event.clientY - rect.top - pan.y) / zoom;
        const newX = mouseX - offset.x;
        const newY = mouseY - offset.y;

        questCards = questCards.map(card => 
            card.key === draggedCard?.key 
                ? { 
                    ...card, 
                    x: Math.min(Math.max(newX, 0), CANVAS_WIDTH - 300),
                    y: Math.min(Math.max(newY, 0), CANVAS_HEIGHT - 200)
                }
                : card
        );
    }

    function handleMouseUp(event: MouseEvent) {
        event.preventDefault();
        event.stopPropagation();
        
        const wasDragging = isDragging;
        const draggedCardCopy = draggedCard;
        
        // Reset states first
        isDragging = false;
        draggedCard = null;
        isPanning = false;
        
        // Then handle the update
        if (wasDragging && draggedCardCopy) {
            const card = questCards.find(c => c.key === draggedCardCopy?.key);
            if (card) {
                const updatedQuest = { 
                    ...card.quest,
                    position: { x: card.x, y: card.y } 
                };
                
                holosphere.put(holonID, 'quests', {
                    ...updatedQuest,
                    id: card.key
                }).catch(error => console.error('Error updating quest position:', error));
            }
        }
    }

    function handleWheel(event: WheelEvent) {
        event.preventDefault();
        
        if (event.ctrlKey || event.metaKey) {
            // Zoom
            const delta = event.deltaY > 0 ? 0.9 : 1.1;
            const oldZoom = zoom;
            zoom = Math.min(Math.max(0.25, zoom * delta), 2);
            
            // Get the center point of the canvas in screen space
            const canvasCenterX = CANVAS_WIDTH / 2;
            const canvasCenterY = CANVAS_HEIGHT / 2;
            
            // Calculate how far the canvas center is from the viewport origin
            const distanceFromOriginX = (canvasCenterX * oldZoom) + pan.x;
            const distanceFromOriginY = (canvasCenterY * oldZoom) + pan.y;
            
            // Calculate new pan to maintain the canvas center position
            pan = {
                x: distanceFromOriginX - (canvasCenterX * zoom),
                y: distanceFromOriginY - (canvasCenterY * zoom)
            };
        } else {
            // Pan
            pan = {
                x: Math.min(Math.max(pan.x - event.deltaX, -CANVAS_WIDTH + viewContainer.clientWidth), 0),
                y: Math.min(Math.max(pan.y - event.deltaY, -CANVAS_HEIGHT + viewContainer.clientHeight), 0)
            };
        }
    }

    // Add this to handle fullscreen toggle
    let isFullscreen = false;

    function toggleFullscreen() {
        isFullscreen = !isFullscreen;
        if (isFullscreen) {
            viewContainer.requestFullscreen().catch(err => {
                console.error('Error attempting to enable fullscreen:', err);
            });
        } else {
            document.exitFullscreen().catch(err => {
                console.error('Error attempting to exit fullscreen:', err);
            });
        }
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

        // Center the view initially
        pan = { 
            x: -INITIAL_OFFSET.x + viewContainer.clientWidth / 2, 
            y: -INITIAL_OFFSET.y + viewContainer.clientHeight / 2 
        };

        const handleFullscreenChange = () => {
            isFullscreen = !!document.fullscreenElement;
        };
        
        document.addEventListener('fullscreenchange', handleFullscreenChange);

        return () => {
            window.removeEventListener('mousemove', handleGlobalMouseMove);
            window.removeEventListener('mouseup', handleGlobalMouseUp);
            viewContainer?.removeEventListener('wheel', handleWheel);
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
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
    on:contextmenu|preventDefault
>
    <!-- Add fullscreen toggle button -->
    <button 
        class="absolute top-4 right-4 z-10 p-2 bg-gray-800 rounded-lg text-white hover:bg-gray-700 transition-colors"
        on:click={toggleFullscreen}
    >
        {#if isFullscreen}
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
        {:else}
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-5h-4m4 0v4m0 0l-5-5m-7 11h4m-4 0v4m0-4l5 5m11-5h-4m4 0v4m0-4l-5 5" />
            </svg>
        {/if}
    </button>

    <div 
        bind:this={canvas}
        class="absolute w-full h-full"
        style="width: {CANVAS_WIDTH}px; height: {CANVAS_HEIGHT}px; transform: scale({zoom}) translate({pan.x}px, {pan.y}px); transform-origin: top left;"
    >
        <!-- Grid background -->
        <div class="absolute inset-0 grid-background"></div>

        {#each questCards as card}
            <div
                class="absolute task-card"
                class:cursor-move={!isDragging}
                class:cursor-grabbing={isDragging && draggedCard?.key === card.key}
                style="left: {card.x}px; top: {card.y}px; transform: scale(1); transform-origin: top left;"
                on:mousedown|stopPropagation={(e) => handleMouseDown(e, card)}
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
                                    src={`http://gun.holons.io/getavatar?user_id=${participant.id}`}
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
</style> 