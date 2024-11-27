<script lang="ts">
    import { createEventDispatcher, onMount } from 'svelte';
    import { formatDate, formatTime } from '../utils/date.js';
    import HoloSphere from 'holosphere';

    export let filteredQuests: [string, any][];
    export let userStore: Record<string, any>;
    export let holosphere: HoloSphere;
    export let holonID: string;

    const dispatch = createEventDispatcher();
    let canvas: HTMLElement;
    let container: HTMLElement;
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
        questCards = filteredQuests.map(([key, quest]) => {
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
        
        if (isPanning && container) {
            const newPan = {
                x: (event.clientX - startPan.x),
                y: (event.clientY - startPan.y)
            };
            
            // Constrain panning
            pan = {
                x: Math.min(Math.max(newPan.x, -CANVAS_WIDTH + container.clientWidth), 0),
                y: Math.min(Math.max(newPan.y, -CANVAS_HEIGHT + container.clientHeight), 0)
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
            
            // Adjust pan to zoom around mouse position
            const rect = container.getBoundingClientRect();
            const mouseX = event.clientX - rect.left;
            const mouseY = event.clientY - rect.top;
            
            pan = {
                x: mouseX - (mouseX - pan.x) * (zoom / oldZoom),
                y: mouseY - (mouseY - pan.y) * (zoom / oldZoom)
            };
        } else {
            // Pan
            pan = {
                x: Math.min(Math.max(pan.x - event.deltaX, -CANVAS_WIDTH + container.clientWidth), 0),
                y: Math.min(Math.max(pan.y - event.deltaY, -CANVAS_HEIGHT + container.clientHeight), 0)
            };
        }
    }

    onMount(() => {
        if (!canvas || !container) return;

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
        container.addEventListener('wheel', handleWheel, { passive: false });

        // Center the view initially
        pan = { 
            x: -INITIAL_OFFSET.x + container.clientWidth / 2, 
            y: -INITIAL_OFFSET.y + container.clientHeight / 2 
        };

        return () => {
            window.removeEventListener('mousemove', handleGlobalMouseMove);
            window.removeEventListener('mouseup', handleGlobalMouseUp);
            container?.removeEventListener('wheel', handleWheel);
        };
    });
</script>

<div 
    class="w-full h-[600px] relative overflow-hidden bg-gray-900 rounded-lg"
    class:cursor-grab={!isDragging && !isPanning}
    class:cursor-grabbing={(isDragging || isPanning)}
    bind:this={container}
    on:mousedown|preventDefault|stopPropagation={(e) => handleMouseDown(e)}
    on:contextmenu|preventDefault
    role="region"
    aria-label="Draggable canvas of tasks"
>
    <div 
        bind:this={canvas}
        class="absolute w-full h-full"
        style="width: {CANVAS_WIDTH}px; height: {CANVAS_HEIGHT}px; transform: scale({zoom}) translate({pan.x}px, {pan.y}px); transform-origin: top left;"
        role="application"
        aria-label="Task cards container"
    >
        <!-- Grid background -->
        <div class="absolute inset-0 grid-background" role="presentation"></div>

        {#each questCards as card}
            <button
                class="absolute task-card"
                class:cursor-move={!isDragging}
                class:cursor-grabbing={isDragging && draggedCard?.key === card.key}
                style="left: {card.x}px; top: {card.y}px; transform: scale(1); transform-origin: top left;"
                on:mousedown|stopPropagation={(e) => handleMouseDown(e, card)}
                aria-label={`Draggable task: ${card.quest.title}`}
                aria-describedby={`task-desc-${card.key}`}
            >
                <div 
                    class="w-64 p-4 rounded-xl shadow-lg border-2 bg-opacity-90"
                    style="background-color: {card.quest.status === 'completed' ? 'rgba(156, 163, 175, 0.95)' : 'rgba(55, 65, 81, 0.95)'}; 
                           border-color: {card.quest.status === 'completed' ? 'rgba(156, 163, 175, 0.9)' : 'rgba(75, 85, 101, 0.9)'}"
                >
                    <h3 class="text-white font-bold mb-2" id={`task-title-${card.key}`}>{card.quest.title}</h3>
                    {#if card.quest.description}
                        <p class="text-gray-300 text-sm mb-3 line-clamp-2" id={`task-desc-${card.key}`}>{card.quest.description}</p>
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
            </button>
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
</style> 