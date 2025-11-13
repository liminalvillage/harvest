// iCal Feed Parser Service
// Fetches and parses external iCal/webcal feeds for calendar integration

import ICAL from 'ical.js';

export interface ExternalCalendarEvent {
    id: string;
    title: string;
    description?: string;
    location?: string;
    start: Date;
    end: Date;
    allDay: boolean;
    recurrence?: string;
    calendarUrl: string;
    calendarName?: string;
}

export interface ParsedCalendar {
    name: string;
    events: ExternalCalendarEvent[];
    lastSync: Date;
}

/**
 * Fetches and parses an iCal feed from a URL
 * @param url - The iCal/webcal feed URL
 * @param calendarName - Optional name for the calendar
 * @returns Parsed calendar with events
 */
export async function fetchAndParseICalFeed(
    url: string,
    calendarName?: string
): Promise<ParsedCalendar> {
    try {
        // Convert webcal:// to https://
        const fetchUrl = url.replace(/^webcal:\/\//i, 'https://');

        // Use a CORS proxy for external calendar feeds
        // This is needed because most calendar services block direct browser requests
        const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(fetchUrl)}`;

        // Fetch the iCal feed
        const response = await fetch(proxyUrl, {
            headers: {
                'Accept': 'text/calendar, text/plain, */*'
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch calendar: ${response.status} ${response.statusText}`);
        }

        const icalText = await response.text();

        // Parse the iCal data
        return parseICalText(icalText, url, calendarName);
    } catch (error) {
        console.error('Error fetching iCal feed:', error);
        throw error;
    }
}

/**
 * Parses iCal text data into structured calendar events
 * @param icalText - Raw iCal text data
 * @param calendarUrl - The source URL for reference
 * @param calendarName - Optional calendar name
 * @returns Parsed calendar with events
 */
export function parseICalText(
    icalText: string,
    calendarUrl: string,
    calendarName?: string
): ParsedCalendar {
    try {
        // Validate that it looks like iCal data
        if (!icalText.includes('BEGIN:VCALENDAR')) {
            throw new Error('Invalid iCal format: missing VCALENDAR');
        }

        const jcalData = ICAL.parse(icalText);
        const comp = new ICAL.Component(jcalData);

        // Verify it's a calendar component
        if (comp.name !== 'vcalendar') {
            throw new Error('Invalid iCal format: not a VCALENDAR component');
        }

        // Get calendar name from X-WR-CALNAME or use provided name
        const calNameProp = comp.getFirstPropertyValue('x-wr-calname');
        const calName = calendarName ||
            (typeof calNameProp === 'string' ? calNameProp : null) ||
            'Imported Calendar';

        const events: ExternalCalendarEvent[] = [];
        const vevents = comp.getAllSubcomponents('vevent');

        console.log(`Found ${vevents.length} events in calendar`);

        vevents.forEach((vevent, index) => {
            try {
                const event = new ICAL.Event(vevent);

                // Get event properties
                const uid = event.uid;
                const summary = event.summary || 'Untitled Event';
                const description = event.description || '';
                const location = event.location || '';

                // Get start and end times
                const startDate = event.startDate.toJSDate();
                const endDate = event.endDate.toJSDate();

                // Check if it's an all-day event
                const allDay = !event.startDate.isDate ? false : true;

                // Get recurrence rule if exists
                const rrule = vevent.getFirstPropertyValue('rrule');
                const recurrence = rrule ? rrule.toString() : undefined;

                // Check event status and transparency (for debugging)
                const status = vevent.getFirstPropertyValue('status');
                const transp = vevent.getFirstPropertyValue('transp');

                // Log event details for debugging
                if (index < 3) { // Log first 3 events as sample
                    console.log(`Event ${index + 1}:`, {
                        title: summary,
                        start: startDate,
                        status,
                        transp,
                        uid: uid.substring(0, 20) + '...'
                    });
                }

                events.push({
                    id: uid,
                    title: summary,
                    description,
                    location,
                    start: startDate,
                    end: endDate,
                    allDay,
                    recurrence,
                    calendarUrl,
                    calendarName: calName
                });
            } catch (error) {
                console.error('Error parsing event:', error);
                // Skip malformed events
            }
        });

        return {
            name: calName,
            events,
            lastSync: new Date()
        };
    } catch (error) {
        console.error('Error parsing iCal text:', error);
        throw error;
    }
}

/**
 * Filters events within a date range
 * @param events - Array of calendar events
 * @param startDate - Range start date
 * @param endDate - Range end date
 * @returns Filtered events
 */
export function filterEventsByDateRange(
    events: ExternalCalendarEvent[],
    startDate: Date,
    endDate: Date
): ExternalCalendarEvent[] {
    return events.filter(event => {
        const eventStart = new Date(event.start);
        const eventEnd = new Date(event.end);

        // Include event if it overlaps with the date range
        return eventStart <= endDate && eventEnd >= startDate;
    });
}

/**
 * Validates an iCal URL
 * @param url - URL to validate
 * @returns true if valid
 */
export function isValidICalUrl(url: string): boolean {
    try {
        const urlObj = new URL(url);
        const protocol = urlObj.protocol.toLowerCase();
        return protocol === 'http:' || protocol === 'https:' || protocol === 'webcal:';
    } catch {
        return false;
    }
}
