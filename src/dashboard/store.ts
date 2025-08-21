import { writable } from 'svelte/store';

export const sidebarExpanded = writable(false);
export const ID = writable<string | null>(null);
export const autoTransitionEnabled = writable<boolean>(false);
export const walletAddress = writable<string | null>(null);

// Task sorting types and store
export type SortCriteria = 'created' | 'orderIndex' | 'positionX' | 'positionY';

export interface TaskSortState {
    criteria: SortCriteria;
    direction: 'asc' | 'desc';
}

// Create a shared store for task sorting preferences
export const taskSortStore = writable<TaskSortState>({
    criteria: 'created',
    direction: 'desc' // Newest first by default
});

export function openSidebar() {
	sidebarExpanded.set(true);
}

export function closeSidebar() {
	sidebarExpanded.set(false);
}

export function toggleSidebarExpanded() {
	sidebarExpanded.update(v => !v);
}

export const mapStore = writable({});

// Helper function to update sort state
export function updateTaskSort(criteria: SortCriteria, direction: 'asc' | 'desc') {
    taskSortStore.set({ criteria, direction });
}

// Helper function to apply the same sorting logic as Tasks.svelte
export function sortTasks<T extends {
    created?: string;
    orderIndex?: number;
    position?: { x: number; y: number };
}>(
    tasks: Array<[string, T]>, 
    sortState: TaskSortState
): Array<[string, T]> {
    const { criteria, direction } = sortState;
    
    return tasks.sort(([keyA, a], [keyB, b]) => {
        let valA: number, valB: number;

        switch (criteria) {
            case 'created':
                valA = a.created ? new Date(a.created).getTime() : 0;
                valB = b.created ? new Date(b.created).getTime() : 0;
                break;
            case 'positionX':
                valA = a.position?.x ?? Infinity;
                valB = b.position?.x ?? Infinity;
                break;
            case 'positionY':
                valA = a.position?.y ?? Infinity;
                valB = b.position?.y ?? Infinity;
                break;
            case 'orderIndex':
            default:
                valA = a.orderIndex ?? Infinity;
                valB = b.orderIndex ?? Infinity;
                // If orderIndex is the same, sort by key (ID) as a stable secondary sort
                if (valA === valB) {
                    return keyA.localeCompare(keyB);
                }
                break;
        }

        // General comparison for asc/desc
        if (direction === 'asc') {
            if (valA === Infinity && valB === Infinity) return 0;
            if (valA === Infinity) return 1;
            if (valB === Infinity) return -1;
            return valA - valB;
        } else { // direction === 'desc'
            if (valA === Infinity && valB === Infinity) return 0;
            if (valA === Infinity) return 1; 
            if (valB === Infinity) return -1;
            return valB - valA;
        }
    });
}
