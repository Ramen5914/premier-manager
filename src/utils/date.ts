/**
 * Get the ordinal suffix for a date (1st, 2nd, 3rd, 4th, etc.)
 */
export function getOrdinalSuffix(day: number): string {
  if (day > 3 && day < 21) return 'th';
  switch (day % 10) {
    case 1:
      return 'st';
    case 2:
      return 'nd';
    case 3:
      return 'rd';
    default:
      return 'th';
  }
}

/**
 * Format a date for event titles: "Saturday, November 1st"
 * Converts the date to PST timezone before formatting to ensure correct day/month/date
 */
export function formatEventDate(date: Date): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];

  // Convert to PST timezone to get correct date components
  const pstDateString = date.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' });
  const pstDate = new Date(pstDateString);

  const dayName = days[pstDate.getDay()];
  const monthName = months[pstDate.getMonth()];
  const day = pstDate.getDate();
  const ordinal = getOrdinalSuffix(day);

  return `${dayName}, ${monthName} ${day}${ordinal}`;
}
