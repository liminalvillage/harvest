// Event bus for inter-component communication
// Provides loose coupling between autonomous components

import type { TranscriptionSegment, Podcast } from './types';

type EventCallback<T = any> = (data: T) => void;

export class EventBus {
  private listeners = new Map<string, Set<EventCallback>>();

  on<T = any>(event: string, callback: EventCallback<T>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }

    this.listeners.get(event)!.add(callback);

    // Return unsubscribe function
    return () => {
      this.listeners.get(event)?.delete(callback);
    };
  }

  emit<T = any>(event: string, data?: T): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(callback => callback(data));
    }
  }

  clear(event?: string): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }
}

// Event type definitions for better DX
export interface EventMap {
  // Audio stream events
  'stream:added': { stream: MediaStream; peerId: string };
  'stream:removed': { peerId: string };

  // Transcription events
  'transcription:segment': TranscriptionSegment;
  'transcription:started': void;
  'transcription:stopped': { segments: TranscriptionSegment[]; fullText: string };
  'transcription:error': Error;

  // Recording events
  'recording:started': void;
  'recording:stopped': void;

  // Podcast events
  'podcast:saved': Podcast;
  'podcast:loaded': Podcast[];
  'podcast:error': Error;
}

// Type-safe event bus
export class TypedEventBus extends EventBus {
  on<K extends keyof EventMap>(
    event: K,
    callback: (data: EventMap[K]) => void
  ): () => void {
    return super.on(event, callback as EventCallback);
  }

  emit<K extends keyof EventMap>(event: K, data: EventMap[K]): void {
    super.emit(event, data as any);
  }
}
