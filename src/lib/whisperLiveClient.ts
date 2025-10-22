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
  private processedSegments: Set<string> = new Set(); // Track completed segments by timestamp

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

          // Send configuration message (matching official WhisperLive client protocol)
          const configMessage = {
            uid: this.clientId,
            language: this.config.language,
            task: this.config.task,
            model: this.config.model,
            use_vad: this.config.useVAD,
            // Additional parameters required by WhisperLive server
            send_last_n_segments: 10,
            no_speech_thresh: 0.45,
            clip_audio: false,
            same_output_threshold: 10,
            max_clients: 4,
            max_connection_time: 600
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

      console.log('[WhisperLive] Received message:', data);

      // Handle different message types from server
      if (data.status === 'WARNING' || data.status === 'INFO') {
        // Server status messages (TensorRT warning, SERVER_READY, etc.)
        console.log(`[WhisperLive] Server status: ${data.message}`);
        return;
      }

      // Handle transcription segments
      if (data.segments && Array.isArray(data.segments)) {
        console.log(`[WhisperLive] ✅ Received ${data.segments.length} segments:`, JSON.stringify(data.segments, null, 2));
        data.segments.forEach((segment: any, index: number) => {
          const isLast = index === data.segments.length - 1;
          const isCompleted = segment.completed === true;

          console.log(`[WhisperLive] 🔍 Segment ${index}:`, {
            text: segment.text,
            start: segment.start,
            end: segment.end,
            completed: isCompleted,
            is_last: isLast,
            raw: segment
          });

          const transcriptionSegment: TranscriptionSegment = {
            timestamp: segment.start || segment.timestamp || Date.now() / 1000,
            text: segment.text || '',
            confidence: segment.confidence
          };

          // Create unique key for this segment based on timestamp
          const segmentKey = `${transcriptionSegment.timestamp}`;

          // Only process completed segments that we haven't seen before
          if (isCompleted) {
            if (!this.processedSegments.has(segmentKey)) {
              console.log(`[WhisperLive] ✅ Adding new completed segment:`, transcriptionSegment);
              this.segments.push(transcriptionSegment);
              this.processedSegments.add(segmentKey);

              if (this.onTranscription) {
                this.onTranscription(transcriptionSegment);
              }
            } else {
              console.log(`[WhisperLive] ⏭️ Skipping duplicate completed segment at ${segmentKey}`);
            }
          } else {
            // Incomplete segment - only notify but don't add to permanent list yet
            console.log(`[WhisperLive] 🔄 Received incomplete segment (not saving yet):`, transcriptionSegment);
            // Optionally notify listeners about partial transcription updates
            // if (this.onTranscription) {
            //   this.onTranscription(transcriptionSegment);
            // }
          }
        });
      }

      // Handle single segment transcription (some servers send one at a time)
      else if (data.text && !data.segments) {
        console.log(`[WhisperLive] ✅ Received single segment: "${data.text}"`);
        const transcriptionSegment: TranscriptionSegment = {
          timestamp: data.start || data.timestamp || Date.now() / 1000,
          text: data.text,
          confidence: data.confidence
        };

        // Deduplicate single segments too
        const isDuplicate = this.segments.some(existing =>
          existing.text === transcriptionSegment.text &&
          Math.abs(existing.timestamp - transcriptionSegment.timestamp) < 0.1
        );

        if (!isDuplicate) {
          console.log(`[WhisperLive] ✅ Adding new segment:`, transcriptionSegment);
          this.segments.push(transcriptionSegment);

          if (this.onTranscription) {
            this.onTranscription(transcriptionSegment);
          }
        } else {
          console.log(`[WhisperLive] ⏭️ Skipping duplicate segment:`, transcriptionSegment.text.substring(0, 30) + '...');
        }
      }

      // Log if we received a message but no transcription
      else if (!data.status) {
        console.log(`[WhisperLive] ⚠️ Received message with no segments or text:`, data);
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

    // Create ScriptProcessor for audio data
    // NOTE: ScriptProcessorNode is deprecated in favor of AudioWorkletNode,
    // but we use it here for broad browser compatibility and simplicity.
    // Future enhancement: migrate to AudioWorkletNode for better performance
    // Buffer size: 4096 samples
    this.processorNode = this.audioContext.createScriptProcessor(4096, 1, 1);

    let audioFrameCount = 0;
    let totalBytesSent = 0;

    this.processorNode.onaudioprocess = (event) => {
      if (!this.isConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
        console.warn('[WhisperLive] ⚠️ Not sending audio - WS not ready. Connected:', this.isConnected, 'WS state:', this.ws?.readyState);
        return;
      }

      // Get audio data from input buffer
      const inputData = event.inputBuffer.getChannelData(0);

      // Calculate audio levels
      const maxLevel = Math.max(...Array.from(inputData).map(s => Math.abs(s)));
      const avgLevel = Array.from(inputData).reduce((sum, s) => sum + Math.abs(s), 0) / inputData.length;

      // Log frequently at first, then occasionally
      audioFrameCount++;
      if (audioFrameCount <= 5 || audioFrameCount % 50 === 0) {
        console.log(`[WhisperLive] 🎤 Frame ${audioFrameCount}: Max=${(maxLevel * 100).toFixed(2)}%, Avg=${(avgLevel * 100).toFixed(2)}%, Sent=${totalBytesSent} bytes`);
      }

      // Send Float32Array directly (matching official WhisperLive client)
      // The server expects Float32 audio data, not Int16
      this.ws.send(inputData.buffer);
      totalBytesSent += inputData.buffer.byteLength;

      if (audioFrameCount === 1) {
        console.log('[WhisperLive] ✅ Started sending audio data to server');
      }
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
    this.processedSegments.clear();
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
