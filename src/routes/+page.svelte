<script lang="ts">
  import 'tailwindcss/tailwind.css';
  import { browser } from '$app/environment';
  import { page } from '$app/stores';
  import { ID } from '../dashboard/store';

  // Reset the ID when landing on the root page
  if (browser && $page.url.pathname === '/') {
    ID.set('');
  }

  function handleDemoClick() {
    if (browser) {
      localStorage.setItem('hasSeenDemoLanding', 'true');
    }
  }
</script>

<svelte:head>
  <title>Welcome to the holonic dashboard</title>
</svelte:head>

<div class="relative bg-gray-900 h-screen overflow-hidden flex items-center justify-center p-4">
  <div class="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-10" style="background-image: url('/background.png');"></div>
  <div class="relative max-w-2xl w-full bg-gray-800/90 rounded-lg shadow-xl p-8 text-gray-100">
    <div class="flex items-center space-x-3 mb-8">
      <svg class="text-3xl text-white" xmlns="http://www.w3.org/2000/svg" width="40" height="24" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" fill="none" stroke="white" stroke-width="2"/>
        <circle cx="21" cy="12" r="10" fill="none" stroke="white" stroke-width="2"/>
      </svg>
      <h1 class="text-3xl font-bold">Welcome to the holonic dashboard</h1>
    </div>
    
    <div class="space-y-6">
      <p class="text-gray-300">
        This tool helps you visualize, navigate and interact with your holons.
      </p>

      <div class="bg-gray-700/50 border border-gray-600 rounded-md p-6">
        <h2 class="text-xl font-semibold text-blue-400 mb-4">Getting Started</h2>
        <ol class="list-decimal list-inside space-y-3 text-gray-300">
          <li class="flex items-center space-x-2">
            <span>Add our Telegram bot</span>
            <a href="https://t.me/HolonsBot" class="text-blue-400 hover:text-blue-300 transition-colors font-medium">
              <i class="fab fa-telegram"></i> @HolonsBot
            </a>
          </li>
          <li class="flex items-center space-x-2">
            <span>Type "/dashboard" to get a link to your own holon dashboard.</span>
          </li>
          <li class="flex items-center space-x-2">
            <span>Check out our</span>
            <a href="/demo/dashboard" on:click={handleDemoClick} class="text-blue-400 hover:text-blue-300 transition-colors font-medium">demo holon</a>
          </li>
        </ol>
      </div>

      <div class="flex justify-center">
        <a 
          href="/demo/dashboard" 
          on:click={handleDemoClick}
          class="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-center"
        >
          Continue to Demo Dashboard
        </a>
      </div>

      <div class="flex items-center justify-center pt-4">
        <a href="https://t.me/HolonsBot" class="text-sm text-gray-400 hover:text-gray-300 transition-colors flex items-center space-x-2">
          <i class="fas fa-question-circle"></i>
          <span>Need help? Contact us on Telegram</span>
        </a>
      </div>
    </div>
  </div>
</div>

