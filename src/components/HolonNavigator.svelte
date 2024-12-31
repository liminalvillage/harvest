<script lang="ts">
    import { createEventDispatcher, getContext, onMount } from 'svelte';
    import HoloSphere from 'holosphere';
 

    const holosphere = getContext("holosphere") as HoloSphere;
    const dispatch = createEventDispatcher();

    // Canvas and interaction state
    let canvas: HTMLElement;
    let container: HTMLElement;
    let viewContainer: HTMLElement;
    let isDragging = false;
    let draggedHolon: { key: string; holon: any; x: number; y: number; radius: number; } | null = null;
    let offset = { x: 0, y: 0 };
    let zoom = 1;
    let pan = { x: 0, y: 0 };
    let startPan = { x: 0, y: 0 };
    let isPanning = false;

    // Canvas dimensions
    const CANVAS_WIDTH = 3000;
    const CANVAS_HEIGHT = 3000;
    const INITIAL_OFFSET = { x: CANVAS_WIDTH / 4, y: CANVAS_HEIGHT / 4 };

    // Holon circles data
    let holonCircles: { key: string; holon: any; x: number; y: number; radius: number; }[] = [];
    
    // Subscribe to holons
    onMount(async () => {
        if (holosphere) {
            holosphere.getGlobal('Holons', (newHolon, key) => {
                if (newHolon) {
                    const holon = newHolon;
                    
                    // Find existing circle or create new one
                    const existingCircle = holonCircles.find(circle => circle.key === key);
                    if (existingCircle) {
                        existingCircle.holon = holon;
                    } else {
                        // Position new holons in a spiral pattern
                        const index = holonCircles.length;
                        const angle = index * 0.5;
                        const radius = 200 + index * 50;
                        holonCircles = [...holonCircles, {
                            key,
                            holon,
                            x: INITIAL_OFFSET.x + Math.cos(angle) * radius,
                            y: INITIAL_OFFSET.y + Math.sin(angle) * radius,
                            radius: 100 + (holon.members?.length || 0) * 10 // Size based on member count
                        }];
                    }
                } else {
                    holonCircles = holonCircles.filter(circle => circle.key !== key);
                }
            });
        }
    });

    // Mouse interaction handlers
    function handleMouseDown(event: MouseEvent, circle: typeof holonCircles[0] | null = null) {
        event.preventDefault();
        event.stopPropagation();
        
        if (event.button === 1 || event.button === 2 || !circle) {
            isPanning = true;
            startPan = { x: event.clientX - pan.x, y: event.clientY - pan.y };
            return;
        }

        if (event.button === 0 && circle) {
            isDragging = true;
            draggedHolon = circle;
            
            const rect = canvas.getBoundingClientRect();
            const mouseX = (event.clientX - rect.left - pan.x) / zoom;
            const mouseY = (event.clientY - rect.top - pan.y) / zoom;
            
            offset = {
                x: mouseX - circle.x,
                y: mouseY - circle.y
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
            
            pan = {
                x: Math.min(Math.max(newPan.x, -CANVAS_WIDTH + viewContainer.clientWidth), 0),
                y: Math.min(Math.max(newPan.y, -CANVAS_HEIGHT + viewContainer.clientHeight), 0)
            };
            return;
        }

        if (!isDragging || !draggedHolon || !canvas) return;

        const rect = canvas.getBoundingClientRect();
        const mouseX = (event.clientX - rect.left - pan.x) / zoom;
        const mouseY = (event.clientY - rect.top - pan.y) / zoom;
        const newX = mouseX - offset.x;
        const newY = mouseY - offset.y;

        holonCircles = holonCircles.map(circle => 
            circle.key === draggedHolon?.key 
                ? { 
                    ...circle, 
                    x: Math.min(Math.max(newX, circle.radius), CANVAS_WIDTH - circle.radius),
                    y: Math.min(Math.max(newY, circle.radius), CANVAS_HEIGHT - circle.radius)
                }
                : circle
        );
    }

    function handleMouseUp() {
        isDragging = false;
        draggedHolon = null;
        isPanning = false;
    }

    function handleWheel(event: WheelEvent) {
        event.preventDefault();
        
        if (event.ctrlKey || event.metaKey) {
            const rect = viewContainer.getBoundingClientRect();
            const mouseX = event.clientX - rect.left;
            const mouseY = event.clientY - rect.top;

            const canvasX = (mouseX - pan.x) / zoom;
            const canvasY = (mouseY - pan.y) / zoom;

            const zoomFactor = event.deltaY > 0 ? 0.95 : 1.05;
            zoom = Math.min(Math.max(0.25, zoom * zoomFactor), 2);

            pan = {
                x: mouseX - (canvasX * zoom),
                y: mouseY - (canvasY * zoom)
            };

            const rect2 = viewContainer.getBoundingClientRect();
            pan = {
                x: Math.min(Math.max(pan.x, -CANVAS_WIDTH * zoom + rect2.width), 0),
                y: Math.min(Math.max(pan.y, -CANVAS_HEIGHT * zoom + rect2.height), 0)
            };
        } else {
            pan = {
                x: Math.min(Math.max(pan.x - event.deltaX, -CANVAS_WIDTH * zoom + viewContainer.clientWidth), 0),
                y: Math.min(Math.max(pan.y - event.deltaY, -CANVAS_HEIGHT * zoom + viewContainer.clientHeight), 0)
            };
        }
    }

    // Handle holon selection
    function handleHolonClick(key: string, holon: any) {
        dispatch('holonSelect', { key, holon });
    }
</script>

<div 
    class="w-full h-[600px] relative overflow-hidden bg-gray-900 rounded-lg"
    class:cursor-grab={!isDragging && !isPanning}
    class:cursor-grabbing={(isDragging || isPanning)}
    bind:this={viewContainer}
    on:mousedown|preventDefault|stopPropagation={(e) => handleMouseDown(e)}
    on:contextmenu|preventDefault
>
    <div 
        bind:this={canvas}
        class="absolute w-full h-full"
        style="width: {CANVAS_WIDTH}px; height: {CANVAS_HEIGHT}px; transform: translate({pan.x}px, {pan.y}px) scale({zoom}); transform-origin: 0 0;"
    >
        <!-- Grid background -->
        <div class="absolute inset-0 grid-background"></div>

        <!-- Holon circles -->
        {#each holonCircles as circle}
            <div
                class="absolute holon-circle transition-transform"
                class:cursor-move={!isDragging}
                class:cursor-grabbing={isDragging && draggedHolon?.key === circle.key}
                style="left: {circle.x}px; top: {circle.y}px; width: {circle.radius * 2}px; height: {circle.radius * 2}px; transform: translate(-50%, -50%);"
                on:mousedown|stopPropagation={(e) => handleMouseDown(e, circle)}
                on:click|stopPropagation={() => handleHolonClick(circle.key, circle.holon)}
            >
                <div 
                    class="w-full h-full rounded-full flex items-center justify-center text-center p-4 bg-opacity-90 border-2"
                    style="background-color: {circle.holon.color || '#4B5563'}; border-color: {circle.holon.color || '#4B5563'}"
                >
                    <div class="text-white">
                        <h3 class="font-bold text-lg mb-2">{circle.holon.name}</h3>
                        <p class="text-sm opacity-80">Members: {circle.holon.members?.length || 0}</p>
                        {#if circle.holon.description}
                            <p class="text-sm opacity-80 mt-1 line-clamp-2">{circle.holon.description}</p>
                        {/if}
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

    .holon-circle {
        transition: transform 0.2s ease;
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

    :global(.holon-circle *) {
        transform: translateZ(0);
    }
</style> 