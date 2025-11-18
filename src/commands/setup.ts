// import { CronJob } from 'cron';
import {
  CommandInteraction,
  LabelBuilder,
  MessageFlags,
  ModalBuilder,
  ModalSubmitInteraction,
  TextDisplayBuilder,
  TextInputStyle,
} from 'discord.js';
import { Discord, Guard, ModalComponent, Slash } from 'discordx';
import Enmap from 'enmap';
import { IsAdmin } from '../guards/admin.js';
import { IsManager } from '../guards/manager.js';
import { OrGuard } from '../guards/or.js';

@Discord()
export class Setup {
  // private jobs: CronJob[] = [];

  private db = new Enmap({ name: 'premier_data' });

  @Slash({ description: 'Setup premier year/act and start date.' })
  @Guard(OrGuard(IsManager, IsAdmin))
  setup(interaction: CommandInteraction): void {
    const modal = new ModalBuilder().setTitle('Premier Setup').setCustomId('premierSetupModal');

    const yearActInputComponent = new LabelBuilder()
      .setLabel('Current Act')
      .setStringSelectMenuComponent((builder) =>
        builder
          .setCustomId('actSelect')
          .addOptions([
            { label: '1', value: '1' },
            { label: '2', value: '2' },
            { label: '3', value: '3' },
            { label: '4', value: '4' },
            { label: '5', value: '5' },
            { label: '6', value: '6' },
          ])
          .setRequired(true)
          .setPlaceholder('Select the current act'),
      );

    const startDateInputComponent = new LabelBuilder()
      .setLabel('Start Date')
      .setDescription(`Format: MM/DD/YYYY`)
      .setTextInputComponent((builder) =>
        builder
          .setCustomId('startDateField')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(10)
          .setMinLength(8),
      );

    modal.addLabelComponents(yearActInputComponent, startDateInputComponent);

    interaction.showModal(modal);
  }

  @ModalComponent({ id: 'premierSetupModal' })
  async setupFormHandler(interaction: ModalSubmitInteraction): Promise<void> {
    const startDate = new Date(interaction.fields.getTextInputValue('startDateField'));
    const act = interaction.fields.getStringSelectValues('actSelect')[0];

    if (isNaN(startDate.getTime())) {
      await interaction.reply({
        components: [
          new TextDisplayBuilder().setContent('Invalid date format. Please use MM/DD/YYYY.'),
        ],
        flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2],
      });

      return;
    }

    const season = `V${startDate.getFullYear().toString().slice(2)}A${act}`;

    this.db.set('season', season);
    this.db.set('startDate', startDate);

    await interaction.reply({
      components: [
        new TextDisplayBuilder().setContent(
          `Season set to ${season} with start date ${startDate.toLocaleDateString()}.`,
        ),
      ],
      flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2],
    });
  }
}
