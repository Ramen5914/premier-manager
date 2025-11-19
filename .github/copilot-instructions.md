# Premier Manager Bot - AI Coding Instructions

## Project Overview
Discord bot for managing Valorant Premier team schedules, practices, and matches using discordx framework with TypeScript decorators.

## Architecture

### Core Components
- **`src/bot.ts`**: Singleton Discord.js Client instance with discordx decorators
- **`src/main.ts`**: Entry point that imports commands/events dynamically via `@discordx/importer` and initializes scheduler
- **`src/services/scheduler.ts`**: Cron-based event announcements (Mondays midnight PST) and cleanup (Sundays 11:59pm PST)

### Data Layer
- **Enmap** (SQLite-based persistent key-value store) in `data/enmap.sqlite*`
- Each command/event class instantiates `new Enmap({ name: 'premier_data' })` - they share the same database
- Key schema:
  - `season`, `startDate`, `maps[]`, `scheduledEvents[]`, `eventCreatorId`
  - `{channelType}Channel`, `{roleType}RoleId` (stored as Discord mention strings like `<#id>` or `<@&id>`)
  - `{eventId}_responses` for event attendance tracking

### Event System
Events follow strict 7-week structure (35 total events):
- Wed 7pm-8pm Practice, Thu 7pm-8pm Match, Fri 8pm-9pm Practice, Sat 8pm-9pm Match, Sun 7pm-8pm Match
- Event IDs format: `{season}-W{week}-{type}-{day}` (e.g., `V25A1-W1-Match-Thu`)
- Timezone handling: All dates use `America/Los_Angeles` timezone via `toLocaleString` before creating Date objects

## Development Patterns

### discordx Decorators
```typescript
@Discord()           // Class-level: registers with discordx
@Slash()            // Slash command
@ModalComponent()   // Modal submit handler
@ButtonComponent()  // Button interaction (supports regex: id: /^accept-.*/)
@Guard()            // Authorization (use OrGuard for OR logic)
```

### Guard Pattern
Guards use `data.guardPassed` flag to support OR composition:
```typescript
// In guard implementation
data.guardPassed = isAuthorized;
if (isAuthorized) await next();

// In command
@Guard(OrGuard(IsManager, IsAdmin))
```

### Import Path Convention
Always use `.js` extensions in TypeScript imports for ESM compatibility:
```typescript
import { bot } from './bot.js';
import type { PremierEvent } from '../types/event.js';
```

## Build & Development

### Commands
- `npm run dev` - Watch mode with tsx (no build)
- `npm run start:dev` - Watch build with tsc-watch + auto-restart
- `npm run build` - TypeScript compilation to `dist/`
- `npm run lint:fix` - Fix ESLint + Prettier issues

### Environment
- Requires `BOT_TOKEN` in environment (loaded via `dotenv/config`)
- No .env file in repo - create locally with `BOT_TOKEN=your_token`

### TypeScript Config
- Target: ES2023, Module: nodenext
- Decorators enabled (`experimentalDecorators`, `emitDecoratorMetadata`)
- Outputs to `dist/` with source maps

## Key Behaviors

### Scheduler Triggers
- `initializeScheduler()` runs immediately on bot login AND schedules cron jobs
- `sendEventAnnouncements()` posts/updates messages in practice/match channels for current week's events
- If message already exists (tracked via `event.messageId`), it updates the existing message
- Cleanup job removes events past `endTimestamp` and deletes their response data

### Roster Management
When event gets ≥5 accepted responses:
1. Fetch all accepted members from guild
2. Prioritize owner/captain roles for roster
3. Fill remaining slots, put extras in standby
4. Post/update announcement in announcement channel
5. If drops <5, delete roster announcement and send "more players needed"

### Button Interactions
- Toggle behavior: clicking same button twice removes your response
- Only users with team role can respond (silently ignored otherwise)
- Updates embed with response counts and triggers roster check

## Common Pitfalls

### Discord Mention Parsing
Settings store mentions as strings (`<#id>`, `<@&id>`). Extract IDs:
```typescript
const channelId = channelMention?.replace(/[<>#]/g, '');
const roleId = roleMention?.replace(/[<>@&]/g, '');
```

### Date Validation
- Start date MUST be Wednesday (day 3) - enforced in setup modal
- Event generation uses timezone-aware date calculations to prevent off-by-one errors
- Use `toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })` before creating Date objects

### Message Components V2
Use `MessageFlags.IsComponentsV2` with new `TextDisplayBuilder` API (not old ephemeral replies):
```typescript
interaction.reply({
  components: [new TextDisplayBuilder().setContent('...')],
  flags: [MessageFlags.IsComponentsV2, MessageFlags.Ephemeral]
});
```

### Async Event Handlers
Always use `void` prefix for fire-and-forget async calls in event handlers:
```typescript
bot.on('messageCreate', (message) => {
  void bot.executeCommand(message);
});
```

## Testing
No test framework configured. Test manually:
1. Start bot with `npm run start:dev`
2. Use `/setup`, `/channels`, `/roles`, `/maps`, `/generateevents` in Discord
3. Verify scheduler creates messages at correct times
4. Check button interactions update embeds and trigger roster announcements
