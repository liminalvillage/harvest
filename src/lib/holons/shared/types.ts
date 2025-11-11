// Shared types across all conversation recording components

export interface TranscriptionSegment {
  timestamp: number;
  text: string;
  confidence?: number;
  speakerId?: string; // For future multi-speaker identification
}

export interface PodcastMetadata {
  holonId: string;
  participants: Array<{
    id: string;
    username: string;
    role: 'host' | 'participant';
  }>;
  startTime: number;
  endTime: number;
  duration: number;
}

export interface Podcast extends PodcastMetadata {
  id: string;
  title: string;
  description?: string;
  date: string;
  fullText: string;
  language: string;
  segmentCount: number;
  segments?: TranscriptionSegment[];
}

export interface TranscriptionResult {
  segments: TranscriptionSegment[];
  fullText: string;
  language: string;
  startTime: number;
  endTime: number;
}

export interface WhisperConfig {
  model: 'Xenova/whisper-tiny' | 'Xenova/whisper-base' | 'Xenova/whisper-small';
  language: string;
  chunkLengthSeconds: number;
  task: 'transcribe' | 'translate';
}

export type CallStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'recording'
  | 'error';

export type TranscriptionStatus =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'transcribing'
  | 'error';
