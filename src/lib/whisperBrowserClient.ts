// Browser-based Whisper Client using Transformers.js with Web Audio API
// Runs entirely in the browser with no backend server needed
// Uses continuous audio streaming instead of MediaRecorder chunks

import { pipeline, type PipelineType, env } from '@xenova/transformers';

// Configure Transformers.js to use HuggingFace CDN for model files
env.allowRemoteModels = true;
env.allowLocalModels = false;
env.remoteHost = 'https://huggingface.co';
env.remotePathTemplate = '{model}/resolve/{revision}/';
env.backends.onnx.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/@xenova/transformers@latest/dist/';

export interface TranscriptionSegment {
  timestamp: number;
  text: string;
  confidence?: number;
}

export interface WhisperBrowserConfig {
  model?: string;
  language?: string;
  chunkLengthSeconds?: number; // How often to transcribe
  task?: 'transcribe' | 'translate';
}

type TranscriptionCallback = (segment: TranscriptionSegment) => void;
type ErrorCallback = (error: Error) => void;
type StatusCallback = (status: 'loading' | 'ready' | 'transcribing' | 'error') => void;

export class WhisperBrowserClient {
  private config: Required<WhisperBrowserConfig>;
  private transcriber: any = null;

  // Web Audio API components
  private audioContext: AudioContext | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private processor: AudioWorkletNode | ScriptProcessorNode | null = null;

  // Ring buffer for continuous audio
  private ringBuffer: Float32Array | null = null;
  private writePosition = 0;
  private readPosition = 0;
  private bufferSize = 0;

  // Transcription control
  private isRecording = false;
  private transcriptionInterval: number | null = null;
  private isTranscribing = false;

  // Callbacks
  private onTranscription: TranscriptionCallback | null = null;
  private onError: ErrorCallback | null = null;
  private onStatus: StatusCallback | null = null;

  constructor(config: WhisperBrowserConfig = {}) {
    this.config = {
      model: config.model || 'Xenova/whisper-tiny',
      language: config.language || 'en',
      chunkLengthSeconds: config.chunkLengthSeconds || 10,
      task: config.task || 'transcribe'
    };
  }

  /**
   * Initialize the Whisper model
   */
  async initialize(): Promise<void> {
    try {
      this.updateStatus('loading');

      this.transcriber = await pipeline(
        'automatic-speech-recognition' as PipelineType,
        this.config.model,
        {
          quantized: true,
          local_files_only: false,
        }
      );

      this.updateStatus('ready');
    } catch (error) {
      console.error('[WhisperBrowser] Failed to initialize:', error);
      this.updateStatus('error');
      this.handleError(error as Error);
      throw error;
    }
  }

  /**
   * Start recording and transcribing audio using Web Audio API
   */
  async startRecording(mediaStream: MediaStream): Promise<void> {
    if (!this.transcriber) {
      await this.initialize();
    }

    try {
      // Create audio context at 16kHz (Whisper's native sample rate)
      this.audioContext = new AudioContext({ sampleRate: 16000 });

      // Initialize ring buffer (60 seconds capacity)
      this.bufferSize = 16000 * 60;
      this.ringBuffer = new Float32Array(this.bufferSize);
      this.writePosition = 0;
      this.readPosition = 0;

      // Create audio source from media stream
      this.source = this.audioContext.createMediaStreamSource(mediaStream);

      // Try to use AudioWorklet (modern, efficient)
      try {
        await this.setupAudioWorklet();
      } catch (error) {
        // Fallback to ScriptProcessor (deprecated but more compatible)
        this.setupScriptProcessor();
      }

      this.isRecording = true;
      this.updateStatus('transcribing');

      // Start periodic transcription
      this.startTranscriptionLoop();
    } catch (error) {
      console.error('[WhisperBrowser] Failed to start recording:', error);
      this.handleError(error as Error);
      throw error;
    }
  }

  /**
   * Setup AudioWorklet for modern browsers
   */
  private async setupAudioWorklet(): Promise<void> {
    if (!this.audioContext) throw new Error('AudioContext not initialized');

    // Create inline AudioWorklet processor
    const processorCode = `
      class AudioCaptureProcessor extends AudioWorkletProcessor {
        process(inputs, outputs, parameters) {
          const input = inputs[0];
          if (input.length > 0) {
            const samples = input[0];
            if (samples) {
              // Send samples to main thread
              this.port.postMessage(samples);
            }
          }
          return true;
        }
      }
      registerProcessor('audio-capture-processor', AudioCaptureProcessor);
    `;

    const blob = new Blob([processorCode], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);

    await this.audioContext.audioWorklet.addModule(url);
    URL.revokeObjectURL(url);

    this.processor = new AudioWorkletNode(this.audioContext, 'audio-capture-processor');

    // Handle audio data from worklet
    this.processor.port.onmessage = (event) => {
      this.writeToRingBuffer(event.data);
    };

    this.source!.connect(this.processor);
  }

  /**
   * Setup ScriptProcessor as fallback for older browsers
   */
  private setupScriptProcessor(): void {
    if (!this.audioContext) throw new Error('AudioContext not initialized');

    // Create script processor (4096 samples buffer)
    this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);

    this.processor.onaudioprocess = (event) => {
      const samples = event.inputBuffer.getChannelData(0);
      this.writeToRingBuffer(samples);
    };

