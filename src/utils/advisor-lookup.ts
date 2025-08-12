import { getAdvisor, ADVISOR_LIBRARY, getAdvisorsFromHoloSphere } from '../data/advisor-library';
import type { CouncilAdvisorExtended } from '../types/advisor-schema';

// Cache for HoloSphere advisors to avoid repeated async calls
let holosphereAdvisorsCache: CouncilAdvisorExtended[] = [];
let holosphereCacheTimestamp = 0;
const CACHE_DURATION = 30000; // 30 seconds

/**
 * Pre-load HoloSphere advisors for synchronous lookup
 */
export async function preloadHoloSphereAdvisors(holosphere: any, holonID: string): Promise<void> {
  if (!holosphere || !holonID) return;
  
  const now = Date.now();
  if (now - holosphereCacheTimestamp < CACHE_DURATION) {
    return; // Cache is still valid
  }
  
  try {
    holosphereAdvisorsCache = await getAdvisorsFromHoloSphere(holosphere, holonID);
    holosphereCacheTimestamp = now;
    console.log('Pre-loaded HoloSphere advisors:', holosphereAdvisorsCache.length);
  } catch (error) {
    console.error('Error pre-loading HoloSphere advisors:', error);
    holosphereAdvisorsCache = [];
  }
}

/**
 * Enhanced advisor lookup with multiple fallback strategies
 * Follows holonic principles: single source of truth for advisor resolution
 */
export function resolveAdvisor(advisorName: string, advisorLens?: string): CouncilAdvisorExtended | null {
  let fullAdvisor: CouncilAdvisorExtended | null = null;
  
  // Strategy 1: Try exact name match first in static library
  const exactKey = advisorName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  fullAdvisor = getAdvisor(exactKey);
  
  // Strategy 2: If not found, try extracting the first word (for names like "Omnia, Emissary of Eudaemonia")
  if (!fullAdvisor) {
    const firstWord = advisorName.split(/[,\s]/)[0].toLowerCase();
    fullAdvisor = getAdvisor(firstWord);
  }
  
  // Strategy 3: Try searching through all static advisors for a name match
  if (!fullAdvisor) {
    const allStaticAdvisors = Object.values(ADVISOR_LIBRARY) as CouncilAdvisorExtended[];
    fullAdvisor = allStaticAdvisors.find(a => 
      a.name.toLowerCase().includes(advisorName.toLowerCase()) ||
      advisorName.toLowerCase().includes(a.name.toLowerCase())
    ) || null;
  }
  
  // Strategy 4: Try matching by lens in static advisors if name doesn't work
  if (!fullAdvisor && advisorLens) {
    const allStaticAdvisors = Object.values(ADVISOR_LIBRARY) as CouncilAdvisorExtended[];
    fullAdvisor = allStaticAdvisors.find(a => 
      a.lens.toLowerCase().includes(advisorLens.toLowerCase()) ||
      advisorLens.toLowerCase().includes(a.lens.toLowerCase())
    ) || null;
  }
  
  // Strategy 5: Check pre-loaded HoloSphere advisors
  if (!fullAdvisor) {
    // Try exact name match in HoloSphere
    fullAdvisor = holosphereAdvisorsCache.find(a => 
      a.name.toLowerCase() === advisorName.toLowerCase()
    ) || null;
    
    // Try partial name match in HoloSphere
    if (!fullAdvisor) {
      fullAdvisor = holosphereAdvisorsCache.find(a => 
        a.name.toLowerCase().includes(advisorName.toLowerCase()) ||
        advisorName.toLowerCase().includes(a.name.toLowerCase())
      ) || null;
    }
    
    // Try lens match in HoloSphere
    if (!fullAdvisor && advisorLens) {
      fullAdvisor = holosphereAdvisorsCache.find(a => 
        a.lens.toLowerCase().includes(advisorLens.toLowerCase()) ||
        advisorLens.toLowerCase().includes(a.lens.toLowerCase())
      ) || null;
    }
  }
  
  if (fullAdvisor) {
    console.log(`✅ Found full advisor for "${advisorName}":`, fullAdvisor.name);
  } else {
    console.warn(`❌ No full advisor found for "${advisorName}", will use fallback`);
  }
  
  return fullAdvisor;
}

/**
 * Resolve multiple advisors from ritual session data
 * Used in Glass Bead Game and other multi-advisor contexts
 */
export function resolveAdvisorsFromRitual(ritualAdvisors: Array<{
  name: string;
  type: 'real' | 'mythic' | 'archetype';
  lens: string;
}>): CouncilAdvisorExtended[] {
  const resolvedAdvisors: CouncilAdvisorExtended[] = [];
  
  for (const advisor of ritualAdvisors) {
    const fullAdvisor = resolveAdvisor(advisor.name, advisor.lens);
    
    if (fullAdvisor) {
      resolvedAdvisors.push(fullAdvisor);
    } else {
      // Error: Advisor not found - alert user instead of creating fallback
      console.error(`❌ Advisor lookup failed for "${advisor.name}" with lens "${advisor.lens}"`);
      alert(`Error: Could not find advisor "${advisor.name}" in the advisor library. Please check the advisor name and try again, or create the advisor first.`);
      throw new Error(`Advisor lookup failed for "${advisor.name}"`);
    }
  }
  
  return resolvedAdvisors;
} 