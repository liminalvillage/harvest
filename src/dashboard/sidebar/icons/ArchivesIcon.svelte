<script lang="ts">
  export let active = false;
</script>

<svg
	xmlns="http://www.w3.org/2000/svg"
	class="h-6 w-6"
	fill="none"
	viewBox="0 0 24 24"
	stroke="currentColor"
>
	<path
		stroke-linecap="round"
		stroke-linejoin="round"
		stroke-width="2"
		class={active ? 'text-indigo-400' : 'text-gray-400'}
		d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
	/>
</svg>
