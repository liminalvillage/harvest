<script lang="ts">
  import { cubicInOut } from 'svelte/easing';
  export let pathname: string;

  const cubicTransition = (node: Element) => {
    return {
      duration: 300,
      easing: cubicInOut,
      css: (t: number) => {
        return `
          opacity: ${t};
          transform: translateY(${(1 - t) * 30}px);
          position: relative;
        `;
      }
    };
  };
</script>

{#key pathname}
  <div in:cubicTransition class="w-full">
    <slot />
  </div>
{/key} 