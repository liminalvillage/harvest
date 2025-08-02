<script lang="ts">
	import { onMount } from 'svelte';
	import { Html5Qrcode } from 'html5-qrcode';

	export let action: string = '';
	export let title: string = '';
	export let chatId: string = '';
	export let desc: string = '';

	let qrContainer: HTMLDivElement;
	let qrCode: string = '';

	onMount(() => {
		generateQRCode();
	});

	function generateQRCode() {
		if (!action || !title || !chatId) {
			console.error('Missing required parameters for QR code generation');
			return;
		}

		// Create the URL that the QR code should point to
		// Note: We're using the same URL structure as the original request
		const qrUrl = `https://dashboard.holons.io/qr?action=${encodeURIComponent(action)}&title=${encodeURIComponent(title)}&chatId=${encodeURIComponent(chatId)}&desc=${encodeURIComponent(desc)}`;
		
		// Generate SVG QR code using a reliable service
		// SVG format provides better quality and scalability
		qrCode = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&format=svg&data=${encodeURIComponent(qrUrl)}&margin=10`;
	}

	function downloadQRCode() {
		if (!qrCode || !title) return;
		
		// Create a temporary link element to trigger download
		const link = document.createElement('a');
		link.href = qrCode;
		
		// Create filename from title, sanitized for file system
		const sanitizedTitle = title.replace(/[^a-zA-Z0-9\s-]/g, '').replace(/\s+/g, '-').toLowerCase();
		link.download = `${sanitizedTitle}.svg`;
		
		// Trigger download
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
	}

	$: if (action && title && chatId) {
		generateQRCode();
	}
</script>

<div class="qr-container">
	<div class="qr-header">
		<h2 class="text-xl font-bold text-white mb-4">QR Badge</h2>
		<div class="badge-info text-white mb-4">
			<p><strong>Action:</strong> {action}</p>
			<p><strong>Title:</strong> {title}</p>
			<p><strong>Chat ID:</strong> {chatId}</p>
			{#if desc}
				<p><strong>Description:</strong> {desc}</p>
			{/if}
		</div>
	</div>
	
	<div class="qr-code-wrapper" bind:this={qrContainer}>
		{#if qrCode}
			<img 
				src={qrCode} 
				alt="QR Code for {title}" 
				class="qr-code-image"
				width="300" 
				height="300"
			/>
		{:else}
			<div class="qr-placeholder">
				<p class="text-gray-400">Generating QR code...</p>
			</div>
		{/if}
	</div>
	
	<div class="qr-footer mt-4">
		<p class="text-sm text-gray-400 mb-4">
			Scan this QR code to access the badge information
		</p>
		<button 
			on:click={downloadQRCode}
			class="download-btn"
			disabled={!qrCode}
		>
			📥 Download {title}.svg
		</button>
	</div>
</div>

<style lang="scss">
	.qr-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 2rem;
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		border-radius: 1rem;
		min-height: 400px;
		justify-content: center;
	}

	.qr-header {
		text-align: center;
		margin-bottom: 2rem;
	}

	.badge-info {
		background: rgba(255, 255, 255, 0.1);
		padding: 1rem;
		border-radius: 0.5rem;
		backdrop-filter: blur(10px);
		
		p {
			margin: 0.25rem 0;
			font-size: 0.9rem;
		}
	}

	.qr-code-wrapper {
		display: flex;
		justify-content: center;
		align-items: center;
		background: white;
		padding: 1rem;
		border-radius: 0.5rem;
		box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
	}

	.qr-code-image {
		border-radius: 0.25rem;
	}

	.qr-placeholder {
		width: 300px;
		height: 300px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: #f3f4f6;
		border-radius: 0.25rem;
	}

	.qr-footer {
		text-align: center;
	}

	.download-btn {
		background: rgba(255, 255, 255, 0.2);
		color: white;
		border: 1px solid rgba(255, 255, 255, 0.3);
		padding: 0.75rem 1.5rem;
		border-radius: 0.5rem;
		font-size: 0.9rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s ease;
		backdrop-filter: blur(10px);

		&:hover:not(:disabled) {
			background: rgba(255, 255, 255, 0.3);
			transform: translateY(-1px);
		}

		&:disabled {
			opacity: 0.5;
			cursor: not-allowed;
		}
	}
</style> 