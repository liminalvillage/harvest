// PodcastManager - Handles podcast persistence to Gun DB
// Autonomous component responsible for CRUD operations

import type { TypedEventBus } from '../shared/eventBus';
import type { Podcast, PodcastMetadata, TranscriptionResult } from '../shared/types';

export class PodcastManager {
  private gun: any;
  private podcasts: Podcast[] = [];

  constructor(
    gun: any,
    private eventBus: TypedEventBus
  ) {
    this.gun = gun;
  }

  async save(
    transcript: TranscriptionResult,
    metadata: PodcastMetadata
  ): Promise<Podcast> {
    if (!this.gun) {
      throw new Error('Gun instance not available');
    }

    const podcastId = `podcast_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const date = new Date(metadata.startTime).toISOString().split('T')[0];

    // Create podcast object
    const podcast: Podcast = {
      id: podcastId,
      title: `Conversation ${date}`,
      description: `Podcast recording from video chat in room ${metadata.holonId}`,
      date,
      ...metadata,
      fullText: transcript.fullText,
      language: transcript.language,
      segmentCount: transcript.segments.length,
      segments: transcript.segments
    };

    try {
      // Save to Gun DB
      const podcastsRef = this.gun.get('podcasts');
      const podcastRef = podcastsRef.get(podcastId);

      // Save main podcast data (Gun-friendly flat structure)
      podcastRef.put({
        id: podcast.id,
        title: podcast.title,
        description: podcast.description,
        holonId: podcast.holonId,
        date: podcast.date,
        startTime: podcast.startTime,
        endTime: podcast.endTime,
        duration: podcast.duration,
        fullText: podcast.fullText,
        language: podcast.language,
        segmentCount: podcast.segmentCount
      });

      // Save participants
      const participantsRef = podcastRef.get('participants');
      podcast.participants.forEach((participant, index) => {
        participantsRef.get(`p_${index}`).put({
          id: participant.id,
          username: participant.username,
          role: participant.role
        });
      });

      // Save segments
      const segmentsRef = podcastRef.get('segments');
      transcript.segments.forEach((segment, index) => {
        segmentsRef.get(`s_${index}`).put({
          timestamp: segment.timestamp,
          text: segment.text,
          confidence: segment.confidence || 0
        });
      });

      this.eventBus.emit('podcast:saved', podcast);
      return podcast;
    } catch (error) {
      console.error('[PodcastManager] Failed to save podcast:', error);
      this.eventBus.emit('podcast:error', error as Error);
      throw error;
    }
  }

  async load(): Promise<Podcast[]> {
    if (!this.gun) {
      console.warn('[PodcastManager] Gun instance not available');
      return [];
    }

    return new Promise((resolve) => {
      this.podcasts = [];
      const podcastsRef = this.gun.get('podcasts');

      let timeout: number;

      // Listen for podcasts
      podcastsRef.map().on((podcastData: any, podcastId: string) => {
        if (!podcastData || !podcastId || podcastId === '_') return;

        // Clear previous timeout
        if (timeout) clearTimeout(timeout);

        // Create podcast object
        const podcast: Podcast = {
          ...podcastData,
          id: podcastId,
          segments: [] // Segments loaded separately if needed
        };

        // Update or add podcast
        const existingIndex = this.podcasts.findIndex(p => p.id === podcastId);
        if (existingIndex >= 0) {
          this.podcasts[existingIndex] = podcast;
        } else {
          this.podcasts.push(podcast);
        }

        // Debounce emit - wait for all podcasts to load
        timeout = window.setTimeout(() => {
          this.eventBus.emit('podcast:loaded', [...this.podcasts]);
          resolve([...this.podcasts]);
        }, 500);
      });

      // Fallback timeout
      setTimeout(() => {
        if (this.podcasts.length === 0) {
          resolve([]);
        }
      }, 3000);
    });
  }

  async loadSegments(podcastId: string): Promise<void> {
    if (!this.gun) return;

    const segmentsRef = this.gun.get('podcasts').get(podcastId).get('segments');
    const segments: any[] = [];

    return new Promise((resolve) => {
      segmentsRef.map().on((segment: any) => {
        if (segment && segment.text) {
          segments.push(segment);
        }
      });

      setTimeout(() => {
        const podcast = this.podcasts.find(p => p.id === podcastId);
        if (podcast) {
          podcast.segments = segments.sort((a, b) => a.timestamp - b.timestamp);
        }
        resolve();
      }, 1000);
    });
  }

  getPodcasts(): Podcast[] {
    return [...this.podcasts];
  }

  async delete(podcastId: string): Promise<void> {
    if (!this.gun) {
      throw new Error('Gun instance not available');
    }

    try {
      // Remove from Gun DB
      const podcastRef = this.gun.get('podcasts').get(podcastId);
      podcastRef.put(null);

      // Remove from local cache
      this.podcasts = this.podcasts.filter(p => p.id !== podcastId);
      this.eventBus.emit('podcast:loaded', [...this.podcasts]);
    } catch (error) {
      console.error('[PodcastManager] Failed to delete podcast:', error);
      this.eventBus.emit('podcast:error', error as Error);
      throw error;
    }
  }

  destroy(): void {
    this.podcasts = [];
  }
}
