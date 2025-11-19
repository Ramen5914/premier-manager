import { MessageFlags, type CommandInteraction, EmbedBuilder } from 'discord.js';
import { Discord, Guard, Slash } from 'discordx';
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
    const maps = (this.db.get('maps') as string[]) || [];
    const mapsDisplay =
      maps.length > 0
        ? maps.map((map, index) => `Week ${index + 1}: **${map}**`).join('\n')
        : 'Not set';

    const embed = new EmbedBuilder()
      .setTitle('Current Bot Settings')
      .setColor(0x98c379)
      .addFields(
        {
          name: 'Current Season',
          value: `${this.db.get('season') || 'Not set'}`,
          inline: true,
        },
        {
          name: 'Start Date',
          value: `${(this.db.get('startDate') as Date)?.toLocaleDateString() || 'Not set'}`,
          inline: true,
        },
      )
      .addFields({ name: '\u200B', value: '\u200B', inline: true })
      .addFields(
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
      )
      .addFields(
        {
          name: 'Owner Role',
          value: `${this.db.get('ownerRoleId') || 'Not set'}`,
          inline: true,
        },
        {
          name: 'Captain Role',
          value: `${this.db.get('captainRoleId') || 'Not set'}`,
          inline: true,
        },
        {
          name: 'Team Role',
          value: `${this.db.get('teamRoleId') || 'Not set'}`,
          inline: true,
        },
      )
      .addFields({
        name: 'Map Order',
        value: mapsDisplay,
        inline: false,
      })
      .setTimestamp();

    await interaction.reply({
      embeds: [embed],
      components: [],
      flags: [MessageFlags.Ephemeral],
    });
  }
}
