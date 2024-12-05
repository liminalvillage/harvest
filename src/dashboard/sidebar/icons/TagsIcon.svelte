<script lang="ts">
  export let active = false;
</script>

<svg
	xmlns="http://www.w3.org/2000/svg"
	width="24"
	height="24"
	fill="none"
	viewBox="0 0 24 24"
>
	<path
		d="M7 4V20M17 4V20M4 7H20M4 17H20"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
		class={active ? 'text-indigo-400' : 'text-gray-400'}
	/>
</svg>
