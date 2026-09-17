import { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } from 'discord.js';
import { PHONE_COLORS } from './phone-colors.js';

export const POST_BUTTON = 'slap:post';
export const CANCEL_BUTTON = 'slap:cancel';
export const HEX_BUTTON = 'slap:hex';
export const PALETTE_SELECT = 'slap:palette';

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
    new ButtonBuilder()
      .setCustomId(HEX_BUTTON)
      .setLabel('Custom hex')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(disabled),
  );
}

export function buildPreviewComponents(disabled = false) {
  return [
    new ActionRowBuilder().addComponents(new StringSelectMenuBuilder()
      .setCustomId(PALETTE_SELECT).setPlaceholder('Choose a phone color')
      .addOptions(PHONE_COLORS).setDisabled(disabled)),
    buildPreviewButtons(disabled),
  ];
}
