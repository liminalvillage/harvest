<script lang="ts">
  export let active = false;
</script>

<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
  <path 
    stroke-linecap="round" 
    stroke-linejoin="round" 
    class={active ? 'text-indigo-400' : 'text-gray-400'}
    d="M3 6v12a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2zm0 5h18M9 3v2m6-2v2" 
  />
  <path 
    stroke-linecap="round" 
    stroke-linejoin="round" 
    class={active ? 'text-indigo-400' : 'text-gray-400'}
    d="M12 14c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3z"
  />
</svg> 