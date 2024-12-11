export interface Quest {
    title: string;
    when: string;
    ends?: string;
    status: 'scheduled' | 'ongoing' | 'completed' | 'cancelled';
    location?: string;
    participants: Array<{
        username: string;
        [key: string]: any;
    }>;
    [key: string]: any;
} 