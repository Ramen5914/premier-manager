import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  Message,
  StringSelectMenuBuilder,
  type ButtonInteraction,
  type StringSelectMenuInteraction,
} from 'discord.js';
import { ButtonComponent, Discord, On, SelectMenuComponent, type ArgsOf } from 'discordx';
import Enmap from 'enmap';
import type { EventResponses, PremierEvent } from '../types/event.js';
import { bot } from '../bot.js';

// Shared state across all instances
const pendingEdits = new Map<
  string,
  {
    eventId: string;
    stage: string;
    guildId: string;
    action?: 'add' | 'move' | 'remove';
    selectedUserId?: string;
  }
>();

@Discord()
export class DMHandler {
  private db = new Enmap({ name: 'premier_data' });

  setPendingEdit(userId: string, eventId: string, stage: string, guildId: string): void {
    pendingEdits.set(userId, { eventId, stage, guildId });
  }

  @On()
  async messageCreate([message]: ArgsOf<'messageCreate'>): Promise<void> {
    // Only handle DMs
    if (message.channel.type !== ChannelType.DM || message.author.bot) {
      return;
    }

    const userId = message.author.id;
    const content = message.content.trim();

    // Check if user has a pending edit
    const pendingEdit = pendingEdits.get(userId);

    if (!pendingEdit) {
      return;
    }

    // Handle based on current stage
    try {
      if (pendingEdit.stage === 'main_menu') {
        await this.handleMainMenu(message, pendingEdit.eventId, content);
      } else if (pendingEdit.stage === 'manage_responses') {
        await this.handleManageResponsesInput(message, pendingEdit.eventId);
      }
    } catch {
      try {
        await message.reply('An error occurred while processing your request. Please try again.');
      } catch {
        try {
          await message.author.send('An error occurred while processing your request.');
        } catch {
          // Silent fail
        }
      }
    }
  }

  private async handleMainMenu(message: Message, eventId: string, content: string): Promise<void> {
    const userId = message.author.id;

    if (content === '0') {
      pendingEdits.delete(userId);
      try {
        await message.reply('❌ Cancelled.');
      } catch {
        // Silent fail
      }
      return;
    }

    if (content === '1') {
      // Set stage BEFORE attempting to send (reuse existing guildId)
      const currentEdit = pendingEdits.get(userId);
      if (!currentEdit) {
        await message.reply('Session expired. Please restart from the edit button.');
        return;
      }
      currentEdit.stage = 'manage_responses';
      pendingEdits.set(userId, currentEdit);

      try {
        await this.handleManageResponses(message);
      } catch {
        try {
          await message.author.send(
            'Unable to send the manage responses menu in this DM. Please check your privacy settings.',
          );
        } catch {
          // Silent fail
        }
      }
      return;
    }

    if (content === '2') {
      await this.handleDisableSignups(message, eventId);
      pendingEdits.delete(userId);
      return;
    }

    if (content === '3') {
      try {
        await message.reply('Reschedule feature coming soon!');
      } catch {
        // Silent fail
      }
      pendingEdits.delete(userId);
      return;
    }

    if (content === '4') {
      try {
        await message.reply('Mark completed feature coming soon!');
      } catch {
        // Silent fail
      }
      pendingEdits.delete(userId);
      return;
    }

    try {
      await message.reply('Invalid option. Please reply with 0-4.');
    } catch {
      // Silent fail
    }
  }

