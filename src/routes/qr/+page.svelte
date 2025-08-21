<script lang="ts">
	import QRCode from '../../components/QRCode.svelte';
	import TelegramAuth from '../../components/TelegramAuth.svelte';
	import { QRActionService, type TelegramUser, type QRActionResult } from '../../utils/qr-action-service';
	import { onMount, getContext } from 'svelte';
	import HoloSphere from 'holosphere';
	import { goto } from '$app/navigation';

	export let data: any;

	$: ({ action, title, desc, holonID, deckId, cardId, hasValidParams } = data);

	let holosphere: HoloSphere;
	let qrActionService: QRActionService;
	let currentUser: TelegramUser | null = null;
	let isProcessingAction = false;
	let actionResult: QRActionResult | null = null;
	let showActionModal = false;

	onMount(() => {
		// Get holosphere context
		holosphere = getContext('holosphere');
		if (holosphere) {
			qrActionService = new QRActionService(holosphere);
		}
	});

	function handleAuthSuccess(userData: TelegramUser) {
		currentUser = userData;
		console.log('User authenticated:', userData);
		
		// If we have valid QR parameters, automatically process the action
		if (hasValidParams && qrActionService) {
			processQRAction();
		}
	}

	async function processQRAction() {
		if (!currentUser || !qrActionService || !hasValidParams) {
			return;
		}

		isProcessingAction = true;
		actionResult = null;

		try {
			const params = {
				action,
				title,
				desc,
				holonID,
				deckId,
				cardId
			};

			// Validate parameters
			const validation = qrActionService.validateQRParams(params);
			if (!validation.isValid) {
				actionResult = {
					success: false,
					message: `Invalid QR parameters: ${validation.errors.join(', ')}`,
					error: 'VALIDATION_ERROR'
				};
				return;
			}

			// Process the action
			const result = await qrActionService.processQRAction(params, currentUser);
			actionResult = result;
			
			// Show the result modal
			showActionModal = true;

			// If successful and there's a redirect URL, navigate after a delay
			if (result.success && result.redirectUrl) {
				setTimeout(() => {
					goto(result.redirectUrl!);
				}, 3000);
			}
		} catch (error) {
			console.error('Error processing QR action:', error);
			actionResult = {
				success: false,
				message: 'An unexpected error occurred',
				error: error instanceof Error ? error.message : 'UNEXPECTED_ERROR'
			};
		} finally {
			isProcessingAction = false;
		}
	}

	function closeActionModal() {
		showActionModal = false;
		actionResult = null;
	}

	function handleManualAction() {
		// Trigger action processing manually
		if (currentUser) {
			processQRAction();
		}
	}
</script>

<svelte:head>
	<title>QR Badge - {title}</title>
	<meta name="description" content="QR Code for {title} badge" />
</svelte:head>

