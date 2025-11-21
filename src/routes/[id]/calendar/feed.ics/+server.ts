// iCal Feed Server Endpoint
// Serves the holon's calendar as an iCal feed for external subscription

import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { generateICalFeed } from '$lib/services/icalGenerator';
import HoloSphere from 'holosphere';
import { VITE_LOCAL_MODE } from '$env/static/private';

// Singleton HoloSphere instance for server-side data access
// Initialize once and reuse across requests
let holosphere: HoloSphere | null = null;

function getHoloSphere(): HoloSphere {
    if (!holosphere) {
        // Use the same logic as the client to determine environment
        // If VITE_LOCAL_MODE is not set in .env, default to "Holons" (production)
        const environmentName = VITE_LOCAL_MODE === "development" ? "HolonsDebug" : "Holons";
        holosphere = new HoloSphere(environmentName);
    }
    return holosphere;
}

export const GET: RequestHandler = async ({ params }) => {
    const holonId = params.id;

    if (!holonId) {
        throw error(400, 'Holon ID is required');
    }

    try {
        // Get the singleton HoloSphere instance
        const holosphere = getHoloSphere();

        // Fetch holon data to get the name
        const holonData = await holosphere.get(holonId, 'profile', holonId);
        const holonName = holonData?.name || holonData?.title || 'Holon Calendar';

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

        const scheduledEvents = Array.isArray(questsData) ? questsData : [];

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
