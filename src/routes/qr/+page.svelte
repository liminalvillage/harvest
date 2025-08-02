<script lang="ts">
	import QRCode from '../../components/QRCode.svelte';
	import { onMount } from 'svelte';

	export let data: any;

	$: ({ action, title, chatId, desc, hasValidParams } = data);
</script>

<svelte:head>
	<title>QR Badge - {title}</title>
	<meta name="description" content="QR Code for {title} badge" />
</svelte:head>

<div class="max-w-md w-full">
	{#if hasValidParams}
		<QRCode {action} {title} {chatId} {desc} />
	{:else}
		<div class="bg-gray-800 rounded-3xl p-8 text-center">
			<h1 class="text-2xl font-bold text-white mb-4">Invalid QR Parameters</h1>
			<p class="text-gray-400 mb-4">
				Missing required parameters: action, title, or chatId
			</p>
			<div class="text-sm text-gray-500">
				<p>Expected URL format:</p>
				<p class="font-mono text-xs mt-2">
					/qr?action=badge&title=Title&chatId=123&desc=Description
				</p>
			</div>
		</div>
	{/if}
</div> 