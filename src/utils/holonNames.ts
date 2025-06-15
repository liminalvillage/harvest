import type HoloSphere from "holosphere";

// Global cache for holon names
const holonNameCache = new Map<string, string>();

// Global cache for promises to avoid duplicate requests
const fetchPromises = new Map<string, Promise<string>>();

/**
 * Fetch holon name from settings with caching
 */
export async function fetchHolonName(holosphere: HoloSphere, holonId: string): Promise<string> {
	// Return cached name if available
	if (holonNameCache.has(holonId)) {
		return holonNameCache.get(holonId)!;
	}

	// Return existing promise if already fetching
	if (fetchPromises.has(holonId)) {
		return fetchPromises.get(holonId)!;
	}

	// Create new fetch promise
	const fetchPromise = (async () => {
		try {
			const settings = await holosphere.get(holonId, "settings", holonId);
			const holonName = settings?.name || `Holon ${holonId}`;
			holonNameCache.set(holonId, holonName);
			return holonName;
		} catch (error) {
			console.error(`Error fetching holon name for ${holonId}:`, error);
			const fallbackName = `Holon ${holonId}`;
			holonNameCache.set(holonId, fallbackName);
			return fallbackName;
		} finally {
			// Remove from promises cache when done
			fetchPromises.delete(holonId);
		}
	})();

	// Cache the promise
	fetchPromises.set(holonId, fetchPromise);
	
	return fetchPromise;
}

/**
 * Get cached holon name or return fallback
 */
export function getCachedHolonName(holonId: string): string {
	return holonNameCache.get(holonId) || `Holon ${holonId}`;
}

/**
 * Extract holon ID from hologram soul path
 */
export function extractHolonIdFromSoul(hologramSoul: string | undefined): string | null {
	if (!hologramSoul) return null;
	// Extract the holon ID from path like "Holons/-1002593778587/quests/380"
	const match = hologramSoul.match(/Holons\/([^\/]+)/);
	return match ? match[1] : null;
}

/**
 * Get hologram source name with automatic fetching
 */
export async function getHologramSourceName(
	holosphere: HoloSphere, 
	hologramSoul: string | undefined,
	onUpdate?: () => void
): Promise<string> {
	const holonId = extractHolonIdFromSoul(hologramSoul);
	if (!holonId) return 'External Source';
	
	// If we have cached name, return it
	if (holonNameCache.has(holonId)) {
		return holonNameCache.get(holonId)!;
	}
	
	// Fetch name asynchronously and trigger update callback
	fetchHolonName(holosphere, holonId).then(() => {
		if (onUpdate) onUpdate();
	});
	
	return `Holon ${holonId}`; // Temporary fallback while loading
}

/**
 * Clear cache for a specific holon or all holons
 */
export function clearHolonNameCache(holonId?: string): void {
	if (holonId) {
		holonNameCache.delete(holonId);
		fetchPromises.delete(holonId);
	} else {
		holonNameCache.clear();
		fetchPromises.clear();
	}
}

/**
 * Preload holon names for multiple holons
 */
export async function preloadHolonNames(holosphere: HoloSphere, holonIds: string[]): Promise<void> {
	const promises = holonIds.map(id => fetchHolonName(holosphere, id));
	await Promise.allSettled(promises);
} 