  private async handleDisableSignups(message: Message, eventId: string): Promise<void> {
    const scheduledEvents = (this.db.get('scheduledEvents') as PremierEvent[]) || [];
    const event = scheduledEvents.find((e) => e.eventId === eventId);

    if (!event) {
      await message.reply('Event not found.');
      return;
    }

    if (!event.messageId) {
      await message.reply('Event message not found. Cannot disable signups.');
      return;
    }

    try {
      const channelMention =
        event.type === 'Practice' || event.type === 'Playoff'
          ? (this.db.get('practiceChannel') as string)
          : (this.db.get('matchChannel') as string);
      const channelId = channelMention?.replace(/[<>#]/g, '');

      if (!channelId) {
        await message.reply('Channel not configured. Cannot disable signups.');
        return;
      }

      const channel = await bot.channels.fetch(channelId);
      if (!channel?.isTextBased()) {
        await message.reply('Invalid channel type. Cannot disable signups.');
        return;
      }

      const eventMessage = await channel.messages.fetch(event.messageId);
      await eventMessage.edit({ components: [] });

      event.signupsDisabled = true;
      const idx = scheduledEvents.findIndex((e) => e.eventId === eventId);
      if (idx !== -1) scheduledEvents[idx] = event;
      this.db.set('scheduledEvents', scheduledEvents);

      await message.reply('✅ Signups disabled for this event.');
    } catch {
      await message.reply('Failed to disable signups. Please try again.');
    }
  }

  private async handleManageResponses(message: Message): Promise<void> {
    const userId = message.author.id;

    const addButton = new ButtonBuilder()
      .setCustomId(`dm-add-${userId}`)
      .setLabel('Add User')
      .setStyle(ButtonStyle.Success)
      .setEmoji('➕');

    const moveButton = new ButtonBuilder()
      .setCustomId(`dm-move-${userId}`)
      .setLabel('Move User')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('🔄');

    const removeButton = new ButtonBuilder()
      .setCustomId(`dm-remove-${userId}`)
      .setLabel('Remove User')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('➖');

    const doneButton = new ButtonBuilder()
      .setCustomId(`dm-done-${userId}`)
      .setLabel('Done')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('✅');

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      addButton,
      moveButton,
      removeButton,
      doneButton,
    );

    const helpText =
      `**Manage Event Responses**\n\n` +
      `Click a button below to add, move, or remove users from response lists.\n\n` +
      `Click **Done** when finished.`;

    try {
      await message.reply({ content: helpText, components: [row] });
    } catch {
      try {
        await message.author.send({ content: helpText, components: [row] });
      } catch {
        // Silent fail
      }
    }
  }

  @ButtonComponent({ id: /^dm-add-.*/ })
  async handleAddButton(interaction: ButtonInteraction): Promise<void> {
    const userId = interaction.user.id;
    const pendingEdit = pendingEdits.get(userId);

    if (!pendingEdit) {
      await interaction.reply({ content: 'Session expired. Please start over.', ephemeral: true });
      return;
    }

    pendingEdit.action = 'add';
    pendingEdits.set(userId, pendingEdit);

    await this.showUserSelectMenu(interaction, pendingEdit.eventId, 'add');
  }

  @ButtonComponent({ id: /^dm-move-.*/ })
  async handleMoveButton(interaction: ButtonInteraction): Promise<void> {
    const userId = interaction.user.id;
    const pendingEdit = pendingEdits.get(userId);

    if (!pendingEdit) {
      await interaction.reply({ content: 'Session expired. Please start over.', ephemeral: true });
      return;
    }

    pendingEdit.action = 'move';
    pendingEdits.set(userId, pendingEdit);

    await this.showUserSelectMenu(interaction, pendingEdit.eventId, 'move');
  }

  @ButtonComponent({ id: /^dm-remove-.*/ })
  async handleRemoveButton(interaction: ButtonInteraction): Promise<void> {
    const userId = interaction.user.id;
    const pendingEdit = pendingEdits.get(userId);

    if (!pendingEdit) {
      await interaction.reply({ content: 'Session expired. Please start over.', ephemeral: true });
      return;
    }

    pendingEdit.action = 'remove';
    pendingEdits.set(userId, pendingEdit);

    await this.showUserSelectMenu(interaction, pendingEdit.eventId, 'remove');
  }

  @ButtonComponent({ id: /^dm-done-.*/ })
  async handleDoneButton(interaction: ButtonInteraction): Promise<void> {
    const userId = interaction.user.id;
    const pendingEdit = pendingEdits.get(userId);

    if (!pendingEdit) {
      await interaction.update({
        content: '✅ Done managing responses.',
        components: [],
      });
      return;
    }

    // Get the event to find the channel
    const scheduledEvents = (this.db.get('scheduledEvents') as PremierEvent[]) || [];
    const event = scheduledEvents.find((e) => e.eventId === pendingEdit.eventId);

    let channelMention = '';
    if (event) {
      channelMention =
        event.type === 'Practice' || event.type === 'Playoff'
          ? (this.db.get('practiceChannel') as string)
          : (this.db.get('matchChannel') as string);
    }

    pendingEdits.delete(userId);

    await interaction.update({
      content: `✅ Done managing responses.\n\nReturn to ${channelMention}`,
      components: [],
    });
  }

  private async showUserSelectMenu(
    interaction: ButtonInteraction,
    eventId: string,
    action: 'add' | 'move' | 'remove',
  ): Promise<void> {
    const responses = (this.db.get(`${eventId}_responses`) as EventResponses) || {
      accepted: [],
      declined: [],
      tentative: [],
    };

    // Get all unique user IDs
    const allUserIds = new Set([
      ...responses.accepted,
      ...responses.declined,
      ...responses.tentative,
    ]);

    if (allUserIds.size === 0) {
      await interaction.reply({
        content: 'No users found in response lists.',
        ephemeral: true,
      });
      return;
    }

    // Fetch user details from guild
    const scheduledEvents = (this.db.get('scheduledEvents') as PremierEvent[]) || [];
    const event = scheduledEvents.find((e) => e.eventId === eventId);

    if (!event) {
      await interaction.reply({ content: 'Event not found.', ephemeral: true });
      return;
    }

    try {
      const pendingEdit = pendingEdits.get(interaction.user.id);
      if (!pendingEdit) {
        await interaction.reply({
          content: 'Session expired. Please start over.',
          ephemeral: true,
        });
        return;
      }

      const guild = await bot.guilds.fetch(pendingEdit.guildId);
      const members = await guild.members.fetch({ user: Array.from(allUserIds) });

      const options = Array.from(members.values()).map((member) => ({
        label: member.displayName,
        description: member.user.tag,
        value: member.id,
      }));

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`dm-select-user-${interaction.user.id}`)
        .setPlaceholder(`Select a user to ${action}`)
        .addOptions(options.slice(0, 25)); // Discord limit

      const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

      await interaction.reply({
        content: `Select a user to ${action}:`,
        components: [row],
        ephemeral: true,
      });
    } catch {
      await interaction.reply({
        content: 'Failed to load users. Please try again.',
        ephemeral: true,
      });
    }
  }

