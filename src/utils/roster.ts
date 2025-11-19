import type { Guild } from 'discord.js';

export interface RosterSelectionResult {
  roster: string[]; // up to 5 players
  standby: string[]; // remaining accepted players
}

/** Select roster prioritizing owner/captain roles, filling to 5 then standby. */
export async function selectRoster(
  guild: Guild,
  acceptedIds: string[],
  ownerRoleId: string | undefined,
  captainRoleId: string | undefined,
): Promise<RosterSelectionResult> {
  const roster: string[] = [];
  const standby: string[] = [];
  if (acceptedIds.length === 0) return { roster, standby };

  const members = await guild.members.fetch({ user: acceptedIds });
  // Prioritize owner/captain
  for (const [userId, member] of members) {
    if (
      (ownerRoleId && member.roles.cache.has(ownerRoleId)) ||
      (captainRoleId && member.roles.cache.has(captainRoleId))
    ) {
      if (!roster.includes(userId) && roster.length < 5) {
        roster.push(userId);
      }
    }
  }
  // Fill remaining roster, then standby
  for (const userId of acceptedIds) {
    if (roster.length < 5 && !roster.includes(userId)) {
      roster.push(userId);
    } else if (!roster.includes(userId) && !standby.includes(userId)) {
      standby.push(userId);
    }
  }
  return { roster, standby };
}

/** Format mentions for roster + standby blocks. */
export function formatRosterMentions(result: RosterSelectionResult): string {
  let out = 'Roster:\n';
  out += result.roster.length > 0 ? result.roster.map((id) => `<@${id}>`).join('\n') : 'None';
  if (result.standby.length > 0) {
    out += '\n\nStandby:\n';
    out += result.standby.map((id) => `<@${id}>`).join('\n');
  }
  return out;
}

// Simple debounce map for thread roster edits
const rosterEditDebounce = new Map<string, NodeJS.Timeout>();

export function debounceRosterEdit(eventId: string, fn: () => Promise<void>, delay = 700): void {
  const existing = rosterEditDebounce.get(eventId);
  if (existing) clearTimeout(existing);
  const timeout = setTimeout(() => {
    void fn();
    rosterEditDebounce.delete(eventId);
  }, delay);
  rosterEditDebounce.set(eventId, timeout);
}
