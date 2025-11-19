import { ButtonInteraction, EmbedBuilder, type GuildMember } from 'discord.js';
import { ButtonComponent, Discord } from 'discordx';
import Enmap from 'enmap';
import type { PremierEvent, EventResponses } from '../types/event.js';
import { bot } from '../bot.js';
import { formatEventDate } from '../utils/date.js';

@Discord()
export class EventButtons {
  private db = new Enmap({ name: 'premier_data' });

  @ButtonComponent({ id: /^accept-.*/ })
  async handleAccept(interaction: ButtonInteraction): Promise<void> {
    await this.handleButtonClick(interaction, 'accepted');
  }

  @ButtonComponent({ id: /^decline-.*/ })
  async handleDecline(interaction: ButtonInteraction): Promise<void> {
    await this.handleButtonClick(interaction, 'declined');
  }

  @ButtonComponent({ id: /^tentative-.*/ })
  async handleTentative(interaction: ButtonInteraction): Promise<void> {
    await this.handleButtonClick(interaction, 'tentative');
  }

  private async handleButtonClick(
    interaction: ButtonInteraction,
    responseType: 'accepted' | 'declined' | 'tentative',
  ): Promise<void> {
    // Check if user has team role
    const teamRoleMention = this.db.get('teamRoleId') as string;
    const member = interaction.member as GuildMember;

    // Extract role ID from mention format <@&id>
    const teamRoleId = teamRoleMention?.replace(/[<>@&]/g, '');
    if (!member.roles.cache.has(teamRoleId)) {
      // Silently ignore if not on team
      return;
    }

    // Extract event ID from button custom ID
    const eventId = interaction.customId.split('-').slice(1).join('-');
    const userId = interaction.user.id;

    // Load or initialize responses
    let responses = this.db.get(`${eventId}_responses`) as EventResponses | null;
    if (!responses) {
      responses = { accepted: [], declined: [], tentative: [] };
    }

    // Check if user is already in the clicked array (before removing)
    const wasInArray = responses[responseType].includes(userId);

    // Remove user from all arrays
    responses.accepted = responses.accepted.filter((id) => id !== userId);
    responses.declined = responses.declined.filter((id) => id !== userId);
    responses.tentative = responses.tentative.filter((id) => id !== userId);

    // Toggle in clicked array (add if not present)
    if (!wasInArray) {
      responses[responseType].push(userId);
    }

    // Save responses
    this.db.set(`${eventId}_responses`, responses);

    // Update embed
    const scheduledEvents = (this.db.get('scheduledEvents') as PremierEvent[]) || [];
    const event = scheduledEvents.find((e) => e.eventId === eventId);

    if (event) {
      const updatedEmbed = this.createUpdatedEmbed(event, responses);

      await interaction.update({
        embeds: [updatedEmbed],
      });

      // Check for roster announcement
      await this.manageRosterAnnouncement(event, responses, interaction.guildId!);
    }
  }

  private createUpdatedEmbed(event: PremierEvent, responses: EventResponses): EmbedBuilder {
    const eventDate = new Date(event.startTimestamp * 1000);
    const formattedDate = formatEventDate(eventDate);
    const season = this.db.get('season') as string;

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
          name: `✅ Accepted (${responses.accepted.length})`,
          value:
            responses.accepted.length > 0
              ? responses.accepted.map((id) => `> <@${id}>`).join('\n')
              : '-',
          inline: true,
        },
        {
          name: `❌ Declined (${responses.declined.length})`,
          value:
            responses.declined.length > 0
              ? responses.declined.map((id) => `> <@${id}>`).join('\n')
              : '-',
          inline: true,
        },
        {
          name: `❓ Tentative (${responses.tentative.length})`,
          value:
            responses.tentative.length > 0
              ? responses.tentative.map((id) => `> <@${id}>`).join('\n')
              : '-',
          inline: true,
        },
      )
      .setTimestamp();

    return embed;
  }

  private async manageRosterAnnouncement(
    event: PremierEvent,
    responses: EventResponses,
    guildId: string,
  ): Promise<void> {
    const announcementChannelMention = this.db.get('announcementChannel') as string;
    if (!announcementChannelMention) return;

    // Extract channel ID from mention format <#id>
    const announcementChannelId = announcementChannelMention.replace(/[<>#]/g, '');

    const acceptedCount = responses.accepted.length;

    try {
      const guild = await bot.guilds.fetch(guildId);
      const announcementChannel = await guild.channels.fetch(announcementChannelId);
      if (!announcementChannel?.isTextBased()) return;

      if (acceptedCount >= 5) {
        // Build roster
        const ownerRoleMention = this.db.get('ownerRoleId') as string;
        const captainRoleMention = this.db.get('captainRoleId') as string;

        // Extract role IDs from mention format <@&id>
        const ownerRoleId = ownerRoleMention?.replace(/[<>@&]/g, '');
        const captainRoleId = captainRoleMention?.replace(/[<>@&]/g, '');

        const roster: string[] = [];
        const standby: string[] = [];

        // Fetch all accepted members
        const members = await guild.members.fetch({ user: responses.accepted });

        // Prioritize owner and captain
        for (const [userId, member] of members) {
          if (member.roles.cache.has(ownerRoleId) || member.roles.cache.has(captainRoleId)) {
            roster.push(userId);
          }
        }

        // Fill remaining roster slots
        for (const userId of responses.accepted) {
          if (!roster.includes(userId) && roster.length < 5) {
            roster.push(userId);
          } else if (!roster.includes(userId)) {
            standby.push(userId);
          }
        }

        const eventDate = new Date(event.startTimestamp * 1000);
        const formattedDate = formatEventDate(eventDate);

        let message = `${event.type} on ${formattedDate} will be happening!\nRoster:\n`;
        message += roster.map((id) => `<@${id}>`).join('\n');

        if (standby.length > 0) {
          message += '\n\nStandby:\n';
          message += standby.map((id) => `<@${id}>`).join('\n');
        }

        if (event.rosterAnnouncementMessageId) {
          // Update existing message
          try {
            const existingMessage = await announcementChannel.messages.fetch(
              event.rosterAnnouncementMessageId,
            );
            await existingMessage.edit(message);
          } catch {
            // Message was deleted, send new one
            const sentMessage = await announcementChannel.send(message);
            event.rosterAnnouncementMessageId = sentMessage.id;
          }
        } else {
          // Send new roster announcement
          const sentMessage = await announcementChannel.send(message);
          event.rosterAnnouncementMessageId = sentMessage.id;
        }
      } else if (event.rosterAnnouncementMessageId) {
        // Less than 5 players, delete old announcement and send "more players needed"
        try {
          const existingMessage = await announcementChannel.messages.fetch(
            event.rosterAnnouncementMessageId,
          );
          await existingMessage.delete();
        } catch {
          // Message already deleted
        }

        const eventDate = new Date(event.startTimestamp * 1000);
        const formattedDate = formatEventDate(eventDate);
        await announcementChannel.send(`More players needed for ${event.type} on ${formattedDate}`);

        event.rosterAnnouncementMessageId = null;
      }

      // Save updated event
      const scheduledEvents = (this.db.get('scheduledEvents') as PremierEvent[]) || [];
      const eventIndex = scheduledEvents.findIndex((e) => e.eventId === event.eventId);
      if (eventIndex !== -1) {
        scheduledEvents[eventIndex] = event;
        this.db.set('scheduledEvents', scheduledEvents);
      }
    } catch (error) {
      console.error('Error managing roster announcement:', error);
    }
  }
}
