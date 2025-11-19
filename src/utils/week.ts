/**
 * Week utilities for Premier events.
 * Event ID format: {season}-W{week}-{type}-{day}
 * Example: V25A1-W3-Match-Thu
 */

/** Extract numeric week from eventId string. Returns null if not parsable. */
export function extractWeek(eventId: string): number | null {
  // Expect pattern -W<digits>- after season
  const match = eventId.match(/-W(\d+)-/);
  if (!match) return null;
  const weekNum = Number(match[1]);
  return Number.isNaN(weekNum) ? null : weekNum;
}

/** Extract season string from eventId (portion before -W<week>-). */
export function extractSeason(eventId: string): string | null {
  const match = eventId.match(/^(.+?)-W\d+-/);
  return match ? match[1] : null;
}

/** Build canonical week key used for storing matches played. */
export function weekKey(season: string, week: number): string {
  return `week-${season}-W${week}-matchesPlayed`;
}

/** Parse both season and week; returns null if either missing. */
export function parseSeasonWeek(eventId: string): { season: string; week: number } | null {
  const season = extractSeason(eventId);
  const week = extractWeek(eventId);
  if (season == null || week == null) return null;
  return { season, week };
}
