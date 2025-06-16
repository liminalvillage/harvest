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
			console.log(`[holonNames] Fetching name for holon: ${holonId}`);
			const settings = await holosphere.get(holonId, "settings", holonId);
			console.log(`[holonNames] Settings response for ${holonId}:`, settings);
			
			const holonName = settings?.name || `Holon ${holonId}`;
			console.log(`[holonNames] Resolved name for ${holonId}: ${holonName}`);
			
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
 * Get hologram source name with automatic fetching - SYNCHRONOUS VERSION
 * This function immediately returns cached name or fallback, and triggers async fetch if needed
 */
export function getHologramSourceName(
	holosphere: HoloSphere, 
	hologramSoul: string | undefined,
	onUpdate?: () => void
): string {
	const holonId = extractHolonIdFromSoul(hologramSoul);
	if (!holonId) return 'External Source';
	
	// If we have cached name, return it immediately
	if (holonNameCache.has(holonId)) {
		const cachedName = holonNameCache.get(holonId)!;
		console.log(`[holonNames] Using cached name for ${holonId}: ${cachedName}`);
		return cachedName;
	}
	
	// If we don't have the name cached, start fetching it
	console.log(`[holonNames] Name not cached for ${holonId}, starting fetch...`);
	fetchHolonName(holosphere, holonId).then((fetchedName) => {
		console.log(`[holonNames] Fetched name for ${holonId}: ${fetchedName}, triggering update`);
		if (onUpdate) {
			onUpdate();
		}
	}).catch((error) => {
		console.error(`[holonNames] Error in fetch promise for ${holonId}:`, error);
		if (onUpdate) {
			onUpdate(); // Still trigger update even on error
		}
	});
	
	return `Holon ${holonId}`; // Temporary fallback while loading
}

/**
 * Get hologram source name with automatic fetching - ASYNC VERSION
 * This function waits for the name to be fetched and returns the actual name
 */
export async function getHologramSourceNameAsync(
	holosphere: HoloSphere, 
	hologramSoul: string | undefined
): Promise<string> {
	const holonId = extractHolonIdFromSoul(hologramSoul);
	if (!holonId) return 'External Source';
	
	// Fetch and return the actual name
	return await fetchHolonName(holosphere, holonId);
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