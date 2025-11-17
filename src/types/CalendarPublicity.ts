import type { PublicityLevel } from './Quest';

/**
 * Calendar subscription from a parent holon
 */
export interface CalendarSubscription {
    holonId: string;
    holonName: string;
    subscribed: boolean;
    color?: string;
    lastSync?: string;
}

/**
 * Holon relationship for calendar sharing
 */
export interface HolonRelationship {
    holonId: string;
    holonName: string;
    type: 'parent' | 'child';
    canSubscribe?: boolean;  // For parent relationships
    subscribed?: boolean;    // For parent relationships
}

/**
 * Calendar publicity settings for a holon
 */
export interface CalendarPublicitySettings {
    id: string;

    // Default publicity level for new events
    defaultPublicity: PublicityLevel;

    // Parent holons this holon subscribes to
    parentSubscriptions: CalendarSubscription[];

    // Child holons that can access this holon's calendar
    childHolons: string[];

    // Global publicity flag
    globalPublic: boolean;

    // Timestamp
    updated: string;
}

/**
 * Extended holon settings with calendar publicity
 */
export interface HolonSettingsWithCalendar {
    calendarPublicity?: CalendarPublicitySettings;
}
