// Centralized localStorage management for holons

export interface PersonalHolon {
    id: string;
    name: string;
    lastVisited: number;
    isPinned: boolean;
    isPersonal: boolean;
    order: number;
    color?: string;
    description?: string;
    stats?: {
        users: number;
        tasks: number;
        offers: number;
        lastActivity: number;
    };
}

export interface VisitedHolon {
    id: string;
    name: string;
    lastVisited: number;
    visitCount: number;
    source?: 'global' | 'navigator' | 'personal' | 'federation'; // Track where the visit came from
}

export interface ClickedHolon {
    id: string;
    name: string;
    clickedAt: number;
    source: 'global' | 'navigator';
    visitCount: number;
}

// Personal Holons Management
export function savePersonalHolons(holons: PersonalHolon[]) {
    try {
        const personalHolons = holons.filter(h => h.isPersonal);
        console.log('Saving personal holons to localStorage:', personalHolons);
        localStorage.setItem('myHolons', JSON.stringify(personalHolons));
        
        // Create backup with timestamp
        const backup = {
            timestamp: Date.now(),
            data: personalHolons
        };
        localStorage.setItem('myHolons_backup', JSON.stringify(backup));
        console.log('Personal holons saved to localStorage with backup');
        return true;
    } catch (err) {
        console.warn('Failed to save personal holons:', err);
        return false;
    }
}

export function loadPersonalHolons(): PersonalHolon[] {
    try {
        const stored = localStorage.getItem('myHolons');
        console.log('Loading personal holons from localStorage:', stored);
        if (stored) {
            const parsedHolons = JSON.parse(stored);
            console.log('Parsed personal holons:', parsedHolons);
            return parsedHolons.map((holon: any, index: number) => ({
                ...holon,
                order: holon.order ?? index,
                isPersonal: true
            }));
        } else {
            // Try to restore from backup
            console.log('No main data found, checking for backup...');
            const backupData = localStorage.getItem('myHolons_backup');
            if (backupData) {
                try {
                    const backup = JSON.parse(backupData);
                    if (backup.data && Array.isArray(backup.data) && backup.data.length > 0) {
                        console.log('Restoring from backup:', backup.data);
                        const restored = backup.data.map((holon: any, index: number) => ({
                            ...holon,
                            order: holon.order ?? index,
                            isPersonal: true
                        }));
                        // Save to main storage
                        savePersonalHolons(restored);
                        return restored;
                    }
                } catch (err) {
                    console.warn('Failed to restore from backup:', err);
                }
            }
        }
    } catch (err) {
        console.warn('Failed to load personal holons from localStorage:', err);
    }
    return [];
}

// Visited Holons Management
export function saveVisitedHolons(walletAddress: string | null, visitedHolons: VisitedHolon[]) {
    try {
        const localStorageKey = walletAddress ? `visitedHolons_${walletAddress}` : 'visitedHolons_anonymous';
        localStorage.setItem(localStorageKey, JSON.stringify(visitedHolons));
        console.log('Saved visited holons to localStorage:', visitedHolons);
        return true;
    } catch (err) {
        console.warn('Failed to save visited holons to localStorage:', err);
        return false;
    }
}

export function loadVisitedHolons(walletAddress: string | null): VisitedHolon[] {
    try {
        const localStorageKey = walletAddress ? `visitedHolons_${walletAddress}` : 'visitedHolons_anonymous';
        const localData = localStorage.getItem(localStorageKey);
        if (localData) {
            const parsed = JSON.parse(localData);
            if (Array.isArray(parsed)) {
                console.log('Loaded visited holons from localStorage:', parsed);
                return parsed;
            }
        }
    } catch (err) {
        console.warn('Failed to load visited holons from localStorage:', err);
    }
    return [];
}

// Clicked Holons Management (for tracking clicks from global/navigator views)
export function saveClickedHolons(walletAddress: string | null, clickedHolons: ClickedHolon[]) {
    try {
        const localStorageKey = walletAddress ? `clickedHolons_${walletAddress}` : 'clickedHolons_anonymous';
        localStorage.setItem(localStorageKey, JSON.stringify(clickedHolons));
        console.log('Saved clicked holons to localStorage:', clickedHolons);
        return true;
    } catch (err) {
        console.warn('Failed to save clicked holons to localStorage:', err);
        return false;
    }
}

