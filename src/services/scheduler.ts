import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type Client,
  type TextChannel,
} from 'discord.js';
import { CronJob } from 'cron';
import Enmap from 'enmap';
import type { PremierEvent } from '../types/event.js';
import { formatEventDate } from '../utils/date.js';

const db = new Enmap({ name: 'premier_data' });

export async function sendEventAnnouncements(bot: Client): Promise<void> {
  try {
    const scheduledEvents = (db.get('scheduledEvents') as PremierEvent[]) || [];
    const now = Math.floor(Date.now() / 1000);

    // Get current week's events that haven't passed
    const currentEvents = scheduledEvents.filter((event) => {
      const eventDate = new Date(event.startTimestamp * 1000);
      const currentDate = new Date();

      // Get Monday of the event's week
      const eventMonday = new Date(eventDate);
      eventMonday.setDate(eventDate.getDate() - ((eventDate.getDay() + 6) % 7));
      eventMonday.setHours(0, 0, 0, 0);

      // Get Monday of current week
      const currentMonday = new Date(currentDate);
      currentMonday.setDate(currentDate.getDate() - ((currentDate.getDay() + 6) % 7));
      currentMonday.setHours(0, 0, 0, 0);

      // Same week and event hasn't ended
      return eventMonday.getTime() === currentMonday.getTime() && event.endTimestamp > now;
    });

    if (currentEvents.length === 0) {
      return;
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
                  components: [createEventButtons(event.eventId)],
                });
              } catch {
                // Message was deleted, send new one
                const message = await practiceChannel.send({
                  content: `${teamRoleId}`,
                  embeds: [createEventEmbed(event)],
                  components: [createEventButtons(event.eventId)],
                });
                event.messageId = message.id;
              }
            } else {
              // No existing message, send new one
              const message = await practiceChannel.send({
                content: `${teamRoleId}`,
                embeds: [createEventEmbed(event)],
                components: [createEventButtons(event.eventId)],
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
                  components: [createEventButtons(event.eventId)],
                });
              } catch {
                // Message was deleted, send new one
                const message = await matchChannel.send({
                  content: `${teamRoleId}`,
                  embeds: [createEventEmbed(event)],
                  components: [createEventButtons(event.eventId)],
                });
                event.messageId = message.id;
              }
            } else {
              // No existing message, send new one
              const message = await matchChannel.send({
                content: `${teamRoleId}`,
                embeds: [createEventEmbed(event)],
                components: [createEventButtons(event.eventId)],
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

function createEventButtons(eventId: string): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`accept-${eventId}`)
      .setLabel('✅ Accepted')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`decline-${eventId}`)
      .setLabel('❌ Declined')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`tentative-${eventId}`)
      .setLabel('❓ Tentative')
      .setStyle(ButtonStyle.Primary),
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

async function cleanupOldEvents(): Promise<void> {
  try {
    const scheduledEvents = (db.get('scheduledEvents') as PremierEvent[]) || [];
    const now = Math.floor(Date.now() / 1000);

    // Filter out events that have ended
    const activeEvents = scheduledEvents.filter((event) => event.endTimestamp > now);

    // Delete responses for ended events
    const endedEvents = scheduledEvents.filter((event) => event.endTimestamp <= now);
    for (const event of endedEvents) {
      db.delete(`${event.eventId}_responses`);
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
        db.delete(`${event.eventId}_responses`);
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
      void cleanupOldEvents();
    },
    null,
    true,
    'America/Los_Angeles',
  );

  console.log('Scheduler initialized');
}
