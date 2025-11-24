import { Discord, On } from 'discordx';
import { MessageReaction, User, type Guild } from 'discord.js';
import Enmap from 'enmap';
import type { PremierEvent } from '../types/event.js';
import { parseSeasonWeek, weekKey } from '../utils/week.js';

@Discord()
export class ReactionHandler {
  private db = new Enmap({ name: 'premier_data' });

  @On({ event: 'messageReactionAdd' })
  async handleReaction(reaction: MessageReaction, user: User): Promise<void> {
    try {
      if (user.bot) return;
      // Resolve partials
      if (reaction.partial) await reaction.fetch();
      const message = reaction.message;
      if (!message.guildId) return;
      const scheduledEvents = (this.db.get('scheduledEvents') as PremierEvent[]) || [];
      const event = scheduledEvents.find((e) => e.postMatchPromptMessageId === message.id);
      if (!event) return; // not a prompt message
      const guild = message.guild as Guild;
      const teamRoleId = (this.db.get('teamRoleId') as string)?.replace(/[<>@&]/g, '');
      const member = await guild.members.fetch(user.id).catch(() => null);
      if (!member) return;

      // Check if user has team role
      if (!teamRoleId || !member.roles.cache.has(teamRoleId)) {
        return; // only teammates can record
      }

      const emoji = reaction.emoji.name;
      if (!['0️⃣', '1️⃣', '2️⃣'].includes(emoji || '')) return;
      const info = parseSeasonWeek(event.eventId);
      if (!info) return;
      const key = weekKey(info.season, info.week);
      let matchesPlayedToday = 0;
      if (emoji === '1️⃣') matchesPlayedToday = 1;
      else if (emoji === '2️⃣') matchesPlayedToday = 2;
      
      // Get current week total and increment by today's count
      const currentWeekTotal = (this.db.get(key) as number) || 0;
      const newWeekTotal = currentWeekTotal + matchesPlayedToday;
      this.db.set(key, newWeekTotal);
      event.postMatchCountRecorded = true;

      // Send confirmation message in thread
      try {
        if ('send' in message.channel) {
          await message.channel.send(
            `✅ Recorded ${matchesPlayedToday} match${matchesPlayedToday === 1 ? '' : 'es'} played today. Week total: ${newWeekTotal}/2`,
          );
        }
      } catch (e) {
        console.error('Failed to send confirmation:', e);
      }

      // Disable further signups if 2 matches reached
      if (newWeekTotal >= 2) {
        event.signupsDisabled = true;
        // Also disable remaining same-week match events
        for (const ev of scheduledEvents) {
          if (
            ev.eventId !== event.eventId &&
            ev.type === 'Match' &&
            ev.week === event.week &&
            !ev.signupsDisabled
          ) {
            ev.signupsDisabled = true;
          }
        }
      } else if (matchesPlayedToday > 0) {
        // Announce need for more signups only if matches were played today
        const announcementChannelMention = this.db.get('announcementChannel') as string;
        const channelId = announcementChannelMention?.replace(/[<>#]/g, '');
        if (channelId) {
          try {
            const channel = await guild.channels.fetch(channelId);
            if (channel?.isTextBased()) {
              const remaining = 2 - newWeekTotal;
              await channel.send(
                `Need signups for ${remaining} more match${remaining === 1 ? '' : 'es'} this week (W${event.week}).`,
              );
            }
          } catch (e) {
            console.error('Failed sending signup encouragement:', e);
          }
        }
      }
      // Persist events
      const idx = scheduledEvents.findIndex((e) => e.eventId === event.eventId);
      if (idx !== -1) scheduledEvents[idx] = event;
      this.db.set('scheduledEvents', scheduledEvents);
    } catch (e) {
      console.error('Reaction handler error:', e);
    }
  }
}
