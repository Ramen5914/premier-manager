# Premier Manager Bot

A Discord bot for managing Valorant Premier team schedules, practices, and matches. Built with TypeScript, discordx, and Discord.js.

## Features

- **Automated Event Scheduling**: Generates 7-week Premier season schedules with practices and matches
- **Event Announcements**: Automated weekly announcements for upcoming events via cron jobs
- **Attendance Tracking**: Interactive buttons for players to accept/decline/tentative events
- **Roster Management**: Automatically creates match rosters when 5+ players accept
- **Role-Based Permissions**: Admin and manager guard decorators for command access
- **Persistent Storage**: Enmap-based SQLite storage for season data and event responses

## Event Structure

Each 7-week season includes 35 total events:
- **Wednesday**: 7pm-8pm Practice
- **Thursday**: 7pm-8pm Match
- **Friday**: 8pm-9pm Practice
- **Saturday**: 8pm-9pm Match
- **Sunday**: 7pm-8pm Match

All times are in Pacific Time (America/Los_Angeles).

## Commands

- `/setup` - Initialize a new Premier season
- `/channels` - Configure announcement, practice, and match channels
- `/roles` - Set team role and admin/manager roles
- `/maps` - Set the map pool for the season
- `/generateevents` - Create all season events and schedule announcements

## Development

### Prerequisites

- Node.js (v18+)
- npm
- Discord bot token

### Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file with your bot token:
   ```
   BOT_TOKEN=your_bot_token_here
   ```

4. Start development mode:
   ```bash
   npm run dev
   ```

### Available Scripts

- `npm run dev` - Watch mode with tsx (no build)
- `npm run start:dev` - Watch build with auto-restart
- `npm run build` - TypeScript compilation
- `npm run start` - Run built production code
- `npm run lint` - Check code style
- `npm run lint:fix` - Fix linting issues

## Docker

Start the bot:
```bash
docker-compose up -d
```

Stop the bot:
```bash
docker-compose down
```

View logs:
```bash
docker-compose logs
```

## Project Structure

```
src/
├── bot.ts              # Discord client singleton
├── main.ts             # Entry point and scheduler initialization
├── commands/           # Slash commands
├── events/             # Button and reaction handlers
├── guards/             # Authorization guards
├── services/           # Scheduler and background tasks
├── types/              # TypeScript interfaces
└── utils/              # Helper functions
```

## Built With

- [discordx](https://discordx.js.org/) - TypeScript decorators for Discord.js
- [Discord.js](https://discord.js.org/) - Discord API library
- [Enmap](https://enmap.evie.dev/) - Persistent key-value storage
- [node-cron](https://github.com/node-cron/node-cron) - Task scheduling
