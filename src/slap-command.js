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
    )
    .addStringOption((option) => option
      .setName('color')
      .setDescription('Phone color name or six-digit hex (for example blue or #FF8800)')
      .setMaxLength(32))
    .addAttachmentOption((option) => option
      .setName('media')
      .setDescription('Image or short MP4 beside your update (up to 10 MB)'))
    .addStringOption((option) => option
      .setName('media_link')
      .setDescription('Discord media/proxy link or image message link, instead of a media upload')
      .setMaxLength(2048));
}
