<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { ID } from '../store';
	
	function navigateToHolons() {
		// Clear the current holon ID to prevent automatic redirect back to dashboard
		ID.set('');
		goto('/');
	}
</script>

<div class="bg-gray-900 flex items-center justify-center mb-6 pb-6 pt-3 sticky top-0 z-10">
	<button 
		on:click={navigateToHolons}
		class="hover:bg-gray-800 p-2 rounded-lg transition-colors duration-200 cursor-pointer"
		aria-label="Go to My Holons"
	>
		<svg class="w-16 h-16 text-white" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
			<circle cx="9" cy="12" r="6" fill="transparent" stroke="white" stroke-width="2"/>
			<circle cx="15" cy="12" r="6" fill="transparent" stroke="white" stroke-width="2"/>
		</svg>
	</button>
</div>