  @SelectMenuComponent({ id: /^dm-select-user-.*/ })
  async handleUserSelect(interaction: StringSelectMenuInteraction): Promise<void> {
    const userId = interaction.user.id;
    const selectedUserId = interaction.values[0];
    const pendingEdit = pendingEdits.get(userId);

    if (!pendingEdit || !pendingEdit.action) {
      await interaction.reply({ content: 'Session expired. Please start over.', ephemeral: true });
      return;
    }

    pendingEdit.selectedUserId = selectedUserId;
    pendingEdits.set(userId, pendingEdit);

    if (pendingEdit.action === 'remove') {
      // Execute remove immediately
      await this.executeRemove(interaction, pendingEdit.eventId, selectedUserId);
    } else {
      // Show target list selection
      await this.showTargetListMenu(interaction, pendingEdit.action);
    }
  }

  private async showTargetListMenu(
    interaction: StringSelectMenuInteraction,
    action: 'add' | 'move',
  ): Promise<void> {
    const acceptedButton = new ButtonBuilder()
      .setCustomId(`dm-target-accepted-${interaction.user.id}`)
      .setLabel('Accepted')
      .setStyle(ButtonStyle.Success);

    const declinedButton = new ButtonBuilder()
      .setCustomId(`dm-target-declined-${interaction.user.id}`)
      .setLabel('Declined')
      .setStyle(ButtonStyle.Danger);

    const tentativeButton = new ButtonBuilder()
      .setCustomId(`dm-target-tentative-${interaction.user.id}`)
      .setLabel('Tentative')
      .setStyle(ButtonStyle.Secondary);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      acceptedButton,
      declinedButton,
      tentativeButton,
    );

