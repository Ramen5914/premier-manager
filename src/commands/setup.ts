import {
  ApplicationCommandOptionType,
  type Channel,
  CommandInteraction,
  EmbedBuilder,
  LabelBuilder,
  MessageFlags,
  ModalBuilder,
  ModalSubmitInteraction,
  type Role,
  TextDisplayBuilder,
  TextInputStyle,
} from 'discord.js';
import { Client, Discord, Guard, ModalComponent, Slash, SlashChoice, SlashOption } from 'discordx';
import Enmap from 'enmap';
import { maps } from '../constants.js';
import { IsAdmin } from '../guards/admin.js';
import { IsManager } from '../guards/manager.js';
import { OrGuard } from '../guards/or.js';
import { formatEventDate } from '../utils/date.js';
import type { PremierEvent } from '../types/event.js';
import { sendEventAnnouncements } from '../services/scheduler.js';

@Discord()
export class Setup {
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
  async premierSetupFormHandler(interaction: ModalSubmitInteraction): Promise<void> {
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

    // Validate that the start date is a Wednesday (day 3)
    if (startDate.getDay() !== 3) {
      const dayNames = [
        'Sunday',
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
        'Saturday',
      ];
      const selectedDay = dayNames[startDate.getDay()];

      await interaction.reply({
        components: [
          new TextDisplayBuilder().setContent(
            `You selected a ${selectedDay}. Start date must be a Wednesday (when practice starts). Please use MM/DD/YYYY format.`,
          ),
        ],
        flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2],
      });

      return;
    }

    const season = `V${startDate.getFullYear().toString().slice(2)}A${act}`;

    this.db.set('season', season);
    this.db.set('startDate', startDate);
    this.db.set('score', 0);

