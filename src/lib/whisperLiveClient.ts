/**
 * WhisperLive WebSocket Client
 *
 * Connects to a WhisperLive server for real-time audio transcription
 * Based on the WhisperLive protocol: https://github.com/collabora/WhisperLive
 */

export interface WhisperLiveConfig {
  serverUrl?: string;  // WebSocket server URL (default: ws://localhost:9090)
  language?: string;   // Language code (e.g., 'en', 'es')
  model?: string;      // Whisper model size ('tiny', 'base', 'small', 'medium', 'large')
  task?: 'transcribe' | 'translate';
  useVAD?: boolean;    // Voice Activity Detection
  sampleRate?: number; // Audio sample rate (default: 16000)
}

export interface TranscriptionSegment {
  timestamp: number;   // Time in seconds from start
  text: string;        // Transcribed text
  speaker?: string;    // Speaker identification (if available)
  confidence?: number; // Confidence score (0-1)
}

export interface PodcastTranscript {
  segments: TranscriptionSegment[];
  fullText: string;
  language?: string;
}

export type TranscriptionCallback = (segment: TranscriptionSegment) => void;
export type ErrorCallback = (error: Error) => void;
export type StatusCallback = (status: 'connecting' | 'connected' | 'disconnected' | 'error') => void;

export class WhisperLiveClient {
  private ws: WebSocket | null = null;
  private config: Required<WhisperLiveConfig>;
  private clientId: string;
  private audioContext: AudioContext | null = null;
  private processorNode: ScriptProcessorNode | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private isConnected = false;
  private segments: TranscriptionSegment[] = [];

  // Callbacks
  private onTranscription: TranscriptionCallback | null = null;
  private onError: ErrorCallback | null = null;
  private onStatus: StatusCallback | null = null;

  constructor(config: WhisperLiveConfig = {}) {
    this.config = {
      serverUrl: config.serverUrl || 'ws://localhost:9090',
      language: config.language || 'en',
      model: config.model || 'base',
      task: config.task || 'transcribe',
      useVAD: config.useVAD !== undefined ? config.useVAD : true,
      sampleRate: config.sampleRate || 16000
    };

    // Generate unique client ID
    this.clientId = `client_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    console.log('[WhisperLive] Client initialized:', this.config);
  }

  /**
   * Set callback for receiving transcription segments
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
  onStatusChange(callback: StatusCallback): void {
    this.onStatus = callback;
  }

  /**
   * Connect to WhisperLive server and start streaming audio
   */
  async connect(mediaStream: MediaStream): Promise<void> {
    try {
      this.updateStatus('connecting');

      // Initialize WebSocket connection
      await this.connectWebSocket();

      // Initialize audio processing
      await this.initializeAudio(mediaStream);

      this.isConnected = true;
      this.updateStatus('connected');
      console.log('[WhisperLive] Successfully connected and streaming');
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.handleError(err);
      throw err;
    }
  }

  /**
   * Establish WebSocket connection
   */
  private connectWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.config.serverUrl);

        this.ws.onopen = () => {
          console.log('[WhisperLive] WebSocket connected');

          // Send configuration message
          const configMessage = {
            uid: this.clientId,
            language: this.config.language,
            task: this.config.task,
            model: this.config.model,
            use_vad: this.config.useVAD
          };

          this.ws?.send(JSON.stringify(configMessage));
          console.log('[WhisperLive] Sent config:', configMessage);
          resolve();
        };

        this.ws.onmessage = (event) => {
          this.handleWebSocketMessage(event);
        };

        this.ws.onerror = (error) => {
          console.error('[WhisperLive] WebSocket error:', error);
          reject(new Error('WebSocket connection failed'));
        };

        this.ws.onclose = () => {
          console.log('[WhisperLive] WebSocket closed');
          this.isConnected = false;
          this.updateStatus('disconnected');
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Handle incoming WebSocket messages (transcription results)
   */
  private handleWebSocketMessage(event: MessageEvent): void {
    try {
      const data = JSON.parse(event.data);

      console.log('[WhisperLive] Received transcription:', data);

      // Process transcription segments
      if (data.segments && Array.isArray(data.segments)) {
        data.segments.forEach((segment: any) => {
          const transcriptionSegment: TranscriptionSegment = {
            timestamp: segment.start || segment.timestamp || Date.now() / 1000,
            text: segment.text || '',
            confidence: segment.confidence
          };

          this.segments.push(transcriptionSegment);

          if (this.onTranscription) {
            this.onTranscription(transcriptionSegment);
          }
        });
      }
    } catch (error) {
      console.error('[WhisperLive] Failed to parse message:', error);
    }
  }

  /**
   * Initialize audio processing pipeline
   */
  private async initializeAudio(mediaStream: MediaStream): Promise<void> {
    // Create AudioContext
    this.audioContext = new AudioContext({ sampleRate: this.config.sampleRate });

    // Create source from MediaStream
    this.sourceNode = this.audioContext.createMediaStreamSource(mediaStream);

    // Create ScriptProcessor for audio data (deprecated but still widely supported)
    // Buffer size: 4096 samples
    this.processorNode = this.audioContext.createScriptProcessor(4096, 1, 1);

    this.processorNode.onaudioprocess = (event) => {
      if (!this.isConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
        return;
      }

      // Get audio data from input buffer
      const inputData = event.inputBuffer.getChannelData(0);

      // Convert Float32Array to Int16Array (PCM 16-bit)
      const pcmData = this.convertFloat32ToInt16(inputData);

      // Send binary audio data to server
      this.ws.send(pcmData.buffer);
    };

    // Connect nodes
    this.sourceNode.connect(this.processorNode);
    this.processorNode.connect(this.audioContext.destination);

    console.log('[WhisperLive] Audio pipeline initialized');
  }

  /**
   * Convert Float32Array audio data to Int16Array (PCM 16-bit)
   */
  private convertFloat32ToInt16(float32Array: Float32Array): Int16Array {
    const int16Array = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      // Clamp to [-1, 1] and convert to 16-bit PCM
      const sample = Math.max(-1, Math.min(1, float32Array[i]));
      int16Array[i] = sample < 0 ? sample * 32768 : sample * 32767;
    }
    return int16Array;
  }

  /**
   * Disconnect and cleanup
   */
  disconnect(): void {
    console.log('[WhisperLive] Disconnecting...');

    this.isConnected = false;

    // Close WebSocket
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    // Cleanup audio
    if (this.processorNode) {
      this.processorNode.disconnect();
      this.processorNode = null;
    }

    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.updateStatus('disconnected');
    console.log('[WhisperLive] Disconnected');
  }

  /**
   * Get all transcription segments
   */
  getTranscript(): PodcastTranscript {
    return {
      segments: this.segments,
      fullText: this.segments.map(s => s.text).join(' '),
      language: this.config.language
    };
  }

  /**
   * Clear transcript segments
   */
  clearTranscript(): void {
    this.segments = [];
  }

  /**
   * Check if client is connected
   */
  isClientConnected(): boolean {
    return this.isConnected && this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Update status and notify callback
   */
  private updateStatus(status: 'connecting' | 'connected' | 'disconnected' | 'error'): void {
    if (this.onStatus) {
      this.onStatus(status);
    }
  }

  /**
   * Handle errors
   */
  private handleError(error: Error): void {
    console.error('[WhisperLive] Error:', error);
    this.updateStatus('error');

    if (this.onError) {
      this.onError(error);
    }
  }
}
