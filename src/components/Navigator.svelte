<script lang="ts">
    import { createEventDispatcher, getContext, onMount, onDestroy } from 'svelte';
    import HoloSphere from 'holosphere';
    import * as d3 from 'd3';
    import { ID } from "../dashboard/store";

    interface Holon {
        name: string;
        members?: string[];
        color?: string;
        description?: string;
        value?: number;
        key?: string;
        children?: Holon[];
        parent?: string;
    }

    interface HolonData {
        name: string;
        children: Holon[];
    }

    const holosphere = getContext("holosphere") as HoloSphere;
    const dispatch = createEventDispatcher();

    // Canvas and interaction state
    let svg: SVGElement;
    let viewContainer: HTMLElement;
    let width = 900;
    let height = 600;

    // D3 visualization state
    let root: d3.HierarchyCircularNode<Holon>;
    let focus: d3.HierarchyCircularNode<Holon>;
    let view: [number, number, number];

    // Color scale for different depths
    const color = d3.scaleLinear<string>()
        .domain([0, 5])
        .range(['#4B5563', '#1E40AF'])
        .interpolate(d3.interpolateHcl);

    // Add zoom behavior variable
    let zoomBehavior: d3.ZoomBehavior<SVGElement, unknown>;
    let mainGroup: d3.Selection<SVGGElement, unknown>;

    // Add an array to track subscriptions with proper typing
    interface GunSubscription {
        path: string;
        off: Function;
    }
    
    let gunSubscriptions: GunSubscription[] = [];

    function handleZoom(event: d3.D3ZoomEvent<SVGElement, unknown>) {
        mainGroup.attr('transform', event.transform.toString());
    }

    function initializeZoom() {
        zoomBehavior = d3.zoom<SVGElement, unknown>()
            .scaleExtent([0.1, 10])
            .on('zoom', handleZoom);

        mainGroup = d3.select(svg).select('g');
        d3.select(svg)
            .call(zoomBehavior)
            .call(zoomBehavior.transform, d3.zoomIdentity);

        // Prevent default touch behaviors
        d3.select(svg)
            .on('touchstart', (event) => event.preventDefault())
            .on('touchmove', (event) => event.preventDefault());
    }

    function pack(data: HolonData) {
        return d3.pack<Holon>()
            .size([width, height])
            .padding(3)
            (d3.hierarchy<Holon>(data)
                .sum(d => d.value || 0)
                .sort((a, b) => (b.value || 0) - (a.value || 0)));
    }

    function zoomTo(v: [number, number, number]) {
        const k = width / v[2];
        view = v;

        const node = d3.select(svg).select<SVGGElement>('g');
        node.attr("transform", `translate(${width/2},${height/2}) scale(${k}) translate(${-v[0]},${-v[1]})`);
    }

    function zoom(event: d3.D3ZoomEvent<SVGElement, unknown>, d: d3.HierarchyCircularNode<Holon>) {
        focus = d;

        const transition = d3.select(svg)
            .select('g')
            .transition()
            .duration(event.sourceEvent?.altKey ? 7500 : 750)
            .tween("zoom", () => {
                const i = d3.interpolateZoom(view, [focus.x, focus.y, focus.r * 2]);
                return (t: number) => zoomTo(i(t));
            });
    }

    function truncateText(text: string, maxLength: number): string {
        return text.length > maxLength ? text.slice(0, maxLength - 3) + '...' : text;
    }

    function calculateTextParams(d: d3.HierarchyCircularNode<Holon>) {
        const depthScaling = Math.max(0.5, 1 - d.depth * 0.2);
        const textSize = Math.min(d.r / 5 * depthScaling, 12);
        const charLimit = Math.max(3, Math.floor(d.r * 3.0 / textSize));
        return { textSize, charLimit };
    }

    function zoomToNode(d: d3.HierarchyCircularNode<Holon>) {
        const scale = Math.min(width, height) / (d.r * 2.2);
        const x = width / 2 - (d.x * scale);
        const y = height / 2 - (d.y * scale);

        d3.select(svg)
            .transition()
            .duration(750)
            .call(zoomBehavior.transform, d3.zoomIdentity
                .translate(x, y)
                .scale(scale));
    }

    function updateVisualization(holonsData: HolonData) {
        root = pack(holonsData);
        focus = root;
        
        const svg = d3.select('svg g');
        
        // Clear existing circles
        svg.selectAll('circle').remove();
        svg.selectAll('text').remove();

        // Add circles
        const node = svg
            .selectAll<SVGCircleElement, d3.HierarchyCircularNode<Holon>>('circle')
            .data(root.descendants())
            .join('circle')
            .attr('fill', d => d.children ? color(d.depth) : d.data.color || '#4B5563')
            .attr('fill-opacity', 0.8)
            .attr('pointer-events', 'all')
            .attr('cx', d => d.x)
            .attr('cy', d => d.y)
            .attr('r', d => d.data.key === $ID ? d.r * 1.1 : d.r)
            .attr('stroke', d => d.data.key === $ID ? '#ffffff' : '#fff')
            .attr('stroke-width', d => d.data.key === $ID ? '3' : '1')
            .on('mouseover', function(this: SVGCircleElement) { 
                const d = d3.select(this).datum() as d3.HierarchyCircularNode<Holon>;
                if (d.data.key !== $ID) {
                    d3.select(this)
                        .attr('stroke-width', '3');
                }
                const text = svg.select(`text[data-key="${d.data.key}"]`);
                text
                    .text(d.data.name)
                    .attr('fill', '#ffffff')
                    .style('text-shadow', '0 0 3px rgba(0,0,0,0.5)');
            })
            .on('mouseout', function(this: SVGCircleElement) { 
                const d = d3.select(this).datum() as d3.HierarchyCircularNode<Holon>;
                if (d.data.key !== $ID) {
                    d3.select(this)
                        .attr('stroke-width', '1');
                }
                const text = svg.select(`text[data-key="${d.data.key}"]`);
                text
                    .attr('fill', 'white')
                    .style('text-shadow', 'none');
                const { textSize, charLimit } = calculateTextParams(d);
                text.text(truncateText(d.data.name, charLimit));
            })
            .on('click', (event: MouseEvent, d: d3.HierarchyCircularNode<Holon>) => handleHolonClick(d));

        // Add labels
        svg.selectAll<SVGTextElement, d3.HierarchyCircularNode<Holon>>('text')
            .data(root.descendants())
            .join('text')
            .attr('text-anchor', 'middle')
            .attr('data-key', d => d.data.key || '')
            .attr('dominant-baseline', 'middle')
            .attr('fill', 'white')
            .attr('pointer-events', 'none')
            .attr('x', d => d.x)
            .attr('y', d => d.y)
            .style('font-family', 'system-ui, -apple-system, sans-serif')
            .style('font-weight', '500')
            .style('user-select', 'none')
            .each(function(d) {
                const node = d3.select(this);
                const { textSize, charLimit } = calculateTextParams(d);
                node.style('font-size', `${textSize}px`);
                node.text(truncateText(d.data.name, charLimit));
            });

        // Initial view
        const scale = width / (root.r * 2.2);
        const x = width / 2 - (root.x * scale);
        const y = height / 2 - (root.y * scale);
        
        d3.select(svg)
            .call(zoomBehavior.transform, d3.zoomIdentity
                .translate(x, y)
                .scale(scale));
    }

    function handleHolonClick(d: d3.HierarchyCircularNode<Holon>) {
        // Use proper event handling
        const e = window.event;
        if (e) {
            e.stopPropagation();
        }
        focus = d;
        zoomToNode(d);
        if (d.data.key) {
            dispatch('holonSelect', { key: d.data.key, holon: d.data });
        }
    }

    // Add reactive statement to handle ID changes
    $: if ($ID) {
        const holon = root?.descendants().find(d => d.data.key === $ID);
        if (holon) {
            focus = holon;
            zoomToNode(holon);
        }
    }

    onMount(async () => {
        initializeZoom();
        if (holosphere) {
            const holonsData: HolonData = { name: "", children: [] };
            const holonMap = new Map<string, Holon>();
            
            // @ts-ignore - Accessing private property for now
            const holonsSubscription = holosphere.gun.get('Holons').map().on((newHolon: Holon, key: string) => {
                console.log('Found holon:', key, newHolon);
                if (newHolon) {
                    // @ts-ignore - Accessing private property for now
                    const settingsSubscription = holosphere.gun.get('Holons').get(key).get('settings').get(key).on((settings: any) => {
                        if (!settings) return;
                        settings = JSON.parse(settings);
                        
                        // Create or update the holon in our map
                        const existingHolon = holonMap.get(key);
                        const updatedHolon: Holon = {
                            key,
                            name: settings.name || key,
                            value: 30,
                            color: settings.color || '#4B5563',
                            description: settings.description,
                            children: existingHolon?.children || [],
                            parent: settings.parent
                        };
                        holonMap.set(key, updatedHolon);

                        // Rebuild the tree structure
                        holonsData.children = Array.from(holonMap.values()).filter(holon => !holon.parent);
                        
                        // Assign children
                        holonMap.forEach((holon) => {
                            if (holon.parent && holonMap.has(holon.parent)) {
                                const parentHolon = holonMap.get(holon.parent);
                                if (parentHolon) {
                                    parentHolon.children = parentHolon.children || [];
                                    if (!parentHolon.children.find(child => child.key === holon.key)) {
                                        parentHolon.children.push(holon);
                                    }
                                }
                            }
                        });

                        console.log('Updated holons data:', JSON.stringify(holonsData, null, 2));
                        updateVisualization(holonsData);
                    });
                    
                    // Store the subscription for cleanup
                    if (typeof settingsSubscription.off === 'function') {
                        gunSubscriptions.push({ path: 'settings', off: settingsSubscription.off });
                    }
                }
            });
            
            // Store the main subscription for cleanup
            if (typeof holonsSubscription.off === 'function') {
                gunSubscriptions.push({ path: 'holons', off: holonsSubscription.off });
            }
        }
    });

    // Add onDestroy to clean up all subscriptions and D3 resources
    onDestroy(() => {
        // Clean up Gun subscriptions
        if (gunSubscriptions.length > 0) {
            console.log('Cleaning up Gun subscriptions');
            gunSubscriptions.forEach(sub => {
                sub.off();
            });
            gunSubscriptions = [];
        }
        
        // Clean up D3 resources
        if (svg) {
            // Remove event listeners
            d3.select(svg)
                .on('touchstart', null)
                .on('touchmove', null);
                
            if (zoomBehavior) {
                // Type casting to fix the issue with on('.zoom', null)
                (d3.select(svg) as any).on('.zoom', null);
            }
            
            // Clear all SVG elements
            d3.select(svg).selectAll('*').remove();
        }
    });
</script>

<div 
    class="w-full h-full relative overflow-hidden bg-gray-900 rounded-lg"
    bind:this={viewContainer}
    bind:clientWidth={width}
    bind:clientHeight={height}
>
    <svg 
        bind:this={svg}
        viewBox="0 0 {width} {height}"
        class="w-full h-full"
        style="cursor: pointer; touch-action: none;"
    >
        <g />
    </svg>
</div>

<style>
</style> 