import { ChannelType, Message } from 'discord.js';
import { Discord, On, type ArgsOf } from 'discordx';
import Enmap from 'enmap';
import type { EventResponses, PremierEvent } from '../types/event.js';
import { bot } from '../bot.js';

// Shared state across all instances
const pendingEdits = new Map<string, { eventId: string; stage: string }>();

@Discord()
export class DMHandler {
  private db = new Enmap({ name: 'premier_data' });

  setPendingEdit(userId: string, eventId: string, stage: string): void {
    pendingEdits.set(userId, { eventId, stage });
  }

  @On()
  async messageCreate([message]: ArgsOf<'messageCreate'>): Promise<void> {
    // Only handle DMs
    if (message.channel.type !== ChannelType.DM || message.author.bot) return;

    const userId = message.author.id;
    const content = message.content.trim();

    // Check if user has a pending edit
    const pendingEdit = pendingEdits.get(userId);

    if (!pendingEdit) return;

    // Handle based on current stage
    if (pendingEdit.stage === 'main_menu') {
      await this.handleMainMenu(message, pendingEdit.eventId, content);
    } else if (pendingEdit.stage === 'manage_responses') {
      await this.handleManageResponsesInput(message, pendingEdit.eventId);
    }
  }

  private async handleMainMenu(message: Message, eventId: string, content: string): Promise<void> {
    const userId = message.author.id;

    if (content === '0') {
      pendingEdits.delete(userId);
      await message.reply('❌ Cancelled.');
      return;
    }

    if (content === '1') {
      await this.handleManageResponses(message, eventId);
    } else if (content === '2') {
      await message.reply('Cancel event feature coming soon!');
      pendingEdits.delete(userId);
    } else if (content === '3') {
      await message.reply('Change map feature coming soon!');
      pendingEdits.delete(userId);
    } else if (content === '4') {
      await message.reply('Reschedule feature coming soon!');
      pendingEdits.delete(userId);
    } else if (content === '5') {
      await message.reply('Mark completed feature coming soon!');
      pendingEdits.delete(userId);
    } else {
      await message.reply('Invalid option. Please reply with 0-5.');
    }
  }

  private async handleManageResponses(message: Message, eventId: string): Promise<void> {
    const userId = message.author.id;

    await message.reply(
      `**Manage Event Responses**\n\n` +
        `Commands:\n` +
        `• \`move @user to accepted\` - Move user to Accepted\n` +
        `• \`move @user to declined\` - Move user to Declined\n` +
        `• \`move @user to tentative\` - Move user to Tentative\n` +
        `• \`remove @user\` - Remove user from all lists\n` +
        `• \`add @user to accepted\` - Add user to Accepted\n` +
        `• \`add @user to declined\` - Add user to Declined\n` +
        `• \`add @user to tentative\` - Add user to Tentative\n\n` +
        `Type \`done\` when finished.`,
    );

    pendingEdits.set(userId, { eventId, stage: 'manage_responses' });
  }

  private async handleManageResponsesInput(message: Message, eventId: string): Promise<void> {
    const userId = message.author.id;
    const content = message.content.toLowerCase().trim();

    if (content === 'done') {
      pendingEdits.delete(userId);
      await message.reply('✅ Done managing responses.');
      return;
    }

    // Parse commands
    const moveMatch = content.match(/^move <@!?(\d+)> to (accepted|declined|tentative)$/);
    const removeMatch = content.match(/^remove <@!?(\d+)>$/);
    const addMatch = content.match(/^add <@!?(\d+)> to (accepted|declined|tentative)$/);

    if (!moveMatch && !removeMatch && !addMatch) {
      await message.reply('Invalid command. Please use the format shown above.');
      return;
    }

    // Find the specific event being edited
    const scheduledEvents = (this.db.get('scheduledEvents') as PremierEvent[]) || [];
    const targetEvent = scheduledEvents.find((e) => e.eventId === eventId);

    if (!targetEvent) {
      await message.reply('Could not find event to edit.');
      return;
    }

    const responses =
      (this.db.get(`${targetEvent.eventId}_responses`) as EventResponses) ||
      ({ accepted: [], declined: [], tentative: [] } as EventResponses);

    if (moveMatch) {
      const [, targetUserId, targetList] = moveMatch;
      // Remove from all lists
      responses.accepted = responses.accepted.filter((id) => id !== targetUserId);
      responses.declined = responses.declined.filter((id) => id !== targetUserId);
      responses.tentative = responses.tentative.filter((id) => id !== targetUserId);
      // Add to target list
      responses[targetList as keyof EventResponses].push(targetUserId);
      this.db.set(`${targetEvent.eventId}_responses`, responses);
      await message.reply(`✅ Moved <@${targetUserId}> to ${targetList}.`);
    } else if (removeMatch) {
      const [, targetUserId] = removeMatch;
      responses.accepted = responses.accepted.filter((id) => id !== targetUserId);
      responses.declined = responses.declined.filter((id) => id !== targetUserId);
      responses.tentative = responses.tentative.filter((id) => id !== targetUserId);
      this.db.set(`${targetEvent.eventId}_responses`, responses);
      await message.reply(`✅ Removed <@${targetUserId}> from all lists.`);
    } else if (addMatch) {
      const [, targetUserId, targetList] = addMatch;
      // Remove from all lists first (prevent duplicates)
      responses.accepted = responses.accepted.filter((id) => id !== targetUserId);
      responses.declined = responses.declined.filter((id) => id !== targetUserId);
      responses.tentative = responses.tentative.filter((id) => id !== targetUserId);
      // Add to target list
      responses[targetList as keyof EventResponses].push(targetUserId);
      this.db.set(`${targetEvent.eventId}_responses`, responses);
      await message.reply(`✅ Added <@${targetUserId}> to ${targetList}.`);
    }

    // Update the event message
    await this.updateEventMessage(targetEvent, responses);
  }

  private async updateEventMessage(event: PremierEvent, responses: EventResponses): Promise<void> {
    if (!event.messageId) return;

    try {
      const channelMention =
        event.type === 'Practice'
          ? (this.db.get('practiceChannel') as string)
          : (this.db.get('matchChannel') as string);
      const channelId = channelMention?.replace(/[<>#]/g, '');

      if (!channelId) return;

      const channel = await bot.channels.fetch(channelId);
      if (!channel?.isTextBased()) return;

      const message = await channel.messages.fetch(event.messageId);
      const currentEmbed = message.embeds[0];

      if (!currentEmbed) return;

      // Recreate embed with updated responses
      const season = this.db.get('season') as string;
      const eventDate = new Date(event.startTimestamp * 1000);
      const formattedDate = eventDate.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        timeZone: 'America/Los_Angeles',
      });

      const updatedEmbed = {
        title: `${season} W${event.week} ${event.type} - ${event.map} (${formattedDate})`,
        color: currentEmbed.color ?? 0x98c379,
        fields: [
          {
            name: 'Time',
            value: `<t:${event.startTimestamp}:F> - <t:${event.endTimestamp}:t>`,
            inline: false,
          },
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
        ],
        timestamp: currentEmbed.timestamp ?? undefined,
      };

      await message.edit({ embeds: [updatedEmbed] });
    } catch (error) {
      console.error('Failed to update event message:', error);
    }
  }
}