<div class="qr-page">
	<div class="max-w-4xl mx-auto p-4">
		<!-- Header -->
		<div class="text-center mb-8">
			<h1 class="text-3xl font-bold text-white mb-2">QR Code Scanner</h1>
			<p class="text-gray-300">
				Scan this QR code to perform automated actions in the holon
			</p>
		</div>

		<div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
			<!-- Left Column: Authentication -->
			<div class="space-y-6">
				<div class="bg-gray-800 rounded-2xl p-6">
					<h2 class="text-xl font-semibold text-white mb-4">🔐 Authentication Required</h2>
					<p class="text-gray-400 mb-4">
						You need to login with Telegram to perform actions with this QR code.
					</p>
					
					<TelegramAuth 
						{holonID} 
						onAuthSuccess={handleAuthSuccess}
					/>
				</div>

				{#if currentUser && hasValidParams}
					<div class="bg-gray-800 rounded-2xl p-6">
						<h3 class="text-lg font-semibold text-white mb-4">🎯 Ready to Process</h3>
						<div class="space-y-3">
							<div class="flex items-center gap-3">
								<span class="text-gray-400">Action:</span>
								<span class="text-white font-medium">{action}</span>
							</div>
							<div class="flex items-center gap-3">
								<span class="text-gray-400">Title:</span>
								<span class="text-white font-medium">{title}</span>
							</div>
							{#if desc}
								<div class="flex items-center gap-3">
									<span class="text-gray-400">Description:</span>
									<span class="text-white font-medium">{desc}</span>
								</div>
							{/if}
							<div class="flex items-center gap-3">
								<span class="text-gray-400">Holon ID:</span>
								<span class="text-white font-medium">{holonID}</span>
							</div>
						</div>
						
						<button 
							on:click={handleManualAction}
							class="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-xl transition-colors"
							disabled={isProcessingAction}
						>
							{#if isProcessingAction}
								<div class="flex items-center justify-center gap-2">
									<div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
									Processing...
								</div>
							{:else}
								🚀 Process Action
							{/if}
						</button>
					</div>
				{/if}
			</div>

			<!-- Right Column: QR Code Display -->
			<div class="space-y-6">
				{#if hasValidParams}
					<QRCode {action} {title} {desc} {holonID} {deckId} {cardId} />
				{:else}
					<div class="bg-gray-800 rounded-3xl p-8 text-center">
						<h1 class="text-2xl font-bold text-white mb-4">Invalid QR Parameters</h1>
						<p class="text-gray-400 mb-4">
							Missing required parameters: action, title, or holonID
						</p>
						<div class="text-sm text-gray-500">
							<p>Expected URL format:</p>
							<p class="font-mono text-xs mt-2">
								/qr?action=role&title=Title&desc=Description&holonID=123&deckId=Deck&cardId=Card
							</p>
						</div>
					</div>
				{/if}

				<!-- Action Information -->
				{#if hasValidParams}
					<div class="bg-gray-800 rounded-2xl p-6">
						<h3 class="text-lg font-semibold text-white mb-4">📋 Action Information</h3>
						<div class="space-y-3 text-sm">
							<div class="flex justify-between">
								<span class="text-gray-400">Action Type:</span>
								<span class="text-white capitalize">{action}</span>
							</div>
							<div class="flex justify-between">
								<span class="text-gray-400">Target:</span>
								<span class="text-white">{title}</span>
							</div>
							{#if desc}
								<div class="flex justify-between">
									<span class="text-gray-400">Description:</span>
									<span class="text-white">{desc}</span>
								</div>
							{/if}
							<div class="flex justify-between">
								<span class="text-gray-400">Holon:</span>
								<span class="text-white">{holonID}</span>
							</div>
							{#if deckId}
								<div class="flex justify-between">
									<span class="text-gray-400">Deck:</span>
									<span class="text-white">{deckId}</span>
								</div>
							{/if}
							{#if cardId}
								<div class="flex justify-between">
									<span class="text-gray-400">Card:</span>
									<span class="text-white">{cardId}</span>
								</div>
							{/if}
						</div>
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>

<!-- Action Result Modal -->
{#if showActionModal && actionResult}
	<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
		<div class="bg-gray-800 rounded-2xl p-6 max-w-md w-full">
			<div class="text-center">
				{#if actionResult.success}
					<div class="text-6xl mb-4">✅</div>
					<h3 class="text-xl font-semibold text-white mb-2">Action Successful!</h3>
				{:else}
					<div class="text-6xl mb-4">❌</div>
					<h3 class="text-xl font-semibold text-red-400 mb-2">Action Failed</h3>
				{/if}
				
				<p class="text-gray-300 mb-6">{actionResult.message}</p>
				
				{#if actionResult.redirectUrl}
					<p class="text-sm text-gray-400 mb-4">
						Redirecting to: {actionResult.redirectUrl}
					</p>
				{/if}
				
				<button 
					on:click={closeActionModal}
					class="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-xl transition-colors"
				>
					Close
				</button>
			</div>
		</div>
	</div>
{/if}

<style lang="scss">
	.qr-page {
		min-height: 100vh;
		background: linear-gradient(135deg, #1f2937 0%, #111827 100%);
		padding: 2rem 0;
	}

	.grid {
		grid-template-columns: 1fr;
		
		@media (min-width: 1024px) {
			grid-template-columns: 1fr 1fr;
		}
	}
</style> 