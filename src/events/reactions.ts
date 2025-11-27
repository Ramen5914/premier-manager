import { ButtonComponent, Discord } from 'discordx';
import { type ButtonInteraction, EmbedBuilder, type Guild } from 'discord.js';
import Enmap from 'enmap';
import type { PremierEvent } from '../types/event.js';

@Discord()
export class MatchResultHandler {
  private db = new Enmap({ name: 'premier_data' });

  @ButtonComponent({ id: /^match1_result_.*/ })
  async handleMatch1Result(interaction: ButtonInteraction): Promise<void> {
    await this.handleMatchResult(interaction, 'match1');
  }

  @ButtonComponent({ id: /^match2_result_.*/ })
  async handleMatch2Result(interaction: ButtonInteraction): Promise<void> {
    await this.handleMatchResult(interaction, 'match2');
  }

  private async handleMatchResult(
    interaction: ButtonInteraction,
    matchNumber: 'match1' | 'match2',
  ): Promise<void> {
    if (!interaction.guild) return;

    const guild = interaction.guild as Guild;
    const teamRoleId = (this.db.get('teamRoleId') as string)?.replace(/[<>@&]/g, '');
    const member = await guild.members.fetch(interaction.user.id).catch(() => null);
    if (!member) return;

    if (!teamRoleId || !member.roles.cache.has(teamRoleId)) {
      await interaction.reply({
        content: 'Only team members can record match results.',
        ephemeral: true,
      });
      return;
    }

    const scheduledEvents = (this.db.get('scheduledEvents') as PremierEvent[]) || [];
    const event = scheduledEvents.find(
      (e) => e.postMatchPromptMessageId === interaction.message.id,
    );

    if (!event) {
      await interaction.reply({
        content: 'Event not found.',
        ephemeral: true,
      });
      return;
    }

    const [, , result] = interaction.customId.split('_');
    const resultValue = result as 'win' | 'loss' | 'unplayed';

    if (matchNumber === 'match1') {
      event.match1Result = resultValue;
    } else {
      event.match2Result = resultValue;
    }

    const currentScore = (this.db.get('score') as number) || 0;
    let newScore = currentScore;
    let scoreChange = 0;

    if (resultValue === 'win') {
      scoreChange = 100;
      newScore += 100;
    } else if (resultValue === 'loss') {
      scoreChange = 25;
      newScore += 25;
    }

    this.db.set('score', newScore);
    event.postMatchCountRecorded = true;

    const idx = scheduledEvents.findIndex((e) => e.eventId === event.eventId);
    if (idx !== -1) scheduledEvents[idx] = event;
    this.db.set('scheduledEvents', scheduledEvents);

    const qualificationThreshold = 600;
    const qualified = newScore >= qualificationThreshold;
    const resultEmoji = resultValue === 'win' ? '🏆' : resultValue === 'loss' ? '💔' : '⏸️';

    const embed = new EmbedBuilder()
      .setTitle(`Match ${matchNumber === 'match1' ? '1' : '2'} Result Recorded`)
      .setColor(resultValue === 'win' ? 0x98c379 : resultValue === 'loss' ? 0xe06c75 : 0x61afef)
      .addFields(
        { name: 'Result', value: `${resultEmoji} ${resultValue.toUpperCase()}`, inline: true },
        {
          name: 'Score Change',
          value: scoreChange > 0 ? `+${scoreChange} points` : 'No change',
          inline: true,
        },
      )
      .addFields({
        name: 'Current Score',
        value: `${newScore} points\n${qualified ? '✅ Qualified for Playoffs' : `❌ Need ${qualificationThreshold - newScore} more points`}`,
        inline: false,
      })
      .setTimestamp();

    await interaction.reply({
      embeds: [embed],
    });

    try {
      const originalMessage = await interaction.message.fetch();
      const updatedEmbed = EmbedBuilder.from(originalMessage.embeds[0])
        .setDescription(
          `Match 1: ${event.match1Result ? `${event.match1Result === 'win' ? '🏆 Win' : event.match1Result === 'loss' ? '💔 Loss' : '⏸️ Unplayed'}` : '❓ Not recorded'}\n` +
            `Match 2: ${event.match2Result ? `${event.match2Result === 'win' ? '🏆 Win' : event.match2Result === 'loss' ? '💔 Loss' : '⏸️ Unplayed'}` : '❓ Not recorded'}`,
        )
        .setColor(0x98c379);

      await originalMessage.edit({
        embeds: [updatedEmbed],
        components: originalMessage.components,
      });
    } catch {
      // Ignore edit errors
    }
  }
}
