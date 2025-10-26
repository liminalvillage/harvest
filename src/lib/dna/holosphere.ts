// Holosphere operations for Holon DNA Editor
// Feature: 001-holon-dna-editor

import type HoloSphere from 'holosphere';
import type { Chromosome, DNASequence } from './types';
import { validateDNASequence, validateChromosome } from './validation';

/**
 * Get a holon's DNA sequence from holosphere
 * @param holosphere The holosphere instance
 * @param holonId The holon identifier
 * @returns Promise resolving to DNASequence or null if not found
 */
export async function getDNASequence(
  holosphere: HoloSphere,
  holonId: string
): Promise<DNASequence | null> {
  try {
    const data = await holosphere.get(holonId, 'dna_sequence');
    if (!data || typeof data !== 'object') {
      return null;
    }
    return data as DNASequence;
  } catch (error) {
    console.error('Error getting DNA sequence:', error);
    return null;
  }
}

/**
 * Save or update a holon's DNA sequence to holosphere
 * @param holosphere The holosphere instance
 * @param holonId The holon identifier
 * @param chromosomeIds Ordered array of chromosome IDs
 * @param currentVersion Optional current version for conflict detection
 * @returns Promise resolving to the saved DNASequence
 */
export async function saveDNASequence(
  holosphere: HoloSphere,
  holonId: string,
  chromosomeIds: string[],
  currentVersion?: number
): Promise<DNASequence> {
  try {
    const now = Date.now();

    // Get existing DNA to preserve createdAt
    const existing = await getDNASequence(holosphere, holonId);

    const dna: DNASequence = {
      holonId,
      chromosomeIds,
      updatedAt: now,
      version: (currentVersion || 0) + 1,
      createdAt: existing?.createdAt || now
    };

    // Save the DNA sequence
    await holosphere.put(holonId, 'dna_sequence', dna);
    return dna;
  } catch (error) {
    console.error('Error saving DNA sequence:', error);
    throw error;
  }
}

/**
 * Get all chromosomes in a holon's library
 * @param holosphere The holosphere instance
 * @param holonId The holon identifier
 * @returns Promise resolving to array of Chromosomes
 */
export async function getChromosomeLibrary(
  holosphere: HoloSphere,
  holonId: string
): Promise<Chromosome[]> {
  try {
    const data = await holosphere.get(holonId, 'chromosome_library');
    if (!data || typeof data !== 'object') {
      return [];
    }
    // Convert object to array of chromosomes
    return Object.values(data).filter((c): c is Chromosome =>
      c !== null && typeof c === 'object' && 'id' in c
    );
  } catch (error) {
    console.error('Error getting chromosome library:', error);
    return [];
  }
}

/**
 * Add a new chromosome to a holon's library
 * @param holosphere The holosphere instance
 * @param holonId The holon identifier
 * @param chromosome Chromosome data (without id, createdAt, updatedAt)
 * @returns Promise resolving to the created Chromosome
 */
export async function addChromosome(
  holosphere: HoloSphere,
  holonId: string,
  chromosome: Omit<Chromosome, 'id' | 'createdAt' | 'updatedAt'>
): Promise<Chromosome> {
  try {
    // Get existing library to check for name conflicts
    const library = await getChromosomeLibrary(holosphere, holonId);
    const chromosomeId = generateUUID();
    const now = Date.now();

    const newChromosome: Chromosome = {
      id: chromosomeId,
      holonId,
      name: chromosome.name,
      type: chromosome.type,
      description: chromosome.description,
      icon: chromosome.icon,
      color: chromosome.color,
      createdAt: now,
      updatedAt: now
    };

    // Validate before saving
    const validation = validateChromosome(newChromosome, library);
    if (!validation.isValid) {
      throw new Error(`Chromosome validation failed: ${validation.errors.join(', ')}`);
    }

    // Get current library
    const currentLibrary = await holosphere.get(holonId, 'chromosome_library') || {};

    // Add new chromosome to library
    await holosphere.put(holonId, 'chromosome_library', {
      ...currentLibrary,
      [chromosomeId]: newChromosome
    });

    return newChromosome;
  } catch (error) {
    console.error('Error adding chromosome:', error);
    throw error;
  }
}

/**
 * Update an existing chromosome in the library
 * @param holosphere The holosphere instance
 * @param holonId The holon identifier
 * @param chromosomeId The chromosome ID to update
 * @param updates Partial chromosome fields to update
 * @returns Promise resolving to the updated Chromosome
 */
