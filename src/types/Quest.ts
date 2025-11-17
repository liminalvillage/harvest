export type PublicityLevel = 'internal' | 'children' | 'network';

export interface Quest {
    title: string;
    when: string;
    ends?: string;
    status:  'ongoing' | 'completed' | 'cancelled';
    location?: string;
    participants: Array<{
        username: string;
        [key: string]: any;
    }>;
    publicity?: PublicityLevel;
    sharedWith?: string[];  // Specific holon IDs this event is shared with
    [key: string]: any;
} 