    await interaction.reply({
      components: [
        new TextDisplayBuilder().setContent(
          `Season set to ${season} with start date ${startDate.toLocaleDateString()}. Score reset to 0.`,
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

  @Slash({ description: 'Setup the map for each week of premier.' })
  @Guard(OrGuard(IsManager, IsAdmin))
  async maps(
    @SlashChoice(...maps)
    @SlashOption({
      description: 'Map for week 1',
      name: 'week1',
      required: true,
      type: ApplicationCommandOptionType.String,
    })
    week1: string,
    @SlashChoice(...maps)
    @SlashOption({
      description: 'Map for week 2',
      name: 'week2',
      required: true,
      type: ApplicationCommandOptionType.String,
    })
    week2: string,
    @SlashChoice(...maps)
    @SlashOption({
      description: 'Map for week 3',
      name: 'week3',
      required: true,
      type: ApplicationCommandOptionType.String,
    })
    week3: string,
    @SlashChoice(...maps)
    @SlashOption({
      description: 'Map for week 4',
      name: 'week4',
      required: true,
      type: ApplicationCommandOptionType.String,
    })
    week4: string,
    @SlashChoice(...maps)
    @SlashOption({
      description: 'Map for week 5',
      name: 'week5',
      required: true,
      type: ApplicationCommandOptionType.String,
    })
    week5: string,
    @SlashChoice(...maps)
    @SlashOption({
      description: 'Map for week 6',
      name: 'week6',
      required: true,
      type: ApplicationCommandOptionType.String,
    })
    week6: string,
    @SlashChoice(...maps)
    @SlashOption({
      description: 'Map for week 7',
      name: 'week7',
      required: true,
      type: ApplicationCommandOptionType.String,
    })
    week7: string,
    interaction: CommandInteraction,
  ): Promise<void> {
    const mapsArray: string[] = [week1, week2, week3, week4, week5, week6, week7];

    // Validate that all maps are unique
    if (new Set(mapsArray).size !== mapsArray.length) {
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle('Map Setup Error')
            .setDescription('Each week must have a different map.')
            .setColor(0xe06c75)
            .setTimestamp(),
        ],
        flags: [MessageFlags.Ephemeral],
      });
      return;
    }

    this.db.set('maps', mapsArray);

    const embed = new EmbedBuilder()
      .setTitle('Map Setup')
      .setColor(0x98c379)
      .setFields(
        mapsArray.map((map, index) => ({
          name: `Week ${index + 1}`,
          value: map,
          inline: true,
        })),
      )
      .setTimestamp();

    await interaction.reply({
      embeds: [embed],
      flags: [MessageFlags.Ephemeral],
    });
  }

  @Slash({ description: 'Generate all premier events for the season.', name: 'generateevents' })
  @Guard(OrGuard(IsManager, IsAdmin))
  async generateEvents(interaction: CommandInteraction, client: Client): Promise<void> {
    // Validate all required settings exist
    const requiredFields = {
      season: this.db.get('season'),
      startDate: this.db.get('startDate'),
      maps: this.db.get('maps'),
      teamRoleId: this.db.get('teamRoleId'),
      ownerRoleId: this.db.get('ownerRoleId'),
      captainRoleId: this.db.get('captainRoleId'),
      matchChannel: this.db.get('matchChannel'),
      practiceChannel: this.db.get('practiceChannel'),
      announcementChannel: this.db.get('announcementChannel'),
    };

    const missingFields: string[] = [];
    for (const [key, value] of Object.entries(requiredFields)) {
      if (!value) {
        missingFields.push(key);
      }
    }

    if (missingFields.length > 0) {
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle('Cannot Generate Events')
            .setDescription(
              `The following required settings are missing:\n${missingFields.map((f) => `• ${f}`).join('\n')}`,
            )
            .setColor(0xe06c75)
            .setTimestamp(),
        ],
        flags: [MessageFlags.Ephemeral],
      });
      return;
    }

    const season = requiredFields.season as string;
    const startDate = new Date(requiredFields.startDate as Date);
    const mapsArray = requiredFields.maps as string[];

    // Clear existing events and responses
    const existingEvents = (this.db.get('scheduledEvents') as PremierEvent[]) || [];
    for (const event of existingEvents) {
      this.db.delete(`${event.eventId}_responses`);
    }
    this.db.delete('scheduledEvents');

    // Store event creator
    this.db.set('eventCreatorId', interaction.user.id);

    // Generate 35 events (5 per week for 7 weeks, except Week 7 has special schedule)
    const events: PremierEvent[] = [];
    const timezone = 'America/Los_Angeles';

    for (let week = 0; week < 7; week++) {
      const weekNumber = week + 1;
      const map = mapsArray[week];
      const isWeek7 = weekNumber === 7;

      // Calculate the base date for this week (Wednesday of the week)
      const baseDate = new Date(startDate);
      baseDate.setDate(startDate.getDate() + week * 7);

      // Wednesday Practice: 7pm-8pm (skip on Week 7)
      if (!isWeek7) {
        const wedPractice = new Date(
          baseDate.toLocaleString('en-US', {
            timeZone: timezone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
          }) + ' 19:00:00',
        );
        const wedPracticeEnd = new Date(wedPractice);
        wedPracticeEnd.setHours(wedPracticeEnd.getHours() + 1);

        events.push({
          week: weekNumber,
          type: 'Practice',
          startTimestamp: Math.floor(wedPractice.getTime() / 1000),
          endTimestamp: Math.floor(wedPracticeEnd.getTime() / 1000),
          day: 'Wednesday',
          map,
          eventId: `${season}-W${weekNumber}-Practice-Wed`,
          rosterAnnouncementMessageId: null,
          messageId: null,
          threadId: null,
          threadRosterMessageId: null,
          preEventReminderSent: false,
          postMatchPromptMessageId: null,
          postMatchCountRecorded: false,
          signupsDisabled: false,
        });
      }

      // Thursday Match: 7pm-8pm
      const thuMatch = new Date(baseDate);
      thuMatch.setDate(baseDate.getDate() + 1);
      const thuMatchDate = new Date(
        thuMatch.toLocaleString('en-US', {
          timeZone: timezone,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }) + ' 19:00:00',
      );
      const thuMatchEnd = new Date(thuMatchDate);
      thuMatchEnd.setHours(thuMatchEnd.getHours() + 1);

      events.push({
        week: weekNumber,
        type: 'Match',
        startTimestamp: Math.floor(thuMatchDate.getTime() / 1000),
        endTimestamp: Math.floor(thuMatchEnd.getTime() / 1000),
        day: 'Thursday',
        map,
        eventId: `${season}-W${weekNumber}-Match-Thu`,
        rosterAnnouncementMessageId: null,
        messageId: null,
        threadId: null,
        threadRosterMessageId: null,
        preEventReminderSent: false,
        postMatchPromptMessageId: null,
        postMatchCountRecorded: false,
        signupsDisabled: false,
      });

      // Friday Practice: 8pm-9pm (skip on Week 7)
      if (!isWeek7) {
        const friPractice = new Date(baseDate);
        friPractice.setDate(baseDate.getDate() + 2);
        const friPracticeDate = new Date(
          friPractice.toLocaleString('en-US', {
            timeZone: timezone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
          }) + ' 20:00:00',
        );
        const friPracticeEnd = new Date(friPracticeDate);
        friPracticeEnd.setHours(friPracticeEnd.getHours() + 1);

        events.push({
          week: weekNumber,
          type: 'Practice',
          startTimestamp: Math.floor(friPracticeDate.getTime() / 1000),
          endTimestamp: Math.floor(friPracticeEnd.getTime() / 1000),
          day: 'Friday',
          map,
          eventId: `${season}-W${weekNumber}-Practice-Fri`,
          rosterAnnouncementMessageId: null,
          messageId: null,
          threadId: null,
          threadRosterMessageId: null,
          preEventReminderSent: false,
          postMatchPromptMessageId: null,
          postMatchCountRecorded: false,
          signupsDisabled: false,
        });
      }

      // Saturday Match: 8pm-9pm
      const satMatch = new Date(baseDate);
      satMatch.setDate(baseDate.getDate() + 3);
      const satMatchDate = new Date(
        satMatch.toLocaleString('en-US', {
          timeZone: timezone,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }) + ' 20:00:00',
      );
      const satMatchEnd = new Date(satMatchDate);
      satMatchEnd.setHours(satMatchEnd.getHours() + 1);

      events.push({
        week: weekNumber,
        type: 'Match',
        startTimestamp: Math.floor(satMatchDate.getTime() / 1000),
        endTimestamp: Math.floor(satMatchEnd.getTime() / 1000),
        day: 'Saturday',
        map,
        eventId: `${season}-W${weekNumber}-Match-Sat`,
        rosterAnnouncementMessageId: null,
        messageId: null,
        threadId: null,
        threadRosterMessageId: null,
        preEventReminderSent: false,
        postMatchPromptMessageId: null,
        postMatchCountRecorded: false,
        signupsDisabled: false,
      });

      // Sunday: Match for Weeks 1-6 (7pm-8pm), Playoff for Week 7 (7pm-7:15pm)
      const sunMatch = new Date(baseDate);
      sunMatch.setDate(baseDate.getDate() + 4);
      const sunMatchDate = new Date(
        sunMatch.toLocaleString('en-US', {
          timeZone: timezone,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }) + ' 19:00:00',
      );
      const sunMatchEnd = new Date(sunMatchDate);
      if (isWeek7) {
        sunMatchEnd.setMinutes(sunMatchEnd.getMinutes() + 15); // 7:15pm for Playoff
      } else {
        sunMatchEnd.setHours(sunMatchEnd.getHours() + 1); // 8pm for regular Match
      }

      events.push({
        week: weekNumber,
        type: isWeek7 ? 'Playoff' : 'Match',
        startTimestamp: Math.floor(sunMatchDate.getTime() / 1000),
        endTimestamp: Math.floor(sunMatchEnd.getTime() / 1000),
        day: 'Sunday',
        map,
        eventId: `${season}-W${weekNumber}-${isWeek7 ? 'Playoff' : 'Match'}-Sun`,
        rosterAnnouncementMessageId: null,
        messageId: null,
        threadId: null,
        threadRosterMessageId: null,
        preEventReminderSent: false,
        postMatchPromptMessageId: null,
        postMatchCountRecorded: false,
        signupsDisabled: false,
      });
    }

    // Store events
    this.db.set('scheduledEvents', events);

    // Create success message
    const firstEvent = events[0];
    const lastEvent = events[events.length - 1];
    const firstEventDate = new Date(firstEvent.startTimestamp * 1000);
    const lastEventDate = new Date(lastEvent.startTimestamp * 1000);

    await sendEventAnnouncements(client);

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle('Events Generated Successfully')
          .setDescription(
            `Generated ${events.length} events for ${season}\n\n` +
              `**Date Range:** ${formatEventDate(firstEventDate)} - ${formatEventDate(lastEventDate)}\n\n` +
              `**First Event:** ${firstEvent.type} on ${formatEventDate(firstEventDate)}\n` +
              `**Last Event:** ${lastEvent.type} on ${formatEventDate(lastEventDate)}\n\n` +
              `Events will be announced every Monday at midnight PST.`,
          )
          .setColor(0x98c379)
          .setTimestamp(),
      ],
      flags: [MessageFlags.Ephemeral],
    });
  }
}
