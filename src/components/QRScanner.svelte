<script lang="ts">
    import { onMount, onDestroy, createEventDispatcher } from 'svelte';
    import { fade, scale } from 'svelte/transition';
    import { Html5Qrcode } from 'html5-qrcode';

    const dispatch = createEventDispatcher<{
        scan: { decodedText: string };
        error: { message: string };
        close: void;
    }>();

    let scannerContainer: HTMLDivElement;
    let html5QrCode: Html5Qrcode | null = null;
    let isScanning = false;
    let error = '';
    export let showScanner = false;
    
    $: if (showScanner) {
        // Initialize scanner if needed, then start scanning
        if (!html5QrCode) {
            initializeScanner();
        } else if (!isScanning) {
            // Only start if not already scanning
            startScanner();
        }
    } else if (!showScanner && isScanning) {
        stopScanner();
    }

    onMount(() => {
        // Initialize the scanner when component mounts
        initializeScanner();
    });

    function initializeScanner() {
        // Check if browser supports getUserMedia
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            error = 'Camera not supported in this browser';
            console.error('Camera not supported');
            return;
        }

        if (scannerContainer && !html5QrCode) {
            try {
                html5QrCode = new Html5Qrcode("qr-reader");
                console.log('QR Scanner initialized successfully');
            } catch (err) {
                console.error('Failed to initialize QR scanner:', err);
                error = 'Failed to initialize scanner';
            }
        } else if (!scannerContainer) {
            // If container is not available yet, try again after a short delay
            setTimeout(() => {
                if (showScanner && !html5QrCode) {
                    initializeScanner();
                }
            }, 100);
        }
    }

    onDestroy(() => {
        stopScanner();
    });

    async function startScanner() {
        if (!html5QrCode) {
            error = 'Scanner not initialized';
            console.error('Scanner not initialized');
            return;
        }

        try {
            console.log('Starting QR scanner...');
            error = '';
            isScanning = true;

            const config = {
                fps: 10,
                qrbox: { width: 300, height: 300 },
                aspectRatio: 1.0
            };

            console.log('Attempting to start camera with config:', config);
            
            // Try to start the camera with simple constraints
            await html5QrCode.start(
                { facingMode: "environment" }, // Use back camera
                config,
                (decodedText: string) => {
                    // Success callback
                    console.log('QR Code detected:', decodedText);
                    dispatch('scan', { decodedText });
                    stopScanner();
                },
                (errorMessage: string) => {
                    // Only log non-parse errors (parse errors are normal when no QR code is visible)
                    if (!errorMessage.includes('parse error') && !errorMessage.includes('NotFoundException') && !errorMessage.includes('No barcode or QR code detected')) {
                        console.log('QR scan error:', errorMessage);
                    }
                }
            );
            console.log('Camera started successfully');
            
            // Debug: Check if video element is present
            setTimeout(() => {
                const videoElement = document.querySelector('#qr-reader video') as HTMLVideoElement;
                if (videoElement) {
                    console.log('Video element found:', videoElement);
                    console.log('Video dimensions:', videoElement.videoWidth, 'x', videoElement.videoHeight);
                    console.log('Video display style:', window.getComputedStyle(videoElement).display);
                    
                    if (videoElement.videoWidth === 0 || videoElement.videoHeight === 0) {
                        console.log('Video appears to be black/not working');
                        error = 'Camera feed is black. Please try refreshing the page or check camera permissions.';
                    }
                } else {
                    console.log('No video element found in #qr-reader');
                }
            }, 2000);
        } catch (err) {
            console.error('Failed to start camera:', err);
            error = err instanceof Error ? err.message : 'Failed to start camera';
            isScanning = false;
        }
    }

    function stopScanner() {
        if (html5QrCode && isScanning) {
            html5QrCode.stop().then(() => {
                isScanning = false;
                console.log('QR Scanner stopped successfully');
            }).catch((err) => {
                console.error('Error stopping scanner:', err);
                isScanning = false;
            });
        } else {
            isScanning = false;
        }
    }

    function closeScanner() {
        console.log('Closing QR scanner...');
        stopScanner();
        // Reset error state
        error = '';
        dispatch('close');
    }
</script>

{#if showScanner}
    <div 
        class="fixed inset-0 bg-black/80 flex items-center justify-center z-[60]" 
        transition:fade
    >
        <div class="bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4" transition:scale>
            <div class="flex justify-between items-center mb-4">
                <h3 class="text-xl font-bold text-white">Scan QR Code</h3>
                <button
                    on:click={closeScanner}
                    class="text-gray-400 hover:text-white transition-colors"
                >
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            {#if error}
                <div class="mb-4 p-3 bg-red-900/20 border border-red-700 rounded-lg text-red-400 text-sm">
                    {error}
                </div>
            {/if}

            <div class="space-y-4">
                <div class="relative">
                    <div 
                        bind:this={scannerContainer}
                        id="qr-reader"
                        class="w-full h-64 bg-black rounded-lg overflow-hidden relative"
                    >
                        {#if !isScanning}
                            <div class="flex items-center justify-center h-full absolute inset-0 z-10">
                                <div class="text-center text-gray-400">
                                    <svg class="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h6v6H3V3zm12 0h6v6h-6V3zM3 15h6v6H3v-6zm12 0h6v6h-6v-6zM9 3v6m0 6v6" />
                                    </svg>
                                    <p>Camera not active</p>
                                </div>
                            </div>
                        {:else}
                            <!-- Video will be inserted here by html5-qrcode -->
                        {/if}
                    </div>
                    
                    <!-- Scanning overlay -->
                    {#if isScanning}
                        <div class="absolute inset-0 pointer-events-none">
                            <div class="absolute inset-0 border-2 border-blue-500 rounded-lg m-4">
                                <div class="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-blue-500"></div>
                                <div class="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-blue-500"></div>
                                <div class="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-blue-500"></div>
                                <div class="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-blue-500"></div>
                            </div>
                        </div>
                    {/if}
                </div>

                <div class="text-center text-sm text-gray-400">
                    <p>Position the QR code within the frame to scan</p>
                    <p class="text-xs mt-1">Best used on mobile devices with cameras</p>
                </div>

                <div class="flex gap-3">
                    {#if !isScanning}
                        <button
                            on:click={startScanner}
                            class="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg transition-colors"
                        >
                            Start Camera
                        </button>
                    {:else}
                        <button
                            on:click={stopScanner}
                            class="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-lg transition-colors"
                        >
                            Stop Camera
                        </button>
                    {/if}
                    <button
                        on:click={closeScanner}
                        class="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-2 px-4 rounded-lg transition-colors"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    </div>
{/if}

<style>
    /* Custom styles for the QR scanner */
    #qr-reader {
        min-height: 256px;
        position: relative;
        background: black;
    }
    
    #qr-reader video {
        width: 100% !important;
        height: 100% !important;
        object-fit: cover !important;
        border-radius: 0.5rem;
        display: block !important;
    }
    
    /* Ensure video element is visible when scanning */
    #qr-reader:has(video) {
        background: transparent !important;
    }
    
    /* Override any html5-qrcode default styles */
    #qr-reader > div {
        width: 100% !important;
        height: 100% !important;
    }
    
    #qr-reader canvas {
        display: none !important;
    }
</style> 