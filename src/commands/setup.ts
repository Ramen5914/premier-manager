// import { CronJob } from 'cron';
import {
  ApplicationCommandOptionType,
  type Channel,
  CommandInteraction,
  LabelBuilder,
  MessageFlags,
  ModalBuilder,
  ModalSubmitInteraction,
  type Role,
  TextDisplayBuilder,
  TextInputStyle,
} from 'discord.js';
import { Discord, Guard, ModalComponent, Slash, SlashOption } from 'discordx';
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

  @Slash({
    description: 'Set the channels for announcements, matches, and practices',
  })
  @Guard(OrGuard(IsManager, IsAdmin))
  async roles(
    @SlashOption({
      description: 'Owner role',
      name: 'owner',
      required: false,
      type: ApplicationCommandOptionType.Role,
    })
    ownerRole: Role | undefined,
    @SlashOption({
      description: 'Captain role',
      name: 'captain',
      required: false,
      type: ApplicationCommandOptionType.Role,
    })
    captainRole: Role | undefined,
    @SlashOption({
      description: 'Team role',
      name: 'team',
      required: false,
      type: ApplicationCommandOptionType.Role,
    })
    teamRole: Role | undefined,
    interaction: CommandInteraction,
  ): Promise<void> {
    if (ownerRole) {
      this.db.set('ownerRoleId', ownerRole.toString());
    }
    if (captainRole) {
      this.db.set('captainRoleId', captainRole.toString());
    }
    if (teamRole) {
      this.db.set('teamRoleId', teamRole.toString());
    }

    interaction.reply({
      components: [
        new TextDisplayBuilder().setContent(
          `Owner role set to: ${this.db.get('ownerRoleId') || 'None'}`,
        ),
        new TextDisplayBuilder().setContent(
          `Captain role set to: ${this.db.get('captainRoleId') || 'None'}`,
        ),
        new TextDisplayBuilder().setContent(
          `Team role set to: ${this.db.get('teamRoleId') || 'None'}`,
        ),
      ],
      flags: [MessageFlags.IsComponentsV2, MessageFlags.Ephemeral],
    });
  }
}
