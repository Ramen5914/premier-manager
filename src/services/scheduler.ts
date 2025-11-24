import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type Client,
  type TextChannel,
  type ThreadChannel,
  PermissionFlagsBits,
} from 'discord.js';
import { CronJob } from 'cron';
import Enmap from 'enmap';
import type { PremierEvent } from '../types/event.js';
import { selectRoster, formatRosterMentions } from '../utils/roster.js';
import { parseSeasonWeek, weekKey } from '../utils/week.js';
import { formatEventDate } from '../utils/date.js';

const db = new Enmap({ name: 'premier_data' });

export async function sendEventAnnouncements(bot: Client): Promise<void> {
  try {
    const scheduledEvents = (db.get('scheduledEvents') as PremierEvent[]) || [];
    const now = Math.floor(Date.now() / 1000);

    // Get current week's events that haven't passed
    const currentEvents = scheduledEvents.filter((event) => {
      // Use PST timezone for consistent week calculation
      const nowPST = new Date(
        new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }),
      );
      const eventPST = new Date(
        new Date(event.startTimestamp * 1000).toLocaleString('en-US', {
          timeZone: 'America/Los_Angeles',
        }),
      );

      // Get Monday of current week in PST
      const currentMonday = new Date(nowPST);
      currentMonday.setDate(nowPST.getDate() - ((nowPST.getDay() + 6) % 7));
      currentMonday.setHours(0, 0, 0, 0);

      // Get Monday of event's week in PST
      const eventMonday = new Date(eventPST);
      eventMonday.setDate(eventPST.getDate() - ((eventPST.getDay() + 6) % 7));
      eventMonday.setHours(0, 0, 0, 0);

      // Same week (by Monday) and event hasn't ended
      return eventMonday.getTime() === currentMonday.getTime() && event.endTimestamp > now;
    });

    if (currentEvents.length === 0) {
      return;
    }

    // Reset signupsDisabled for the current week's matches (new week = fresh start)
    // Check if this week's match count allows signups
    const currentWeek = currentEvents[0]?.week;
    if (currentWeek) {
      const info = parseSeasonWeek(currentEvents[0].eventId);
      if (info) {
        const key = weekKey(info.season, info.week);
        const matchCount = (db.get(key) as number) || 0;
        const shouldDisable = matchCount >= 2;

        for (const event of currentEvents) {
          if (event.type === 'Match') {
            event.signupsDisabled = shouldDisable;
          }
        }
      }
    }

    // Sort events chronologically
    currentEvents.sort((a, b) => a.startTimestamp - b.startTimestamp);

    // Separate practice and match events
    const practiceEvents = currentEvents.filter((e) => e.type === 'Practice');
    const matchEvents = currentEvents.filter((e) => e.type === 'Match');

    const practiceChannelMention = db.get('practiceChannel') as string;
    const matchChannelMention = db.get('matchChannel') as string;
    const teamRoleId = db.get('teamRoleId') as string;

    // Extract channel IDs from mention format <#id>
    const practiceChannelId = practiceChannelMention?.replace(/[<>#]/g, '');
    const matchChannelId = matchChannelMention?.replace(/[<>#]/g, '');

    // Send practice events
    if (practiceChannelId && practiceEvents.length > 0) {
      const practiceChannel = (await bot.channels.fetch(practiceChannelId)) as TextChannel;
      if (practiceChannel) {
        for (const event of practiceEvents) {
          try {
            // Check if event already has a message
            if (event.messageId) {
              try {
                const existingMessage = await practiceChannel.messages.fetch(event.messageId);
                await existingMessage.edit({
                  content: `${teamRoleId}`,
                  embeds: [createEventEmbed(event)],
                  components: [createEventButtons(event)],
                });
              } catch {
                // Message was deleted, send new one
                const message = await practiceChannel.send({
                  content: `${teamRoleId}`,
                  embeds: [createEventEmbed(event)],
                  components: [createEventButtons(event)],
                });
                event.messageId = message.id;
              }
            } else {
              // No existing message, send new one
              const message = await practiceChannel.send({
                content: `${teamRoleId}`,
                embeds: [createEventEmbed(event)],
                components: [createEventButtons(event)],
              });
              event.messageId = message.id;
            }
          } catch (error) {
            await handleSendError(bot, event, error);
          }
        }
      }
    }

    // Send match events
    if (matchChannelId && matchEvents.length > 0) {
      const matchChannel = (await bot.channels.fetch(matchChannelId)) as TextChannel;
      if (matchChannel) {
        for (const event of matchEvents) {
          try {
            // Check if event already has a message
            if (event.messageId) {
              try {
                const existingMessage = await matchChannel.messages.fetch(event.messageId);
                await existingMessage.edit({
                  content: `${teamRoleId}`,
                  embeds: [createEventEmbed(event)],
                  components: [createEventButtons(event)],
                });
              } catch {
                // Message was deleted, send new one
                const message = await matchChannel.send({
                  content: `${teamRoleId}`,
                  embeds: [createEventEmbed(event)],
                  components: [createEventButtons(event)],
                });
                event.messageId = message.id;
              }
            } else {
              // No existing message, send new one
              const message = await matchChannel.send({
                content: `${teamRoleId}`,
                embeds: [createEventEmbed(event)],
                components: [createEventButtons(event)],
              });
              event.messageId = message.id;
            }
          } catch (error) {
            await handleSendError(bot, event, error);
          }
        }
      }
    }

    // Save updated events
    db.set('scheduledEvents', scheduledEvents);
  } catch (error) {
    console.error('Error sending event announcements:', error);
  }
}

function createEventEmbed(event: PremierEvent): EmbedBuilder {
  const eventDate = new Date(event.startTimestamp * 1000);
  const formattedDate = formatEventDate(eventDate);
  const season = db.get('season') as string;

  // Load responses
  const responses = db.get(`${event.eventId}_responses`) as {
    accepted: string[];
    declined: string[];
    tentative: string[];
  } | null;

  const accepted = responses?.accepted || [];
  const declined = responses?.declined || [];
  const tentative = responses?.tentative || [];

  const embed = new EmbedBuilder()
    .setTitle(`${season} W${event.week} ${event.type} - ${event.map} (${formattedDate})`)
    .setColor(0x98c379)
    .addFields({
      name: 'Time',
      value: `<t:${event.startTimestamp}:F> - <t:${event.endTimestamp}:t>`,
      inline: false,
    })
    .addFields(
      {
        name: `✅ Accepted (${accepted.length})`,
        value: accepted.length > 0 ? accepted.map((id) => `> <@${id}>`).join('\n') : '-',
        inline: true,
      },
      {
        name: `❌ Declined (${declined.length})`,
        value: declined.length > 0 ? declined.map((id) => `> <@${id}>`).join('\n') : '-',
        inline: true,
      },
      {
        name: `❓ Tentative (${tentative.length})`,
        value: tentative.length > 0 ? tentative.map((id) => `> <@${id}>`).join('\n') : '-',
        inline: true,
      },
    )
    .setTimestamp();

  return embed;
}

function createEventButtons(event: PremierEvent): ActionRowBuilder<ButtonBuilder> {
  // Buttons should remain enabled until the event has actually ended
  // For matches, also disable if signupsDisabled (2 matches reached this week)
  const now = Math.floor(Date.now() / 1000);
  const disabled = now >= event.endTimestamp || (event.type === 'Match' && event.signupsDisabled);
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`accept-${event.eventId}`)
      .setLabel('✅ Accepted')
      .setStyle(ButtonStyle.Success)
      .setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId(`decline-${event.eventId}`)
      .setLabel('❌ Declined')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId(`tentative-${event.eventId}`)
      .setLabel('❓ Tentative')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId(`edit-${event.eventId}`)
      .setLabel('✏️ Edit')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(disabled),
  );
}

