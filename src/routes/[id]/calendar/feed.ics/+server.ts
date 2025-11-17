// iCal Feed Server Endpoint
// Serves the holon's calendar as an iCal feed for external subscription

import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { generateICalFeed } from '$lib/services/icalGenerator';
import HoloSphere from 'holosphere';
import { VITE_LOCAL_MODE } from '$env/static/private';
import type { PublicityLevel } from '$lib/../types/Quest';

// Initialize HoloSphere instance for server-side data access
// Use the same logic as the client to determine environment
const environmentName = VITE_LOCAL_MODE === "development" ? "HolonsDebug" : "Holons";
const holosphere = new HoloSphere(environmentName);

export const GET: RequestHandler = async ({ params, url }) => {
    const holonId = params.id;
    const subscriberId = url.searchParams.get('subscriber');

    if (!holonId) {
        throw error(400, 'Holon ID is required');
    }

    try {
        // Fetch holon data to get the name
        const holonData = await holosphere.get(holonId, 'profile', holonId);
        const holonName = holonData?.name || holonData?.title || 'Holon Calendar';

        // Fetch calendar publicity settings
        const settingsData = await holosphere.get(holonId, 'settings', 'calendar_publicity');
        const calendarPublicity = settingsData || {
            defaultPublicity: 'internal',
            parentSubscriptions: [],
            childHolons: [],
            globalPublic: false
        };

        // Fetch all quests/events from the holon using subscribe
        // We use subscribe instead of getAll because Gun's data is async/real-time
        const questsData = await new Promise((resolve) => {
            const questsMap = new Map();

            // Subscribe temporarily to get all data
            holosphere.subscribe(holonId, 'quests', (quest: any, key?: string) => {
                if (quest && key && quest.when) {
                    // Use Map to avoid duplicates from Gun's callback firing multiple times
                    questsMap.set(key, { ...quest, id: key });
                }
            });

            // Give Gun time to sync data, then resolve
            setTimeout(() => {
                resolve(Array.from(questsMap.values()));
            }, 1000);
        });

        let scheduledEvents = Array.isArray(questsData) ? questsData : [];

        // Filter events based on publicity level and subscriber
        scheduledEvents = scheduledEvents.filter((event: any) => {
            const publicity: PublicityLevel = event.publicity || 'internal';

            // If no subscriber is specified, only return public network events
            if (!subscriberId) {
                return publicity === 'network' || calendarPublicity.globalPublic;
            }

            // If subscriber is the holon itself, show all events
            if (subscriberId === holonId) {
                return true;
            }

            // Network publicity - visible to everyone
            if (publicity === 'network' || calendarPublicity.globalPublic) {
                return true;
            }

            // Children publicity - visible to child holons
            if (publicity === 'children') {
                // Check if subscriber is in the child holons list
                if (calendarPublicity.childHolons?.includes(subscriberId)) {
                    return true;
                }

                // Also check sharedWith array if it exists
                if (event.sharedWith?.includes(subscriberId)) {
                    return true;
                }
            }

            // Internal - not visible to external subscribers
            return false;
        });

        // Generate the iCal feed
        const icalContent = generateICalFeed(scheduledEvents, holonName, holonId);

        // Return the iCal feed with proper headers
        return new Response(icalContent, {
            headers: {
                'Content-Type': 'text/calendar; charset=utf-8',
                'Content-Disposition': `attachment; filename="${holonName.replace(/[^a-z0-9]/gi, '_')}.ics"`,
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            }
        });
    } catch (err) {
        console.error('Error generating iCal feed:', err);
        throw error(500, 'Failed to generate calendar feed');
    }
};
