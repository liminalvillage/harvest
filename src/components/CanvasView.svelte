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
    let positionAssignments = new Set<string>(); // Track which quests have been assigned positions
    let pendingPositionSaves = new Map<string, { x: number; y: number }>(); // Track pending saves
    let hologramPositions = new Map<string, { x: number; y: number }>(); // Local storage for hologram positions

    const CARD_WIDTH = 320; // Based on w-80 class (20rem * 16px/rem)
    const CARD_HEIGHT_ESTIMATE = 120; // Estimated height for arrow connection

    // Clear position tracking when holonID changes and load hologram positions
    $: if (holonID) {
        positionAssignments.clear();
        pendingPositionSaves.clear();
        
        // Load hologram positions from localStorage
        try {
            const stored = localStorage.getItem(`hologramPositions_${holonID}`);
            if (stored) {
                const parsed = JSON.parse(stored);
                hologramPositions = new Map(Object.entries(parsed));
                console.log(`[CanvasView] Loaded ${hologramPositions.size} hologram positions from localStorage`);
            } else {
                hologramPositions.clear();
            }
        } catch (error) {
            console.error('Error loading hologram positions:', error);
            hologramPositions.clear();
        }
    }
    
    // Save hologram positions to localStorage when they change
    function saveHologramPositions() {
        if (holonID && hologramPositions.size > 0) {
            try {
                const obj = Object.fromEntries(hologramPositions);
                localStorage.setItem(`hologramPositions_${holonID}`, JSON.stringify(obj));
                console.log(`[CanvasView] Saved ${hologramPositions.size} hologram positions to localStorage`);
            } catch (error) {
                console.error('Error saving hologram positions:', error);
            }
        }
    }

    // Minimap functions
    const MINIMAP_WIDTH = 120;
    const MINIMAP_HEIGHT = 90;

    function getMinimapViewX() {
        if (!viewContainer) return 0;
        const containerRect = viewContainer.getBoundingClientRect();
        const viewX = -pan.x / (CANVAS_WIDTH * zoom) * MINIMAP_WIDTH;
        return Math.max(0, Math.min(MINIMAP_WIDTH, viewX));
    }

    function getMinimapViewY() {
        if (!viewContainer) return 0;
        const containerRect = viewContainer.getBoundingClientRect();
        const viewY = -pan.y / (CANVAS_HEIGHT * zoom) * MINIMAP_HEIGHT;
        return Math.max(0, Math.min(MINIMAP_HEIGHT, viewY));
    }

    function getMinimapViewWidth() {
        if (!viewContainer) return MINIMAP_WIDTH;
        const containerRect = viewContainer.getBoundingClientRect();
        const viewWidth = containerRect.width / (CANVAS_WIDTH * zoom) * MINIMAP_WIDTH;
        return Math.min(MINIMAP_WIDTH - getMinimapViewX(), Math.max(5, viewWidth));
    }

    function getMinimapViewHeight() {
        if (!viewContainer) return MINIMAP_HEIGHT;
        const containerRect = viewContainer.getBoundingClientRect();
        const viewHeight = containerRect.height / (CANVAS_HEIGHT * zoom) * MINIMAP_HEIGHT;
        return Math.min(MINIMAP_HEIGHT - getMinimapViewY(), Math.max(5, viewHeight));
    }

    function handleMinimapClick(event: MouseEvent) {
        event.stopPropagation();
        if (!viewContainer) return;

        const minimapRect = (event.currentTarget as HTMLElement).getBoundingClientRect();
        const clickX = event.clientX - minimapRect.left;
        const clickY = event.clientY - minimapRect.top;

        // Convert minimap coordinates to canvas coordinates
        const canvasX = (clickX / MINIMAP_WIDTH) * CANVAS_WIDTH;
        const canvasY = (clickY / MINIMAP_HEIGHT) * CANVAS_HEIGHT;

        // Center the view on the clicked point
        const containerRect = viewContainer.getBoundingClientRect();
        pan = {
            x: -(canvasX * zoom) + containerRect.width / 2,
            y: -(canvasY * zoom) + containerRect.height / 2
        };

        console.log(`[CanvasView] Minimap click: navigated to (${canvasX.toFixed(0)}, ${canvasY.toFixed(0)})`);
    }



    // questCards is now purely derived from filteredQuests.
    // This ensures it always reflects the latest positions from props when not actively dragging.
    $: questCards = filteredQuests
        .filter(([_, quest]) => showCompleted || quest.status !== 'completed')
        .map(([key, quest]) => {
            // Check if position exists
            if (quest.position && quest.position.x !== undefined && quest.position.y !== undefined) {
                // Use existing position
                positionAssignments.add(key); // Mark as having a position
                return {
                    key,
                    quest,
                    x: quest.position.x,
                    y: quest.position.y
                };
            }
            
            // For holograms, check if we have a locally stored position
            if (quest._meta?.resolvedFromHologram) {
                const hologramPosition = hologramPositions.get(key);
                if (hologramPosition) {
                    positionAssignments.add(key);
                    return {
                        key,
                        quest: { ...quest, position: hologramPosition },
                        x: hologramPosition.x,
                        y: hologramPosition.y
                    };
                }
            }
            
            // Check if we have a pending position save
            const pendingPosition = pendingPositionSaves.get(key);
            if (pendingPosition) {
                return {
                    key,
                    quest: { ...quest, position: pendingPosition },
                    x: pendingPosition.x,
                    y: pendingPosition.y
                };
            }
            
            // Generate consistent position based on key for display, but don't save it yet
            const hash = key.split('').reduce((a, b) => {
                a = ((a << 5) - a) + b.charCodeAt(0);
                return a & a;
            }, 0);
            
            const displayPosition = {
                x: INITIAL_OFFSET.x + (Math.sin(hash) * 800),
                y: INITIAL_OFFSET.y + (Math.cos(hash) * 600)
            };
            
            return {
                key,
                quest,
                x: displayPosition.x,
                y: displayPosition.y
            };
            
            // Fallback
            return {
                key,
                quest,
                x: INITIAL_OFFSET.x,
                y: INITIAL_OFFSET.y
            };
        });

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

            const dx = Math.abs(newPosition.x - finalDraggedCardData.x);
            const dy = Math.abs(newPosition.y - finalDraggedCardData.y);
            const moveThreshold = 5; // pixels

            // Check if it was a click (not a drag)
            if (dx < moveThreshold && dy < moveThreshold) {
                dispatch('taskClick', {
                    key: finalDraggedCardData.key,
                    quest: finalDraggedCardData.quest
                });
            } else {
                // It was a drag, so update the position
                console.log(`[CanvasView] Dragged quest ${finalDraggedCardData.key} from (${finalDraggedCardData.x}, ${finalDraggedCardData.y}) to (${newPosition.x}, ${newPosition.y})`);
                
                // Always save position when dragged (whether it had a position before or not)
                positionAssignments.add(finalDraggedCardData.key);
                pendingPositionSaves.set(finalDraggedCardData.key, newPosition);
                
                // Check if this is a hologram task (read-only from another holon)
                if (finalDraggedCardData.quest._meta?.resolvedFromHologram) {
                    console.log(`[CanvasView] Hologram task ${finalDraggedCardData.key} - position stored locally only, not saved to holosphere`);
                    // For holograms, we store the position locally in localStorage
                    hologramPositions.set(finalDraggedCardData.key, newPosition);
                    saveHologramPositions();
                    pendingPositionSaves.delete(finalDraggedCardData.key);
                } else {
                    // Regular task - save to holosphere database
                    console.log(`[CanvasView] Local task ${finalDraggedCardData.key} - saving to database`);
                    
                    const updatedQuest = { 
                        ...finalDraggedCardData.quest, 
                        position: newPosition 
                    };
                    
                    holosphere.put(holonID, `quests/${finalDraggedCardData.key}`, updatedQuest)
                        .then(() => {
                            console.log(`[CanvasView] Successfully saved new position for quest ${finalDraggedCardData.key}`);
                            pendingPositionSaves.delete(finalDraggedCardData.key);
                        })
                        .catch(error => {
                            console.error('Error updating quest position:', error);
                            // Revert tracking on error
                            positionAssignments.delete(finalDraggedCardData.key);
                            pendingPositionSaves.delete(finalDraggedCardData.key);
                        });
                }
            }
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
            
            // Clear position tracking
            positionAssignments.clear();
            pendingPositionSaves.clear();
            hologramPositions.clear();
        };
    });

    // Add the getColorFromCategory function to match Tasks component
    function getColorFromCategory(category: string | undefined, type: string = 'task') {
        if (!category) {
            // Default colors based on type
            switch (type) {
                case 'event':
                    return "hsl(280, 70%, 85%)"; // Purple for events
                case 'quest':
                    return "hsl(200, 70%, 85%)"; // Blue for quests
                default:
                    return "#E5E7EB"; // Gray for tasks
            }
        }

        // For items with categories, generate color but adjust based on type
        let hash = 0;
        for (let i = 0; i < category.length; i++) {
            hash = (hash << 5) - hash + category.charCodeAt(i);
            hash = hash & hash;
        }

        const hue = Math.abs(hash % 360);
        // Adjust saturation and lightness based on type
        switch (type) {
            case 'event':
                return `hsl(${hue}, 85%, 80%)`; // More saturated for events
            case 'quest':
                return `hsl(${hue}, 75%, 82%)`; // Slightly saturated for quests
            default:
                return `hsl(${hue}, 70%, 85%)`; // Original for tasks
        }
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
    <!-- Control Panel -->
    <div class="absolute top-4 right-4 z-10 flex flex-col gap-2">
        <!-- Fullscreen toggle button -->
        <button 
            class="p-2 bg-gray-800/50 hover:bg-gray-700 rounded-lg text-white/70 hover:text-white/90 transition-colors"
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

        <!-- Minimap -->
        <div class="bg-gray-800/90 rounded-lg p-2 border border-gray-600">
            <div class="text-white/70 text-xs mb-1 text-center">Map</div>
            <div 
                class="relative bg-gray-900 border border-gray-700 cursor-pointer"
                style="width: 120px; height: 90px;"
                on:click={handleMinimapClick}
                on:keydown={(e) => e.key === 'Enter' && handleMinimapClick(e)}
                role="button"
                tabindex="0"
                title="Click to navigate"
            >
                <!-- Canvas bounds -->
                <div class="absolute inset-0 border border-gray-600 rounded"></div>
                
                <!-- Current viewport indicator -->
                <div 
                    class="absolute border-2 border-blue-400 bg-blue-400/20 rounded"
                    style="left: {getMinimapViewX()}px; 
                           top: {getMinimapViewY()}px; 
                           width: {getMinimapViewWidth()}px; 
                           height: {getMinimapViewHeight()}px;"
                ></div>
                
                <!-- Task cards as dots -->
                {#each questCards as card}
                    {@const minimapX = (card.x / CANVAS_WIDTH) * 120}
                    {@const minimapY = (card.y / CANVAS_HEIGHT) * 90}
                    <div 
                        class="absolute rounded-full border border-white"
                        style="left: {minimapX - 2}px; 
                               top: {minimapY - 2}px; 
                               width: 4px; 
                               height: 4px;
                               background-color: {card.quest.status === 'completed' 
                                   ? '#10B981' 
                                   : card.quest._meta?.resolvedFromHologram 
                                       ? '#00BFFF' 
                                       : '#F59E0B'};"
                        title={card.quest.title}
                    ></div>
                {/each}
            </div>
            <div class="text-white/50 text-xs mt-1 text-center">
                {questCards.length} tasks
            </div>
        </div>
    </div>

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
                       width: {CARD_WIDTH}px;
                       transform: scale(1); transform-origin: top left;"
                on:mousedown|stopPropagation={(e) => handleMouseDown(e, card)}
                role="presentation"
            >


                <div 
                    class="w-80 p-3 rounded-xl shadow-lg transition-all duration-300 border border-transparent hover:border-gray-600 hover:shadow-md transform hover:scale-[1.005] cursor-pointer"
                    style="background-color: {card.quest.status === 'completed'
                        ? '#374151'
                        : getColorFromCategory(card.quest.category, card.quest.type)}; 
                           opacity: {card.quest.status === 'completed' ? '0.7' : card.quest._meta?.resolvedFromHologram ? '0.75' : '1'};
                           {card.quest._meta?.resolvedFromHologram ? 'border: 2px solid #00BFFF; box-sizing: border-box; box-shadow: 0 0 20px rgba(0, 191, 255, 0.4), inset 0 0 20px rgba(0, 191, 255, 0.1);' : ''}"
                >
                    <!-- Header -->
                    <div class="flex items-center justify-between gap-3">
                        <div class="flex items-center gap-3 flex-1 min-w-0">
                            <!-- Task Icon -->
                            <div class="flex-shrink-0 w-8 h-8 rounded-lg bg-black/20 flex items-center justify-center text-sm">
                                {card.quest.type === 'event' ? '📅' : card.quest.type === 'quest' ? '⚔️' : card.quest.type === 'recurring' || card.quest.status === 'recurring' || card.quest.status === 'repeating' ? '🔄' : '✓'}
                            </div>
                            
                            <!-- Main Content -->
                            <div class="flex-1 min-w-0">
                                <div class="flex items-center gap-2 mb-1">
                                    <h3 class="text-base font-bold text-gray-800 truncate">
                                        {card.quest.title}
                                    </h3>
                                    {#if card.quest._meta?.resolvedFromHologram}
                                        <button 
                                            class="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-500/20 text-blue-800 flex-shrink-0 hover:bg-blue-500/30 transition-colors" 
                                            title="Navigate to source holon"
                                            on:click|stopPropagation={() => {
                                                const match = card.quest._meta?.hologramSoul?.match(/Holons\/([^\/]+)/);
                                                if (match) {
                                                    window.location.href = `/${match[1]}/tasks`;
                                                }
                                            }}
                                        >
                                            <svg class="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                                                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                                            </svg>
                                            🔮
                                            <svg class="w-2 h-2" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
                                            </svg>
                                        </button>
                                    {/if}
                                    {#if card.quest.type === 'recurring' || card.quest.status === 'recurring' || card.quest.status === 'repeating'}
                                        <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-500/30 text-purple-800 flex-shrink-0">
                                            🔄
                                        </span>
                                    {/if}
                                    {#if card.quest.category}
                                        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-black/10 text-gray-700 flex-shrink-0">
                                            <svg class="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                                                <path d="M11.03 8h-6.06l-3 8h6.06l3-8zm1.94 0l3 8h6.06l-3-8h-6.06zm1.03-2h4.03l3-2h-4.03l-3 2zm-8 0h4.03l-3-2h-4.03l3 2z"/>
                                            </svg>
                                            {card.quest.category}
                                        </span>
                                    {/if}
                                </div>
                                {#if card.quest.description}
                                    <p class="text-sm text-gray-700 truncate">
                                        {card.quest.description}
                                    </p>
                                {/if}
                            </div>
                        </div>

                        <!-- Right Side Meta Info -->
                        <div class="flex items-center gap-3 flex-shrink-0 text-sm">
                            {#if card.quest.location}
                                <div class="flex items-center gap-1 text-gray-600">
                                    <span class="text-xs">📍</span>
                                    <span class="truncate max-w-16 text-xs">{card.quest.location.split(",")[0]}</span>
                                </div>
                            {/if}

                            {#if card.quest.participants?.length > 0}
                                <div class="flex items-center gap-1">
                                    <div class="flex -space-x-1 relative group" title={card.quest.participants.map(p => `${p.firstName || p.username} ${p.lastName ? p.lastName[0] + '.' : ''}`).join(', ')}>
                                        {#each card.quest.participants.slice(0, 2) as participant}
                                            <div class="relative">
                                                <img
                                                    class="w-5 h-5 rounded-full border border-white shadow-sm"
                                                    src={`https://gun.holons.io/getavatar?user_id=${participant.id}`}
                                                    alt={`${participant.firstName || participant.username} ${participant.lastName ? participant.lastName[0] + '.' : ''}`}
                                                />
                                            </div>
                                        {/each}
                                        {#if card.quest.participants.length > 2}
                                            <div class="w-5 h-5 rounded-full bg-gray-400 flex items-center justify-center text-xs border border-white shadow-sm text-white font-medium">
                                                <span>+{card.quest.participants.length - 2}</span>
                                            </div>
                                        {/if}
                                    </div>
                                </div>
                            {/if}

                            {#if card.quest.when}
                                <div class="text-xs font-medium text-gray-700 whitespace-nowrap">
                                    <div class="text-xs text-gray-600 mb-1">{formatDate(card.quest.when)}</div>
                                    {formatTime(card.quest.when)}
                                    {#if card.quest.ends}<br/>{formatTime(card.quest.ends)}{/if}
                                </div>
                            {/if}

                            {#if card.quest.appreciation?.length > 0}
                                <div class="flex items-center gap-1 text-gray-600" title={`${card.quest.appreciation.length} appreciations`}>
                                    <span class="text-xs">👍</span>
                                    <span class="text-xs font-medium">{card.quest.appreciation.length}</span>
                                </div>
                            {/if}
                        </div>
                    </div>
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
        position: relative; /* Ensure dots are positioned relative to the card */
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