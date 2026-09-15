import { SlashCommandBuilder } from 'discord.js';
import { MAX_BODY_CHARS, MAX_FEELING_CHARS } from './validation.js';

export function buildSlapCommand() {
  return new SlashCommandBuilder()
    .setName('slap')
    .setDescription('Make a pear-phone update image')
    .addStringOption((option) =>
      option
        .setName('text')
        .setDescription('The update to put on the screen')
        .setRequired(true)
        .setMaxLength(MAX_BODY_CHARS),
    )
    .addStringOption((option) =>
      option
        .setName('feeling')
        .setDescription('A short feeling for the update')
        .setRequired(true)
        .setMaxLength(MAX_FEELING_CHARS),
    );
}
