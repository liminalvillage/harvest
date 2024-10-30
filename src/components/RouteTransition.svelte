<script lang="ts">
  import { cubicInOut } from 'svelte/easing';
  export let pathname: string;

  // Extract the route type (e.g., 'map', 'kanban', etc.) without ID or parameters
  $: routeType = pathname.split('/').pop()?.split('?')[0];

  const cubicTransition = (node: Element) => {
    return {
      duration: 300,
      easing: cubicInOut,
      css: (t: number) => {
        return `
          opacity: ${t};
          transform: translateX(${(1 - t) * 30}px);
          position: relative;
        `;
      }
    };
  };
</script>

{#key routeType}
  <div in:cubicTransition class="w-full">
    <slot />
  </div>
{/key} 