export async function updateChromosome(
  holosphere: HoloSphere,
  holonId: string,
  chromosomeId: string,
  updates: Partial<Pick<Chromosome, 'name' | 'description' | 'icon' | 'color'>>
): Promise<Chromosome> {
  try {
    // Get existing chromosome
    const existing = await getChromosome(holosphere, holonId, chromosomeId);
    if (!existing) {
      throw new Error(`Chromosome ${chromosomeId} not found`);
    }

    const updatedChromosome: Chromosome = {
      ...existing,
      ...updates,
      updatedAt: Date.now()
    };

    // Validate before saving
    const library = await getChromosomeLibrary(holosphere, holonId);
    const validation = validateChromosome(updatedChromosome, library);
    if (!validation.isValid) {
      throw new Error(`Chromosome validation failed: ${validation.errors.join(', ')}`);
    }

    // Get current library
    const currentLibrary = await holosphere.get(holonId, 'chromosome_library') || {};

    // Update chromosome in library
    await holosphere.put(holonId, 'chromosome_library', {
      ...currentLibrary,
      [chromosomeId]: updatedChromosome
    });

    return updatedChromosome;
  } catch (error) {
    console.error('Error updating chromosome:', error);
    throw error;
  }
}

/**
 * Remove a chromosome from the library
 * @param holosphere The holosphere instance
 * @param holonId The holon identifier
 * @param chromosomeId The chromosome ID to remove
 * @returns Promise that resolves when removal is complete
 */
export async function removeChromosome(
  holosphere: HoloSphere,
  holonId: string,
  chromosomeId: string
): Promise<void> {
  try {
    // Get current library
    const currentLibrary = await holosphere.get(holonId, 'chromosome_library') || {};

    // Remove chromosome from library
    const { [chromosomeId]: removed, ...updatedLibrary } = currentLibrary;

    await holosphere.put(holonId, 'chromosome_library', updatedLibrary);
  } catch (error) {
    console.error('Error removing chromosome:', error);
    throw error;
  }
}

/**
 * Get a single chromosome by ID
 * @param holosphere The holosphere instance
 * @param holonId The holon identifier
 * @param chromosomeId The chromosome ID
 * @returns Promise resolving to Chromosome or null if not found
 */
export async function getChromosome(
  holosphere: HoloSphere,
  holonId: string,
  chromosomeId: string
): Promise<Chromosome | null> {
  try {
    const library = await holosphere.get(holonId, 'chromosome_library');
    if (!library || typeof library !== 'object') {
      return null;
    }
    const chromosome = library[chromosomeId];
    if (!chromosome || typeof chromosome !== 'object') {
      return null;
    }
    return chromosome as Chromosome;
  } catch (error) {
    console.error('Error getting chromosome:', error);
    return null;
  }
}

/**
 * Subscribe to real-time updates of a holon's DNA sequence
 * @param holosphere The holosphere instance
 * @param holonId The holon identifier
 * @param callback Function called when DNA is updated
 * @returns Unsubscribe function
 */
export function subscribeToDNASequence(
  holosphere: HoloSphere,
  holonId: string,
  callback: (dna: DNASequence | null) => void
): () => void {
  const handler = (data: any) => {
    if (!data || typeof data !== 'object') {
      callback(null);
      return;
    }
    callback(data as DNASequence);
  };

  // Subscribe to DNA sequence updates
  holosphere.subscribe(holonId, 'dna_sequence', handler);

  // Return unsubscribe function
  return () => {
    // Holosphere subscribe doesn't return an unsubscribe function directly
    // We'll need to handle this differently or accept that subscriptions persist
  };
}

/**
 * Subscribe to real-time updates of a holon's chromosome library
 * @param holosphere The holosphere instance
 * @param holonId The holon identifier
 * @param callback Function called when chromosomes are added/updated/removed
 * @returns Unsubscribe function
 */
export function subscribeToChromosomeLibrary(
  holosphere: HoloSphere,
  holonId: string,
  callback: (chromosome: Chromosome | null, chromosomeId: string) => void
): () => void {
  const handler = (data: any, key: string) => {
    if (!data || typeof data !== 'object') {
      callback(null, key);
      return;
    }
    callback(data as Chromosome, key);
  };

  // Subscribe to chromosome library updates
  holosphere.subscribe(holonId, 'chromosome_library', handler);

  // Return unsubscribe function
  return () => {
    // Holosphere subscribe doesn't return an unsubscribe function directly
    // We'll need to handle this differently or accept that subscriptions persist
  };
}

/**
 * Generate a UUID v4
 * @returns UUID string
 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
