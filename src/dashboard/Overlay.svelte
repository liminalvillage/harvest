<script lang="ts">
	import { closeSidebar, sidebarOpen } from './store';
</script>

<!-- Overlay will only be visible on small screens to emphasize the focus on sidebar when it is open.-->
<!--it's also used to close Sidebar on click outside-->
<button
	on:click={closeSidebar}
	aria-label="Close sidebar overlay"
	class={$sidebarOpen
		? 'bg-black fixed h-screen left-0 opacity-40 top-0 w-screen z-30 lg:bg-transparent'
		: ''}
></button>