    await interaction.update({
      content: `${action === 'add' ? 'Add' : 'Move'} user to which list?`,
      components: [row],
    });
  }

  @ButtonComponent({ id: /^dm-target-(accepted|declined|tentative)-.*/ })
  async handleTargetListButton(interaction: ButtonInteraction): Promise<void> {
    const userId = interaction.user.id;
    const pendingEdit = pendingEdits.get(userId);

    if (!pendingEdit || !pendingEdit.selectedUserId || !pendingEdit.action) {
      await interaction.reply({ content: 'Session expired. Please start over.', ephemeral: true });
      return;
    }

    const targetList = interaction.customId.split('-')[2] as 'accepted' | 'declined' | 'tentative';

    if (pendingEdit.action === 'add') {
      await this.executeAdd(
        interaction,
        pendingEdit.eventId,
        pendingEdit.selectedUserId,
        targetList,
      );
    } else if (pendingEdit.action === 'move') {
      await this.executeMove(
        interaction,
        pendingEdit.eventId,
        pendingEdit.selectedUserId,
        targetList,
      );
    }

    // Reset for next action
    pendingEdit.action = undefined;
    pendingEdit.selectedUserId = undefined;
    pendingEdits.set(userId, pendingEdit);
  }

  private async executeAdd(
    interaction: ButtonInteraction,
    eventId: string,
    targetUserId: string,
    targetList: 'accepted' | 'declined' | 'tentative',
  ): Promise<void> {
    const responses = (this.db.get(`${eventId}_responses`) as EventResponses) || {
      accepted: [],
      declined: [],
      tentative: [],
    };

    // Remove from all lists first (prevent duplicates)
    responses.accepted = responses.accepted.filter((id) => id !== targetUserId);
    responses.declined = responses.declined.filter((id) => id !== targetUserId);
    responses.tentative = responses.tentative.filter((id) => id !== targetUserId);

    // Add to target list
    responses[targetList].push(targetUserId);
    this.db.set(`${eventId}_responses`, responses);

    await interaction.update({
      content: `✅ Added <@${targetUserId}> to ${targetList}.`,
      components: [],
    });

    // Update the event message
    const scheduledEvents = (this.db.get('scheduledEvents') as PremierEvent[]) || [];
    const event = scheduledEvents.find((e) => e.eventId === eventId);
    if (event) {
      await this.updateEventMessage(event, responses);
    }
  }

  private async executeMove(
    interaction: ButtonInteraction,
    eventId: string,
    targetUserId: string,
    targetList: 'accepted' | 'declined' | 'tentative',
  ): Promise<void> {
    const responses = (this.db.get(`${eventId}_responses`) as EventResponses) || {
      accepted: [],
      declined: [],
      tentative: [],
    };

    // Remove from all lists
    responses.accepted = responses.accepted.filter((id) => id !== targetUserId);
    responses.declined = responses.declined.filter((id) => id !== targetUserId);
    responses.tentative = responses.tentative.filter((id) => id !== targetUserId);

    // Add to target list
    responses[targetList].push(targetUserId);
    this.db.set(`${eventId}_responses`, responses);

    await interaction.update({
      content: `✅ Moved <@${targetUserId}> to ${targetList}.`,
      components: [],
    });

    // Update the event message
    const scheduledEvents = (this.db.get('scheduledEvents') as PremierEvent[]) || [];
    const event = scheduledEvents.find((e) => e.eventId === eventId);
    if (event) {
      await this.updateEventMessage(event, responses);
    }
  }

  private async executeRemove(
    interaction: StringSelectMenuInteraction,
    eventId: string,
    targetUserId: string,
  ): Promise<void> {
    const responses = (this.db.get(`${eventId}_responses`) as EventResponses) || {
      accepted: [],
      declined: [],
      tentative: [],
    };

    // Remove from all lists
    responses.accepted = responses.accepted.filter((id) => id !== targetUserId);
    responses.declined = responses.declined.filter((id) => id !== targetUserId);
    responses.tentative = responses.tentative.filter((id) => id !== targetUserId);

    this.db.set(`${eventId}_responses`, responses);

    await interaction.update({
      content: `✅ Removed <@${targetUserId}> from all lists.`,
      components: [],
    });

    // Update the event message
    const scheduledEvents = (this.db.get('scheduledEvents') as PremierEvent[]) || [];
    const event = scheduledEvents.find((e) => e.eventId === eventId);
    if (event) {
      await this.updateEventMessage(event, responses);
    }
  }

  private async handleManageResponsesInput(message: Message, eventId: string): Promise<void> {
    const userId = message.author.id;
    const content = message.content.toLowerCase().trim();

    if (content === 'done') {
      pendingEdits.delete(userId);
      try {
        await message.reply('✅ Done managing responses.');
      } catch {
        try {
          await message.author.send('✅ Done managing responses.');
        } catch {
          // Silent fail
        }
      }
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
    if (!event.messageId) {
      return;
    }

    try {
      const channelMention =
        event.type === 'Practice' || event.type === 'Playoff'
          ? (this.db.get('practiceChannel') as string)
          : (this.db.get('matchChannel') as string);
      const channelId = channelMention?.replace(/[<>#]/g, '');

      if (!channelId) {
        return;
      }

      const channel = await bot.channels.fetch(channelId);

      if (!channel?.isTextBased()) {
        return;
      }

      const message = await channel.messages.fetch(event.messageId);

      const currentEmbed = message.embeds[0];

      if (!currentEmbed) {
        return;
      }

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
    } catch {
      // Silent fail
    }
  }
}
