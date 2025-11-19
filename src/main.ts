import { dirname, importx } from '@discordx/importer';
import 'dotenv/config';
import { bot } from './bot.js';
import { initializeScheduler } from './services/scheduler.js';
// import Enmap from 'enmap';

async function run() {
  // const db = new Enmap({ name: 'premier_data' });

  await importx(`${dirname(import.meta.url)}/{events,commands}/**/*.{ts,js}`);

  if (!process.env.BOT_TOKEN) {
    throw Error('Could not find BOT_TOKEN in your environment');
  }

  await bot.login(process.env.BOT_TOKEN);

  // Initialize scheduler after bot is logged in
  initializeScheduler(bot);
}

void run();