export function loadClickedHolons(walletAddress: string | null): ClickedHolon[] {
    try {
        const localStorageKey = walletAddress ? `clickedHolons_${walletAddress}` : 'clickedHolons_anonymous';
        const localData = localStorage.getItem(localStorageKey);
        if (localData) {
            const parsed = JSON.parse(localData);
            if (Array.isArray(parsed)) {
                console.log('Loaded clicked holons from localStorage:', parsed);
                return parsed;
            }
        }
    } catch (err) {
        console.warn('Failed to load clicked holons from localStorage:', err);
    }
    return [];
}

// Add clicked holon
export function addClickedHolon(walletAddress: string | null, holonId: string, holonName: string, source: 'global' | 'navigator') {
    try {
        const clickedHolons = loadClickedHolons(walletAddress);
        const now = Date.now();
        
        // Check if already in clicked list
        const existingIndex = clickedHolons.findIndex(h => h.id === holonId);
        
        if (existingIndex >= 0) {
            // Update existing entry
            clickedHolons[existingIndex] = {
                ...clickedHolons[existingIndex],
                clickedAt: now,
                visitCount: clickedHolons[existingIndex].visitCount + 1,
                source // Update source in case it changed
            };
        } else {
            // Add new entry
            clickedHolons.push({
                id: holonId,
                name: holonName,
                clickedAt: now,
                source,
                visitCount: 1
            });
        }
        
        // Save to localStorage
        saveClickedHolons(walletAddress, clickedHolons);
        console.log(`Added clicked holon: ${holonId} from ${source}`);
        return true;
    } catch (err) {
        console.warn('Failed to add clicked holon:', err);
        return false;
    }
}

// Add visited holon (enhanced version)
export function addVisitedHolon(walletAddress: string | null, holonId: string, holonName: string, source: 'global' | 'navigator' | 'personal' | 'federation' = 'personal') {
    try {
        const visitedHolons = loadVisitedHolons(walletAddress);
        const now = Date.now();
        
        // Check if already in visited list
        const existingIndex = visitedHolons.findIndex(h => h.id === holonId);
        
        if (existingIndex >= 0) {
            // Update existing entry
            visitedHolons[existingIndex] = {
                ...visitedHolons[existingIndex],
                lastVisited: now,
                visitCount: visitedHolons[existingIndex].visitCount + 1,
                source // Update source in case it changed
            };
        } else {
            // Add new entry
            visitedHolons.push({
                id: holonId,
                name: holonName,
                lastVisited: now,
                visitCount: 1,
                source
            });
        }
        
        // Save to localStorage
        saveVisitedHolons(walletAddress, visitedHolons);
        console.log(`Added visited holon: ${holonId} from ${source}`);
        return true;
    } catch (err) {
        console.warn('Failed to add visited holon:', err);
        return false;
    }
}

// Get wallet address from various sources
export function getWalletAddress(): string | null {
    if (typeof window === 'undefined') return null;
    
    // Try different sources for wallet address
    const walletAddr = (window as any).walletAddress || 
                      (window as any).ethereum?.selectedAddress ||
                      localStorage.getItem('walletAddress');
    
    return walletAddr || null;
}

// Utility function to merge and deduplicate holons from different sources
export function mergeHolonLists(personalHolons: PersonalHolon[], visitedHolons: VisitedHolon[], clickedHolons: ClickedHolon[]): PersonalHolon[] {
    const merged = new Map<string, PersonalHolon>();
    
    // Add personal holons first (they have priority)
    personalHolons.forEach(holon => {
        merged.set(holon.id, holon);
    });
    
    // Add visited holons that aren't already personal
    visitedHolons.forEach(visited => {
        if (!merged.has(visited.id)) {
            merged.set(visited.id, {
                id: visited.id,
                name: visited.name,
                lastVisited: visited.lastVisited,
                isPinned: false,
                isPersonal: false, // These are not personal holons
                order: merged.size,
                color: '#10B981' // Green for visited holons
            });
        }
    });
    
    // Add clicked holons that aren't already in the list
    clickedHolons.forEach(clicked => {
        if (!merged.has(clicked.id)) {
            merged.set(clicked.id, {
                id: clicked.id,
                name: clicked.name,
                lastVisited: clicked.clickedAt,
                isPinned: false,
                isPersonal: false, // These are not personal holons
                order: merged.size,
                color: '#F59E0B' // Amber for clicked holons
            });
        }
    });
    
    return Array.from(merged.values()).sort((a, b) => a.order - b.order);
} 