<script>
	import { sidebarExpanded } from '../store';
	import SidebarItems from './SidebarItems.svelte';
	import { toggleSidebarExpanded } from '../store';

	const style = {
		mobileOrientation: {
			start: 'left-0 ',
			end: 'right-0 lg:left-0'
		},
		container: `pb-32 lg:pb-12`,
		close: `duration-700 ease-out hidden transition-all lg:w-20`,
		open: `absolute duration-500 ease-in transition-all w-8/12 z-40 sm:w-5/12 md:w-64`,
		default: `h-screen overflow-y-auto overflow-x-hidden text-white top-0 lg:absolute bg-gray-900 lg:block lg:z-40`
	};

	export let mobileOrientation = 'end';
</script>

<aside
	class={`${style.default} ${style.mobileOrientation[mobileOrientation]}
       ${$sidebarExpanded ? style.open : style.close}`}
	class:lg:w-64={$sidebarExpanded}
>
	<div class={style.container}>
		<!-- Expand button on desktop -->
		<div class="hidden lg:flex justify-end pr-2 pt-2">
			<button on:click={toggleSidebarExpanded} class="text-gray-400 hover:text-white transition-colors">
				{#if $sidebarExpanded}
					&laquo;
				{:else}
					&raquo;
				{/if}
			</button>
		</div>
		<SidebarItems />
	</div>
</aside>

<style>
	.scrollbar::-webkit-scrollbar {
		width: 0;
		background: transparent; /* hide Sidebar scrollbar on Chrome, Opera and other webkit Browsers*/
	}
	.scrollbar {
		-ms-overflow-style: none;
	}
</style>
