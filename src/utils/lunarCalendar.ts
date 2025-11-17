/**
 * Lunar Calendar Utilities for Regenerativa
 * Based on astronomical calculations of moon phases
 */

export type LunarPhase = 'new' | 'waxing_crescent' | 'first_quarter' | 'waxing_gibbous' | 'full' | 'waning_gibbous' | 'last_quarter' | 'waning_crescent';

export interface LunarInfo {
  phase: LunarPhase;
  phaseName: string;
  illumination: number; // 0 to 1
  daysSinceNew: number;
  daysUntilNew: number;
  daysUntilFull: number;
  emoji: string;
  isHalfMoon: boolean; // True during first/last quarter (exchange time!)
  currentCycleName: string; // e.g., "New Moon January 2025"
}

const LUNAR_MONTH = 29.53058867; // Average lunar month in days

/**
 * Calculate current lunar phase based on date
 * Uses a known new moon reference and calculates from there
 */
export function getCurrentLunarInfo(date: Date = new Date()): LunarInfo {
  // Known new moon: January 11, 2024 at 11:57 UTC
  const knownNewMoon = new Date('2024-01-11T11:57:00Z');
  const now = date.getTime();
  const knownNewMoonTime = knownNewMoon.getTime();

  // Calculate days since known new moon
  const daysSinceKnownNew = (now - knownNewMoonTime) / (1000 * 60 * 60 * 24);

  // Calculate current position in lunar cycle (0 to LUNAR_MONTH)
  const daysSinceNew = daysSinceKnownNew % LUNAR_MONTH;

  // Calculate illumination (0 = new moon, 0.5 = half, 1 = full)
  const illumination = (1 - Math.cos((daysSinceNew / LUNAR_MONTH) * 2 * Math.PI)) / 2;

  // Determine phase
  let phase: LunarPhase;
  let phaseName: string;
  let emoji: string;
  let isHalfMoon = false;

  if (daysSinceNew < 1.84566) {
    phase = 'new';
    phaseName = 'New Moon';
    emoji = '🌑';
  } else if (daysSinceNew < 7.38264) {
    phase = 'waxing_crescent';
    phaseName = 'Waxing Crescent';
    emoji = '🌒';
  } else if (daysSinceNew < 9.22830) {
    phase = 'first_quarter';
    phaseName = 'First Quarter';
    emoji = '🌓';
    isHalfMoon = true;
  } else if (daysSinceNew < 14.76529) {
    phase = 'waxing_gibbous';
    phaseName = 'Waxing Gibbous';
    emoji = '🌔';
  } else if (daysSinceNew < 16.61095) {
    phase = 'full';
    phaseName = 'Full Moon';
    emoji = '🌕';
  } else if (daysSinceNew < 22.14794) {
    phase = 'waning_gibbous';
    phaseName = 'Waning Gibbous';
    emoji = '🌖';
  } else if (daysSinceNew < 23.99360) {
    phase = 'last_quarter';
    phaseName = 'Last Quarter';
    emoji = '🌗';
    isHalfMoon = true;
  } else {
    phase = 'waning_crescent';
    phaseName = 'Waning Crescent';
    emoji = '🌘';
  }

  // Calculate days until next new and full moon
  const daysUntilNew = LUNAR_MONTH - daysSinceNew;
  const daysUntilFull = daysSinceNew < LUNAR_MONTH / 2
    ? (LUNAR_MONTH / 2) - daysSinceNew
    : (LUNAR_MONTH * 1.5) - daysSinceNew;

  // Generate cycle name
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                     'July', 'August', 'September', 'October', 'November', 'December'];
  const currentCycleName = `${phaseName} ${monthNames[date.getMonth()]} ${date.getFullYear()}`;

  return {
    phase,
    phaseName,
    illumination,
    daysSinceNew,
    daysUntilNew,
    daysUntilFull,
    emoji,
    isHalfMoon,
    currentCycleName
  };
}

/**
 * Get the date of the next occurrence of a specific phase
 */
export function getNextPhaseDate(targetPhase: LunarPhase, fromDate: Date = new Date()): Date {
  const current = getCurrentLunarInfo(fromDate);
  const phaseDays: Record<LunarPhase, number> = {
    'new': 0,
    'waxing_crescent': 3.69,
    'first_quarter': 7.38,
    'waxing_gibbous': 11.07,
    'full': 14.76,
    'waning_gibbous': 18.45,
    'last_quarter': 22.15,
    'waning_crescent': 25.84
  };

  const targetDay = phaseDays[targetPhase];
  const currentDay = current.daysSinceNew;

  let daysToAdd: number;
  if (targetDay > currentDay) {
    daysToAdd = targetDay - currentDay;
  } else {
    daysToAdd = (LUNAR_MONTH - currentDay) + targetDay;
  }

  const nextDate = new Date(fromDate);
  nextDate.setDate(nextDate.getDate() + daysToAdd);
  return nextDate;
}

/**
 * Get upcoming seasonal gathering dates
 */
export function getSeasonalGatherings(year: number = new Date().getFullYear()): {
  spring_equinox: Date;
  summer_solstice: Date;
  fall_equinox: Date;
  winter_solstice: Date;
} {
  // Approximate dates (vary slightly year to year)
  return {
    spring_equinox: new Date(year, 2, 20), // March 20
    summer_solstice: new Date(year, 5, 21), // June 21
    fall_equinox: new Date(year, 8, 22), // September 22
    winter_solstice: new Date(year, 11, 21) // December 21
  };
}

/**
 * Determine if a date is during a half-moon phase (exchange time!)
 */
export function isExchangeTime(date: Date = new Date()): boolean {
  return getCurrentLunarInfo(date).isHalfMoon;
}

/**
 * Get a visual progress bar for the lunar cycle
 */
export function getLunarProgressBar(lunarInfo: LunarInfo): string {
  const totalBlocks = 28;
  const filledBlocks = Math.round((lunarInfo.daysSinceNew / LUNAR_MONTH) * totalBlocks);
  return '█'.repeat(filledBlocks) + '░'.repeat(totalBlocks - filledBlocks);
}

/**
 * Get color for lunar phase (for UI visualization)
 */
export function getLunarPhaseColor(lunarInfo: LunarInfo): string {
  const colors: Record<LunarPhase, string> = {
    'new': '#1a1a2e',
    'waxing_crescent': '#2d3561',
    'first_quarter': '#4a5899',
    'waxing_gibbous': '#6b7fc7',
    'full': '#8ba3e3',
    'waning_gibbous': '#6b7fc7',
    'last_quarter': '#4a5899',
    'waning_crescent': '#2d3561'
  };
  return colors[lunarInfo.phase];
}
