// TranscriptionManager - Orchestrates real-time transcription
// Autonomous component that can be tested and evolved independently

import { WhisperBrowserClient } from '$lib/whisperBrowserClient';
import type { TypedEventBus } from '../shared/eventBus';
import type {
  TranscriptionSegment,
  TranscriptionResult,
  WhisperConfig,
  TranscriptionStatus
} from '../shared/types';

export class TranscriptionManager {
  private whisperClient: WhisperBrowserClient | null = null;
  private audioSources = new Map<string, MediaStream>();
  private segments: TranscriptionSegment[] = [];
  private isRecording = false;
  private startTime = 0;
  private status: TranscriptionStatus = 'idle';

  constructor(private eventBus: TypedEventBus) {}

  async initialize(config?: Partial<WhisperConfig>): Promise<void> {
    try {
      this.updateStatus('loading');

      // Better defaults for Stage 1
      const fullConfig: WhisperConfig = {
        model: config?.model || 'Xenova/whisper-base', // Better model
        language: config?.language || 'en',
        chunkLengthSeconds: config?.chunkLengthSeconds || 5, // Lower latency
        task: config?.task || 'transcribe'
      };

      this.whisperClient = new WhisperBrowserClient(fullConfig);

      // Wire up callbacks
      this.whisperClient.onTranscriptionSegment((segment: TranscriptionSegment) => {
        this.handleSegment(segment);
      });

      this.whisperClient.onErrorCallback((error: Error) => {
        console.error('[TranscriptionManager] Error:', error);
        this.eventBus.emit('transcription:error', error);
        this.updateStatus('error');
      });

      this.whisperClient.onStatusCallback((status) => {
        console.log('[TranscriptionManager] Whisper status:', status);
        if (status === 'loading') this.updateStatus('loading');
        if (status === 'ready') this.updateStatus('ready');
        if (status === 'transcribing' && this.isRecording) this.updateStatus('transcribing');
      });

      await this.whisperClient.initialize();
      this.updateStatus('ready');
    } catch (error) {
      console.error('[TranscriptionManager] Failed to initialize:', error);
      this.updateStatus('error');
      throw error;
    }
  }

  addAudioSource(stream: MediaStream, sourceId: string): void {
    if (this.audioSources.has(sourceId)) {
      return;
    }

    this.audioSources.set(sourceId, stream);

    // If already recording, start transcribing this stream
    // For Stage 1: We only use the first (local) stream
    // For Stage 2: We'll mix all streams
    if (this.isRecording && this.audioSources.size === 1) {
      this.whisperClient?.startRecording(stream);
    }
  }

  removeAudioSource(sourceId: string): void {
    this.audioSources.delete(sourceId);
  }

  async startTranscription(): Promise<void> {
    if (this.isRecording || !this.whisperClient || this.audioSources.size === 0) {
      return;
    }

    this.isRecording = true;
    this.segments = [];
    this.startTime = Date.now();
    this.updateStatus('transcribing');

    // For Stage 1: Use first audio source (local microphone)
    const firstStream = Array.from(this.audioSources.values())[0];
    await this.whisperClient.startRecording(firstStream);

    this.eventBus.emit('transcription:started', undefined);
  }

  async stopTranscription(): Promise<TranscriptionResult> {
    if (!this.isRecording) {
      return this.getResult();
    }

    this.isRecording = false;

    if (this.whisperClient) {
      await this.whisperClient.stopRecording();
    }

    const result = this.getResult();
    this.eventBus.emit('transcription:stopped', {
      segments: result.segments,
      fullText: result.fullText
    });

    this.updateStatus('ready');
    return result;
  }

  private handleSegment(segment: TranscriptionSegment): void {
    const newText = segment.text.trim();

    // Skip empty segments
    if (!newText) {
      return;
    }

    // Add segment without deduplication
    // We trust the ring buffer to provide non-overlapping audio chunks
    this.segments.push(segment);

    // Emit to UI
    this.eventBus.emit('transcription:segment', segment);
  }

  private getResult(): TranscriptionResult {
    const endTime = Date.now();

    return {
      segments: [...this.segments],
      fullText: this.segments.map(s => s.text).join(' '),
      language: 'en',
      startTime: this.startTime,
      endTime: endTime
    };
  }

  private updateStatus(status: TranscriptionStatus): void {
    this.status = status;
  }

  getStatus(): TranscriptionStatus {
    return this.status;
  }

  getSegments(): TranscriptionSegment[] {
    return [...this.segments];
  }

  destroy(): void {
    if (this.isRecording) {
      this.stopTranscription();
    }

    this.whisperClient?.dispose();
    this.whisperClient = null;
    this.audioSources.clear();
    this.segments = [];
  }
}
