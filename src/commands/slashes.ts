import {
  ApplicationCommandOptionType,
  type Channel,
  MessageFlags,
  TextDisplayBuilder,
  type CommandInteraction,
  APIEmbed,
  EmbedType,
} from 'discord.js';
import { Discord, Guard, Slash, SlashOption } from 'discordx';
import Enmap from 'enmap';
import { IsManager } from '../guards/manager.js';
import { IsAdmin } from '../guards/admin.js';
import { OrGuard } from '../guards/or.js';

@Discord()
export class Slashes {
  private db = new Enmap({ name: 'premier_data' });

  @Slash({ description: 'Gets the current settings for the bot' })
  @Guard(OrGuard(IsManager, IsAdmin))
  async status(interaction: CommandInteraction): Promise<void> {
    const embed: APIEmbed = {
      title: 'Current Bot Settings',
      type: EmbedType.Rich,
      color: 0xffffff,
      fields: [
        {
          name: 'Current Act',
          value: `${this.db.get('act') || 'Not set'}`,
          inline: true,
        },
        {
          name: 'Start Date',
          value: `${(this.db.get('startDate') as Date)?.toLocaleDateString() || 'Not set'}`,
          inline: true,
        },
        { name: '\u200B', value: '\u200B', inline: true },
        {
          name: 'Announcement Channel',
          value: `${this.db.get('announcementChannel') || 'Not set'}`,
          inline: true,
        },
        {
          name: 'Match Channel',
          value: `${this.db.get('matchChannel') || 'Not set'}`,
          inline: true,
        },
        {
          name: 'Practice Channel',
          value: `${this.db.get('practiceChannel') || 'Not set'}`,
          inline: true,
        },
      ],
    };

    await interaction.reply({
      embeds: [embed],
      components: [],
      flags: [],
    });
  }

  @Slash({
    description: 'Set the channels for announcements, matches, and practices',
  })
  @Guard(OrGuard(IsManager, IsAdmin))
  async channels(
    @SlashOption({
      description: 'Announcement channel',
      name: 'announcements',
      required: false,
      type: ApplicationCommandOptionType.Channel,
    })
    announcementChannel: Channel | undefined,
    @SlashOption({
      description: 'Match channel',
      name: 'match',
      required: false,
      type: ApplicationCommandOptionType.Channel,
    })
    matchChannel: Channel | undefined,
    @SlashOption({
      description: 'Practice channel',
      name: 'practice',
      required: false,
      type: ApplicationCommandOptionType.Channel,
    })
    practiceChannel: Channel | undefined,
    interaction: CommandInteraction,
  ): Promise<void> {
    if (announcementChannel) {
      this.db.set('announcementChannel', announcementChannel.toString());
    }
    if (matchChannel) {
      this.db.set('matchChannel', matchChannel.toString());
    }
    if (practiceChannel) {
      this.db.set('practiceChannel', practiceChannel.toString());
    }

    interaction.reply({
      components: [
        new TextDisplayBuilder().setContent(
          `Announcement channel set to: ${this.db.get('announcementChannel') || 'None'}`,
        ),
        new TextDisplayBuilder().setContent(
          `Matches channel set to: ${this.db.get('matchChannel') || 'None'}`,
        ),
        new TextDisplayBuilder().setContent(
          `Practice channel set to: ${this.db.get('practiceChannel') || 'None'}`,
        ),
      ],
      flags: [MessageFlags.IsComponentsV2, MessageFlags.Ephemeral],
    });
  }
}
