import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

export const POST_BUTTON = 'slap:post';
export const CANCEL_BUTTON = 'slap:cancel';

export function buildPreviewButtons(disabled = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(POST_BUTTON)
      .setLabel('Post')
      .setStyle(ButtonStyle.Success)
      .setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId(CANCEL_BUTTON)
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(disabled),
  );
}
