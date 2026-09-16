import 'dotenv/config';
import { REST, Routes } from 'discord.js';
import { buildSlapCommand } from '../src/slap-command.js';

const { DISCORD_TOKEN, DISCORD_CLIENT_ID, DISCORD_GUILD_ID } = process.env;
const guildOnly = process.argv.includes('--guild');
const missing = [
  ['DISCORD_TOKEN', DISCORD_TOKEN],
  ['DISCORD_CLIENT_ID', DISCORD_CLIENT_ID],
  ...(guildOnly ? [['DISCORD_GUILD_ID', DISCORD_GUILD_ID]] : []),
].filter(([, value]) => !value?.trim()).map(([name]) => name);

if (missing.length > 0) {
  console.error(`Missing required environment values: ${missing.join(', ')}. Copy .env.example to .env and fill them in.`);
  process.exitCode = 1;
} else {
  try {
    const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
    const route = guildOnly
      ? Routes.applicationGuildCommands(DISCORD_CLIENT_ID, DISCORD_GUILD_ID)
      : Routes.applicationCommands(DISCORD_CLIENT_ID);
    const body = buildSlapCommand().toJSON();
    if (!guildOnly) {
      body.integration_types = [0]; // Server installation.
      body.contexts = [0]; // Server channels.
    }
    const command = await rest.post(route, { body });
    const registered = await rest.get(route);
    if (!registered.some((entry) => entry.id === command.id && entry.name === 'slap')) {
      throw new Error('Registration verification failed');
    }
    console.log(guildOnly ? 'Verified /slap in the configured test server.' : 'Verified global /slap for all servers that install the bot.');
    // Remove only our old test command once the global command is verified.
    if (!guildOnly && DISCORD_GUILD_ID?.trim()) {
      const guildRoute = Routes.applicationGuildCommands(DISCORD_CLIENT_ID, DISCORD_GUILD_ID);
      const commands = await rest.get(guildRoute);
      for (const entry of commands.filter((item) => item.name === 'slap' && item.type === 1)) {
        await rest.delete(Routes.applicationGuildCommand(DISCORD_CLIENT_ID, DISCORD_GUILD_ID, entry.id));
      }
      console.log('Removed any previous test-server /slap override.');
    }
  } catch (error) {
    console.error(`Command registration failed (${error.status ?? error.code ?? error.name}). Check the application ID, token, and server ID.`);
    process.exitCode = 1;
  }
}
