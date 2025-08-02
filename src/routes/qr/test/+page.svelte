<script lang="ts">
	import QRCode from '../../../components/QRCode.svelte';
</script>

<svelte:head>
	<title>QR Test Page</title>
</svelte:head>

<div class="min-h-screen bg-gray-900 p-8">
	<div class="max-w-4xl mx-auto">
		<h1 class="text-3xl font-bold text-white mb-8">QR Component Test</h1>
		
		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
			<!-- Test with the exact URL from the user's request -->
			<div>
				<h2 class="text-xl font-bold text-white mb-4">Badge QR Code</h2>
				<QRCode 
					action="badge" 
					title="First Helper" 
					chatId="235114395" 
				/>
			</div>
			
			<!-- Test with different parameters -->
			<div>
				<h2 class="text-xl font-bold text-white mb-4">Another Badge</h2>
				<QRCode 
					action="badge" 
					title="Community Leader" 
					chatId="123456789" 
				/>
			</div>
			
			<!-- Test with special characters -->
			<div>
				<h2 class="text-xl font-bold text-white mb-4">Special Characters</h2>
				<QRCode 
					action="badge" 
					title="First+Helper" 
					chatId="235114395" 
				/>
			</div>
		</div>
		
		<div class="mt-8 p-6 bg-gray-800 rounded-3xl">
			<h3 class="text-xl font-bold text-white mb-4">Test URLs</h3>
			<div class="space-y-2 text-sm">
				<p class="text-gray-300">
					<a href="/qr?action=badge&title=First+Helper&chatId=235114395" class="text-blue-400 hover:text-blue-300">
						/qr?action=badge&title=First+Helper&chatId=235114395
					</a>
				</p>
				<p class="text-gray-300">
					<a href="/qr?action=badge&title=Community+Leader&chatId=123456789" class="text-blue-400 hover:text-blue-300">
						/qr?action=badge&title=Community+Leader&chatId=123456789
					</a>
				</p>
				<p class="text-gray-300">
					<a href="/qr?action=badge&title=Test+Badge&chatId=999888777" class="text-blue-400 hover:text-blue-300">
						/qr?action=badge&title=Test+Badge&chatId=999888777
					</a>
				</p>
			</div>
			
			<div class="mt-6 p-4 bg-gray-700 rounded-2xl">
				<h4 class="text-lg font-bold text-white mb-2">New Features</h4>
				<ul class="text-sm text-gray-300 space-y-1">
					<li>• QR codes now generated as SVG format for better quality</li>
					<li>• Download button with filename based on badge title</li>
					<li>• SVG files are scalable and print-friendly</li>
				</ul>
			</div>
		</div>
	</div>
</div> 