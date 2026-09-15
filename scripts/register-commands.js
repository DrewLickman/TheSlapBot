import 'dotenv/config';
import { REST, Routes } from 'discord.js';
import { buildSlapCommand } from '../src/slap-command.js';

const { DISCORD_TOKEN, DISCORD_CLIENT_ID, DISCORD_GUILD_ID } = process.env;
const missing = [
  ['DISCORD_TOKEN', DISCORD_TOKEN],
  ['DISCORD_CLIENT_ID', DISCORD_CLIENT_ID],
  ['DISCORD_GUILD_ID', DISCORD_GUILD_ID],
].filter(([, value]) => !value?.trim()).map(([name]) => name);

if (missing.length > 0) {
  console.error(`Missing required environment values: ${missing.join(', ')}. Copy .env.example to .env and fill them in.`);
  process.exitCode = 1;
} else {
  try {
    const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
    await rest.put(Routes.applicationGuildCommands(DISCORD_CLIENT_ID, DISCORD_GUILD_ID), {
      body: [buildSlapCommand().toJSON()],
    });
    console.log(`Registered /slap in the configured test server (${DISCORD_GUILD_ID}).`);
  } catch (error) {
    console.error(`Command registration failed (${error.status ?? error.code ?? error.name}). Check the application ID, token, and server ID.`);
    process.exitCode = 1;
  }
}