    this.source!.connect(this.processor);
    this.processor.connect(this.audioContext.destination);
  }

  /**
   * Write audio samples to ring buffer
   */
  private writeToRingBuffer(samples: Float32Array): void {
    if (!this.ringBuffer) return;

    for (let i = 0; i < samples.length; i++) {
      this.ringBuffer[this.writePosition] = samples[i];
      this.writePosition = (this.writePosition + 1) % this.bufferSize;
    }
  }

  /**
   * Start the transcription loop
   */
  private startTranscriptionLoop(): void {
    const intervalMs = this.config.chunkLengthSeconds * 1000;

    this.transcriptionInterval = window.setInterval(async () => {
      if (this.isRecording && !this.isTranscribing) {
        await this.transcribeWindow();
      }
    }, intervalMs);
  }

  /**
   * Extract audio window and transcribe it
   */
  private async transcribeWindow(): Promise<void> {
    if (!this.ringBuffer || this.isTranscribing) return;

    try {
      this.isTranscribing = true;

      const availableSamples = this.getAvailableSamples();
      const windowSamples = this.config.chunkLengthSeconds * 16000;

      // Only transcribe if we have enough NEW audio (not previously processed)
      if (availableSamples < windowSamples) {
        this.isTranscribing = false;
        return;
      }

      // Extract window from ring buffer (ONLY new audio since last read)
      const audioWindow = this.extractWindow(windowSamples);

      // Check if window has actual audio (not silence)
      const energy = this.calculateEnergy(audioWindow);
      if (energy < 0.0001) {
        this.readPosition = (this.readPosition + windowSamples) % this.bufferSize;
        this.isTranscribing = false;
        return;
      }

      // Transcribe with Whisper
      // Set chunk_length_s to 0 to disable Whisper's internal chunking
      // We're already handling chunking via the ring buffer
      const result = await this.transcriber(audioWindow, {
        language: this.config.language === 'auto' ? undefined : this.config.language,
        task: this.config.task,
        chunk_length_s: 0, // Disable internal chunking - process entire window
        return_timestamps: false // Don't need timestamps for continuous transcription
      });

      // Process transcription result
      if (result && result.text && result.text.trim().length > 0) {
        const segment: TranscriptionSegment = {
          timestamp: Date.now() / 1000,
          text: result.text.trim(),
          confidence: result.confidence || undefined
        };

        if (this.onTranscription) {
          this.onTranscription(segment);
        }
      }

      // Move read position forward to mark this audio as processed
      this.readPosition = (this.readPosition + windowSamples) % this.bufferSize;

    } catch (error) {
      console.error('[WhisperBrowser] Transcription failed:', error);
      this.handleError(error as Error);
    } finally {
      this.isTranscribing = false;
    }
  }

  /**
   * Extract audio window from ring buffer
   */
  private extractWindow(size: number): Float32Array {
    if (!this.ringBuffer) return new Float32Array(0);

    const window = new Float32Array(size);
    for (let i = 0; i < size; i++) {
      const pos = (this.readPosition + i) % this.bufferSize;
      window[i] = this.ringBuffer[pos];
    }
    return window;
  }

  /**
   * Calculate number of available samples in buffer
   */
  private getAvailableSamples(): number {
    const diff = this.writePosition - this.readPosition;
    return diff >= 0 ? diff : this.bufferSize + diff;
  }

  /**
   * Calculate audio energy (simple VAD)
   */
  private calculateEnergy(samples: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < samples.length; i++) {
      sum += samples[i] * samples[i];
    }
    return sum / samples.length;
  }

  /**
   * Stop recording
   */
  async stopRecording(): Promise<void> {
    this.isRecording = false;

    // Stop transcription loop
    if (this.transcriptionInterval) {
      clearInterval(this.transcriptionInterval);
      this.transcriptionInterval = null;
    }

    // Wait for any in-progress transcription
    while (this.isTranscribing) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Disconnect audio processing
    if (this.processor) {
      if (this.processor instanceof AudioWorkletNode) {
        this.processor.port.onmessage = null;
      }
      this.processor.disconnect();
      this.processor = null;
    }

    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }

    if (this.audioContext) {
      await this.audioContext.close();
      this.audioContext = null;
    }

    // Clear buffer
    this.ringBuffer = null;
    this.writePosition = 0;
    this.readPosition = 0;

    this.updateStatus('ready');
  }

  /**
   * Set callback for transcription segments
   */
  onTranscriptionSegment(callback: TranscriptionCallback): void {
    this.onTranscription = callback;
  }

  /**
   * Set callback for errors
   */
  onErrorCallback(callback: ErrorCallback): void {
    this.onError = callback;
  }

  /**
   * Set callback for status updates
   */
  onStatusCallback(callback: StatusCallback): void {
    this.onStatus = callback;
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    if (this.isRecording) {
      this.stopRecording();
    }
    this.transcriber = null;
  }

  /**
   * Update status and notify callback
   */
  private updateStatus(status: 'loading' | 'ready' | 'transcribing' | 'error'): void {
    if (this.onStatus) {
      this.onStatus(status);
    }
  }

  /**
   * Handle errors and notify callback
   */
  private handleError(error: Error): void {
    if (this.onError) {
      this.onError(error);
    }
  }
}
