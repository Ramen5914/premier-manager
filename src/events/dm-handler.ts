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
    console.log(
      `[DMHandler] setPendingEdit called: userId=${userId}, eventId=${eventId}, stage=${stage}, guildId=${guildId}`,
    );
    pendingEdits.set(userId, { eventId, stage, guildId });
    console.log(`[DMHandler] pendingEdits size: ${pendingEdits.size}`);
  }

  @On()
  async messageCreate([message]: ArgsOf<'messageCreate'>): Promise<void> {
    console.log(
      `[DMHandler.messageCreate] Message received. Channel type: ${message.channel.type}, Author bot: ${message.author.bot}`,
    );

    // Only handle DMs
    if (message.channel.type !== ChannelType.DM || message.author.bot) {
      console.log(`[DMHandler.messageCreate] Ignoring message (not DM or is bot)`);
      return;
    }

    const userId = message.author.id;
    const content = message.content.trim();

    console.log(
      `[DMHandler.messageCreate] DM from ${userId} (${message.author.tag}): "${content}"`,
    );
    console.log(`[DMHandler.messageCreate] Current pendingEdits size: ${pendingEdits.size}`);
    console.log(`[DMHandler.messageCreate] All pending users:`, Array.from(pendingEdits.keys()));

    // Check if user has a pending edit
    const pendingEdit = pendingEdits.get(userId);

    if (!pendingEdit) {
      console.log(`[DMHandler.messageCreate] No pending edit found for ${userId}`);
      return;
    }

    console.log(`[DMHandler.messageCreate] Found pending edit for ${userId}:`, pendingEdit);

    // Handle based on current stage
    try {
      if (pendingEdit.stage === 'main_menu') {
        console.log(`[DMHandler.messageCreate] Routing to handleMainMenu`);
        await this.handleMainMenu(message, pendingEdit.eventId, content);
      } else if (pendingEdit.stage === 'manage_responses') {
        console.log(`[DMHandler.messageCreate] Routing to handleManageResponsesInput`);
        await this.handleManageResponsesInput(message, pendingEdit.eventId);
      } else {
        console.log(`[DMHandler.messageCreate] Unknown stage: ${pendingEdit.stage}`);
      }
    } catch (err) {
      console.error('[DMHandler.messageCreate] Error handling message:', err);
      try {
        await message.reply('An error occurred while processing your request. Please try again.');
      } catch (e) {
        console.error('[DMHandler.messageCreate] Failed to send error reply:', e);
        try {
          await message.author.send('An error occurred while processing your request.');
        } catch (e2) {
          console.error('[DMHandler.messageCreate] Failed to send fallback DM:', e2);
        }
      }
    }
  }

  private async handleMainMenu(message: Message, eventId: string, content: string): Promise<void> {
    const userId = message.author.id;
    console.log(
      `[DMHandler.handleMainMenu] Called with userId=${userId}, eventId=${eventId}, content="${content}"`,
    );

    if (content === '0') {
      console.log(`[DMHandler.handleMainMenu] User selected cancel (0)`);
      pendingEdits.delete(userId);
      try {
        await message.reply('❌ Cancelled.');
      } catch (err) {
        console.error('[DMHandler.handleMainMenu] Failed to send cancel reply:', err);
      }
      return;
    }

    if (content === '1') {
      console.log(`[DMHandler.handleMainMenu] User selected manage responses (1)`);
      console.log(
        `[DMHandler.handleMainMenu] Setting stage to manage_responses BEFORE calling handleManageResponses`,
      );

      // Set stage BEFORE attempting to send (reuse existing guildId)
      const currentEdit = pendingEdits.get(userId);
      if (!currentEdit) {
        await message.reply('Session expired. Please restart from the edit button.');
        return;
      }
      currentEdit.stage = 'manage_responses';
      pendingEdits.set(userId, currentEdit);
      console.log(
        `[DMHandler.handleMainMenu] Stage set. Current pendingEdit:`,
        pendingEdits.get(userId),
      );

      try {
        console.log(`[DMHandler.handleMainMenu] Calling handleManageResponses...`);
        await this.handleManageResponses(message, eventId);
        console.log(`[DMHandler.handleMainMenu] handleManageResponses completed successfully`);
      } catch (err) {
        console.error('[DMHandler.handleMainMenu] handleManageResponses threw error:', err);
        try {
          await message.author.send(
            'Unable to send the manage responses menu in this DM. Please check your privacy settings.',
          );
        } catch (e) {
          console.error('[DMHandler.handleMainMenu] Fallback send failed:', e);
        }
      }
      return;
    }

    if (content === '2') {
      console.log(`[DMHandler.handleMainMenu] User selected cancel event (2)`);
      try {
        await message.reply('Cancel event feature coming soon!');
      } catch (err) {
        console.error('[DMHandler.handleMainMenu] Failed to reply for option 2:', err);
      }
      pendingEdits.delete(userId);
      return;
    }

    if (content === '3') {
      console.log(`[DMHandler.handleMainMenu] User selected change map (3)`);
      try {
        await message.reply('Change map feature coming soon!');
      } catch (err) {
        console.error('[DMHandler.handleMainMenu] Failed to reply for option 3:', err);
      }
      pendingEdits.delete(userId);
      return;
    }

    if (content === '4') {
      console.log(`[DMHandler.handleMainMenu] User selected reschedule (4)`);
      try {
        await message.reply('Reschedule feature coming soon!');
      } catch (err) {
        console.error('[DMHandler.handleMainMenu] Failed to reply for option 4:', err);
      }
      pendingEdits.delete(userId);
      return;
    }

    if (content === '5') {
      console.log(`[DMHandler.handleMainMenu] User selected mark completed (5)`);
      try {
        await message.reply('Mark completed feature coming soon!');
      } catch (err) {
        console.error('[DMHandler.handleMainMenu] Failed to reply for option 5:', err);
      }
      pendingEdits.delete(userId);
      return;
    }

    console.log(`[DMHandler.handleMainMenu] Invalid option selected: "${content}"`);
    try {
      await message.reply('Invalid option. Please reply with 0-5.');
    } catch (err) {
      console.error('[DMHandler.handleMainMenu] Failed to reply for invalid option:', err);
    }
  }

  private async handleManageResponses(message: Message, eventId: string): Promise<void> {
    const userId = message.author.id;
    console.log(
      `[DMHandler.handleManageResponses] Called with userId=${userId}, eventId=${eventId}`,
    );

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

    console.log(`[DMHandler.handleManageResponses] About to send message with buttons`);
    try {
      const reply = await message.reply({ content: helpText, components: [row] });
      console.log(
        `[DMHandler.handleManageResponses] Successfully sent reply. Message ID: ${reply.id}`,
      );
    } catch (err) {
      console.error('[DMHandler.handleManageResponses] message.reply failed with error:', err);
      console.log(`[DMHandler.handleManageResponses] Attempting fallback: message.author.send`);
      try {
        const dm = await message.author.send({ content: helpText, components: [row] });
        console.log(
          `[DMHandler.handleManageResponses] Fallback DM sent successfully. Message ID: ${dm.id}`,
        );
      } catch (e) {
        console.error(
          '[DMHandler.handleManageResponses] Fallback message.author.send also failed:',
          e,
        );
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
        event.type === 'Practice'
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
    } catch (error) {
      console.error('[DMHandler.showUserSelectMenu] Error:', error);
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

    console.log(
      `[DMHandler.handleManageResponsesInput] Called with userId=${userId}, eventId=${eventId}, content="${content}"`,
    );

    if (content === 'done') {
      console.log(`[DMHandler.handleManageResponsesInput] User typed 'done', cleaning up`);
      pendingEdits.delete(userId);
      try {
        await message.reply('✅ Done managing responses.');
      } catch (err) {
        console.error('[DMHandler.handleManageResponsesInput] Failed to send done reply:', err);
        try {
          await message.author.send('✅ Done managing responses.');
        } catch (e) {
          console.error('[DMHandler.handleManageResponsesInput] Fallback done message failed:', e);
        }
      }
      return;
    }

    // Parse commands
    const moveMatch = content.match(/^move <@!?(\d+)> to (accepted|declined|tentative)$/);
    const removeMatch = content.match(/^remove <@!?(\d+)>$/);
    const addMatch = content.match(/^add <@!?(\d+)> to (accepted|declined|tentative)$/);

    console.log(
      `[DMHandler.handleManageResponsesInput] Command parsing: moveMatch=${!!moveMatch}, removeMatch=${!!removeMatch}, addMatch=${!!addMatch}`,
    );

    if (!moveMatch && !removeMatch && !addMatch) {
      console.log(`[DMHandler.handleManageResponsesInput] No valid command matched`);
      await message.reply('Invalid command. Please use the format shown above.');
      return;
    }

    // Find the specific event being edited
    const scheduledEvents = (this.db.get('scheduledEvents') as PremierEvent[]) || [];
    const targetEvent = scheduledEvents.find((e) => e.eventId === eventId);

    if (!targetEvent) {
      console.error(
        `[DMHandler.handleManageResponsesInput] Could not find event with ID: ${eventId}`,
      );
      await message.reply('Could not find event to edit.');
      return;
    }

    console.log(
      `[DMHandler.handleManageResponsesInput] Found target event: ${targetEvent.eventId}`,
    );

    const responses =
      (this.db.get(`${targetEvent.eventId}_responses`) as EventResponses) ||
      ({ accepted: [], declined: [], tentative: [] } as EventResponses);

    if (moveMatch) {
      const [, targetUserId, targetList] = moveMatch;
      console.log(
        `[DMHandler.handleManageResponsesInput] Moving user ${targetUserId} to ${targetList}`,
      );
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
      console.log(`[DMHandler.handleManageResponsesInput] Removing user ${targetUserId}`);
      responses.accepted = responses.accepted.filter((id) => id !== targetUserId);
      responses.declined = responses.declined.filter((id) => id !== targetUserId);
      responses.tentative = responses.tentative.filter((id) => id !== targetUserId);
      this.db.set(`${targetEvent.eventId}_responses`, responses);
      await message.reply(`✅ Removed <@${targetUserId}> from all lists.`);
    } else if (addMatch) {
      const [, targetUserId, targetList] = addMatch;
      console.log(
        `[DMHandler.handleManageResponsesInput] Adding user ${targetUserId} to ${targetList}`,
      );
      // Remove from all lists first (prevent duplicates)
      responses.accepted = responses.accepted.filter((id) => id !== targetUserId);
      responses.declined = responses.declined.filter((id) => id !== targetUserId);
      responses.tentative = responses.tentative.filter((id) => id !== targetUserId);
      // Add to target list
      responses[targetList as keyof EventResponses].push(targetUserId);
      this.db.set(`${targetEvent.eventId}_responses`, responses);
      await message.reply(`✅ Added <@${targetUserId}> to ${targetList}.`);
    }

    console.log(`[DMHandler.handleManageResponsesInput] Calling updateEventMessage`);
    // Update the event message
    await this.updateEventMessage(targetEvent, responses);
  }

  private async updateEventMessage(event: PremierEvent, responses: EventResponses): Promise<void> {
    console.log(`[DMHandler.updateEventMessage] Called for event ${event.eventId}`);

    if (!event.messageId) {
      console.log(`[DMHandler.updateEventMessage] No messageId found for event ${event.eventId}`);
      return;
    }

    try {
      const channelMention =
        event.type === 'Practice'
          ? (this.db.get('practiceChannel') as string)
          : (this.db.get('matchChannel') as string);
      const channelId = channelMention?.replace(/[<>#]/g, '');

      console.log(
        `[DMHandler.updateEventMessage] Channel mention: ${channelMention}, extracted ID: ${channelId}`,
      );

      if (!channelId) {
        console.log(`[DMHandler.updateEventMessage] No valid channel ID`);
        return;
      }

      const channel = await bot.channels.fetch(channelId);
      console.log(
        `[DMHandler.updateEventMessage] Fetched channel: ${channel?.id}, isTextBased: ${channel?.isTextBased()}`,
      );

      if (!channel?.isTextBased()) {
        console.log(`[DMHandler.updateEventMessage] Channel is not text-based`);
        return;
      }

      const message = await channel.messages.fetch(event.messageId);
      console.log(`[DMHandler.updateEventMessage] Fetched message: ${message.id}`);

      const currentEmbed = message.embeds[0];

      if (!currentEmbed) {
        console.log(`[DMHandler.updateEventMessage] No embed found in message`);
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
      console.log(`[DMHandler.updateEventMessage] Successfully updated message embed`);
    } catch (error) {
      console.error('[DMHandler.updateEventMessage] Failed to update event message:', error);
    }
  }
}