async function handleSendError(bot: Client, event: PremierEvent, error: unknown): Promise<void> {
  const eventCreatorId = db.get('eventCreatorId') as string;
  if (!eventCreatorId) {
    console.error(`Failed to send event ${event.eventId}:`, error);
    return;
  }

  try {
    const creator = await bot.users.fetch(eventCreatorId);
    const eventDate = new Date(event.startTimestamp * 1000);
    const formattedDate = formatEventDate(eventDate);

    await creator.send(
      `Failed to send announcement for ${event.type} on ${formattedDate}:\n${error instanceof Error ? error.message : String(error)}`,
    );
  } catch (dmError) {
    console.error(`Failed to send event ${event.eventId}:`, error);
    console.error('Failed to DM event creator:', dmError);
  }
}

async function cleanupOldEvents(bot: Client): Promise<void> {
  try {
    const scheduledEvents = (db.get('scheduledEvents') as PremierEvent[]) || [];
    const now = Math.floor(Date.now() / 1000);

    // Filter out events that have ended
    const activeEvents = scheduledEvents.filter((event) => event.endTimestamp > now);

    // Remove buttons from ended events & archive threads
    const endedEvents = scheduledEvents.filter((event) => event.endTimestamp <= now);
    for (const event of endedEvents) {
      // Remove buttons from the message if it exists
      if (event.messageId) {
        try {
          const channelMention =
            event.type === 'Practice'
              ? (db.get('practiceChannel') as string)
              : (db.get('matchChannel') as string);
          const channelId = channelMention?.replace(/[<>#]/g, '');

          if (channelId) {
            const channel = (await bot.channels.fetch(channelId)) as TextChannel;
            if (channel) {
              const message = await channel.messages.fetch(event.messageId);
              await message.edit({
                embeds: message.embeds,
                components: [], // Remove all buttons
              });
            }
          }
        } catch (error) {
          // Message was deleted or channel is inaccessible, continue
          console.error(`Failed to remove buttons from event ${event.eventId}:`, error);
        }
      }

      db.delete(`${event.eventId}_responses`);
      // Archive thread
      if (event.threadId) {
        try {
          const thread = await bot.channels.fetch(event.threadId);
          if (thread && thread.isThread()) {
            const tc = thread as ThreadChannel;
            if (!tc.archived) await tc.setArchived(true, 'Event ended');
          }
        } catch (e) {
          console.error('Failed to archive thread', event.eventId, e);
        }
        event.threadId = null;
        persistEvent(event);
      }
    }

    // Update scheduled events
    db.set('scheduledEvents', activeEvents);
  } catch (error) {
    console.error('Cleanup attempt 1 failed:', error);
    // Retry once
    try {
      const scheduledEvents = (db.get('scheduledEvents') as PremierEvent[]) || [];
      const now = Math.floor(Date.now() / 1000);
      const activeEvents = scheduledEvents.filter((event) => event.endTimestamp > now);
      const endedEvents = scheduledEvents.filter((event) => event.endTimestamp <= now);
      for (const event of endedEvents) {
        // Remove buttons from the message if it exists
        if (event.messageId) {
          try {
            const channelMention =
              event.type === 'Practice'
                ? (db.get('practiceChannel') as string)
                : (db.get('matchChannel') as string);
            const channelId = channelMention?.replace(/[<>#]/g, '');

            if (channelId) {
              const channel = (await bot.channels.fetch(channelId)) as TextChannel;
              if (channel) {
                const message = await channel.messages.fetch(event.messageId);
                await message.edit({
                  embeds: message.embeds,
                  components: [], // Remove all buttons
                });
              }
            }
          } catch (removeError) {
            // Message was deleted or channel is inaccessible, continue
            console.error(`Failed to remove buttons from event ${event.eventId}:`, removeError);
          }
        }

        db.delete(`${event.eventId}_responses`);
        if (event.threadId) {
          try {
            const thread = await bot.channels.fetch(event.threadId);
            if (thread && thread.isThread()) {
              const tc = thread as ThreadChannel;
              if (!tc.archived) await tc.setArchived(true, 'Event ended');
            }
          } catch (e) {
            console.error('Failed to archive thread', event.eventId, e);
          }
          event.threadId = null;
          persistEvent(event);
        }
      }
      db.set('scheduledEvents', activeEvents);
    } catch (retryError) {
      console.error('Cleanup attempt 2 failed:', retryError);
    }
  }
}

export function initializeScheduler(bot: Client): void {
  // Run announcements immediately on startup
  void sendEventAnnouncements(bot);
  // Schedule per-event timers after announcements
  scheduleAll(bot);

  // Schedule announcements for every Monday at midnight PST
  new CronJob(
    '0 0 * * 1',
    () => {
      void sendEventAnnouncements(bot);
    },
    null,
    true,
    'America/Los_Angeles',
  );

  // Schedule cleanup for every Sunday at 11:59pm PST
  new CronJob(
    '59 23 * * 0',
    () => {
      void cleanupOldEvents(bot);
    },
    null,
    true,
    'America/Los_Angeles',
  );

  console.log('Scheduler initialized');
}

// ---- Added advanced scheduling & helper logic ----
const scheduledTimeouts = new Map<string, NodeJS.Timeout[]>();

function getResponses(event: PremierEvent): {
  accepted: string[];
  declined: string[];
  tentative: string[];
} {
  return (
    (db.get(`${event.eventId}_responses`) as {
      accepted: string[];
      declined: string[];
      tentative: string[];
    }) || { accepted: [], declined: [], tentative: [] }
  );
}

function persistEvent(event: PremierEvent): void {
  const events = (db.get('scheduledEvents') as PremierEvent[]) || [];
  const idx = events.findIndex((e) => e.eventId === event.eventId);
  if (idx !== -1) {
    events[idx] = event;
    db.set('scheduledEvents', events);
  }
}

async function dmOwner(bot: Client, content: string): Promise<void> {
  try {
    const ownerRoleMention = db.get('ownerRoleId') as string;
    const ownerRoleId = ownerRoleMention?.replace(/[<>@&]/g, '');
    for (const [, g] of bot.guilds.cache) {
      try {
        const role = ownerRoleId ? g.roles.cache.get(ownerRoleId) : null;
        if (role) {
          const member = role.members.first();
          if (member) {
            await member.send(content);
            return;
          }
        }
      } catch (e) {
        console.error('DM owner attempt failed:', e);
      }
    }
  } catch (e) {
    console.error('Failed DM owner:', e);
  }
}

async function createEventThread(bot: Client, event: PremierEvent): Promise<ThreadChannel | null> {
  if (event.threadId) {
    try {
      const thread = await bot.channels.fetch(event.threadId);
      return thread as ThreadChannel;
    } catch {
      // recreate
    }
  }
  const channelMention =
    event.type === 'Practice'
      ? (db.get('practiceChannel') as string)
      : (db.get('matchChannel') as string);
  const channelId = channelMention?.replace(/[<>#]/g, '');
  if (!channelId || !event.messageId) return null;
  const channel = (await bot.channels.fetch(channelId)) as TextChannel;
  if (!channel) return null;
  const perms = channel.permissionsFor(bot.user!.id);
  if (!perms || !perms.has(PermissionFlagsBits.CreatePublicThreads)) {
    await dmOwner(bot, `Missing CreatePublicThreads permission for event ${event.eventId}.`);
    return null;
  }
  try {
    const parentMessage = await channel.messages.fetch(event.messageId);
    const thread = await parentMessage.startThread({
      name: `W${event.week}-${event.type}-${event.day}`,
    });
    event.threadId = thread.id;
    persistEvent(event);
    return thread;
  } catch (err) {
    console.error('Failed to create thread:', err);
    await dmOwner(
      bot,
      `Failed to create thread for event ${event.eventId}: ${(err as Error).message}`,
    );
    return null;
  }
}

async function sendOneHourRoster(bot: Client, event: PremierEvent): Promise<void> {
  const responses = getResponses(event);
  if (responses.accepted.length < 5) return; // need at least 5
  const thread = await createEventThread(bot, event);
  if (!thread) return;
  const ownerRoleId = (db.get('ownerRoleId') as string)?.replace(/[<>@&]/g, '');
  const captainRoleId = (db.get('captainRoleId') as string)?.replace(/[<>@&]/g, '');
  const { roster, standby } = await selectRoster(
    thread.guild,
    responses.accepted,
    ownerRoleId,
    captainRoleId,
  );
  const message =
    `1 Hour Reminder for <t:${event.startTimestamp}:F>\n` +
    formatRosterMentions({ roster, standby });
  const sent = await thread.send(message);
  event.threadRosterMessageId = sent.id;
  persistEvent(event);
}

async function sendFifteenMinuteReminder(bot: Client, event: PremierEvent): Promise<void> {
  const responses = getResponses(event);
  if (responses.accepted.length < 5 && !event.threadId) return; // still insufficient & no thread
  const thread = await createEventThread(bot, event);
  if (!thread) return;
  const ownerRoleId = (db.get('ownerRoleId') as string)?.replace(/[<>@&]/g, '');
  const captainRoleId = (db.get('captainRoleId') as string)?.replace(/[<>@&]/g, '');
  const { roster, standby } = await selectRoster(
    thread.guild,
    responses.accepted,
    ownerRoleId,
    captainRoleId,
  );
  const message =
    `15 Minute Reminder for <t:${event.startTimestamp}:F>\n` +
    formatRosterMentions({ roster, standby });
  await thread.send(message);
  event.preEventReminderSent = true;
  persistEvent(event);
}

async function sendPostMatchPrompt(bot: Client, event: PremierEvent): Promise<void> {
  if (event.type !== 'Match') return;
  const info = parseSeasonWeek(event.eventId);
  if (!info) return;
  const currentCount = (db.get(weekKey(info.season, info.week)) as number) || 0;
  if (currentCount >= 2) return; // already max
  const thread = await createEventThread(bot, event);
  if (!thread) return;
  const perms = thread.permissionsFor(bot.user!.id);
  if (!perms || !perms.has(PermissionFlagsBits.AddReactions)) {
    await dmOwner(
      bot,
      `Missing AddReactions permission for post-match prompt in event ${event.eventId}.`,
    );
  }

  // Determine which reactions to show based on remaining capacity
  const remaining = 2 - currentCount;
  const maxOptions = Math.min(2, remaining);
  let promptText = 'React with ';
  const reactions: string[] = ['0️⃣'];

  if (maxOptions >= 1) {
    promptText += '0️⃣ or 1️⃣';
    reactions.push('1️⃣');
  }
  if (maxOptions >= 2) {
    promptText = 'React with 0️⃣, 1️⃣, or 2️⃣';
    reactions.push('2️⃣');
  } else if (maxOptions === 1) {
    // Only show 0 or 1 if only 1 spot remains
    promptText = 'React with 0️⃣ or 1️⃣';
  }
  promptText += ' to indicate matches played today.';

  const msg = await thread.send(promptText);
  event.postMatchPromptMessageId = msg.id;
  persistEvent(event);
  try {
    for (const reaction of reactions) {
      await msg.react(reaction);
    }
  } catch (e) {
    console.error('Failed adding reactions:', e);
  }
}

function scheduleTimersForEvent(bot: Client, event: PremierEvent): void {
  const now = Math.floor(Date.now() / 1000);
  const timeouts: NodeJS.Timeout[] = [];
  const oneHour = event.startTimestamp - 3600;
  if (oneHour > now) {
    timeouts.push(
      setTimeout(
        () => {
          void sendOneHourRoster(bot, event);
        },
        (oneHour - now) * 1000,
      ),
    );
  } else if (event.startTimestamp > now && !event.threadId) {
    void sendOneHourRoster(bot, event);
  }
  const fifteen = event.startTimestamp - 900;
  if (fifteen > now) {
    timeouts.push(
      setTimeout(
        () => {
          void sendFifteenMinuteReminder(bot, event);
        },
        (fifteen - now) * 1000,
      ),
    );
  } else if (event.startTimestamp > now && !event.preEventReminderSent) {
    void sendFifteenMinuteReminder(bot, event);
  }
  if (event.type === 'Match') {
    if (event.endTimestamp > now) {
      timeouts.push(
        setTimeout(
          () => {
            void sendPostMatchPrompt(bot, event);
          },
          (event.endTimestamp - now) * 1000,
        ),
      );
    }
  }
  if (timeouts.length > 0) scheduledTimeouts.set(event.eventId, timeouts);
}

function scheduleAll(bot: Client): void {
  const events = (db.get('scheduledEvents') as PremierEvent[]) || [];
  for (const e of events) scheduleTimersForEvent(bot, e);
}
