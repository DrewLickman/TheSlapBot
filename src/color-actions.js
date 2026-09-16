import { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, MessageFlags, AttachmentBuilder } from 'discord.js';
import { PHONE_COLORS, normalizeColor } from './phone-colors.js';
import { COLOR_BUTTON } from './preview-components.js';
import { renderSlap } from './render.js';

function controls(id) {
  return [
    new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId(`slap:palette:${id}`).setPlaceholder('Choose a phone color').addOptions(PHONE_COLORS)),
    new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`slap:hex:${id}`).setLabel('Custom hex').setStyle(ButtonStyle.Secondary)),
  ];
}

export async function handleColorInteraction({ interaction, previews, render = renderSlap }) {
  const customId = interaction.customId ?? '';
  if (customId !== COLOR_BUTTON && !/^slap:(palette|hex|hexsubmit):/.test(customId)) return false;
  const id = customId === COLOR_BUTTON ? interaction.message.id : customId.split(':')[2];
  const preview = previews.get(id);
  const deny = (content) => interaction.reply({ content, flags: MessageFlags.Ephemeral });
  if (!preview || preview.expiresAt <= Date.now()) {
    await deny('This preview is no longer active. Run `/slap` again.');
    return true;
  }
  if (preview.ownerId !== interaction.user.id) {
    await deny('Only the person who created this preview can change its color.');
    return true;
  }
  if (preview.state !== 'preview') {
    await deny('An update or post is already in progress. Please wait.');
    return true;
  }
  if (customId === COLOR_BUTTON) {
    preview.state = 'choosing';
    try {
      await interaction.reply({ content: 'Choose a color below, or enter a custom hex code. This updates your original preview.', components: controls(id), flags: MessageFlags.Ephemeral });
      await preview.colorInteraction?.editReply({ content: 'A newer color selector is open.', components: [] }).catch(() => {});
      preview.colorInteraction = interaction;
      if (previews.get(id) !== preview) await interaction.editReply({ content: 'This preview has expired.', components: [] });
    } finally {
      if (previews.get(id) === preview) preview.state = 'preview';
    }
    return true;
  }
  if (customId.startsWith('slap:hex:')) {
    await interaction.showModal(new ModalBuilder().setCustomId(`slap:hexsubmit:${id}`).setTitle('Phone color').addComponents(
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('color').setLabel('Six-digit hex color').setPlaceholder('#FF8800').setValue(preview.color).setStyle(TextInputStyle.Short).setRequired(true).setMinLength(6).setMaxLength(7)),
    ));
    return true;
  }
  let color;
  try {
    color = normalizeColor(customId.startsWith('slap:palette:') ? interaction.values[0] : interaction.fields.getTextInputValue('color'));
  } catch (error) {
    await deny(error.message);
    return true;
  }
  preview.state = 'coloring';
  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const buffer = await render({ ...preview.input, avatarBuffer: preview.avatarBuffer, color });
    if (previews.get(id) !== preview || preview.expiresAt <= Date.now()) {
      await interaction.editReply({ content: 'This preview expired before the color could be changed.' });
      return true;
    }
    await preview.commandInteraction.editReply({ attachments: [], files: [new AttachmentBuilder(buffer, { name: 'slap-preview.png' })] });
    if (previews.get(id) !== preview || preview.expiresAt <= Date.now()) {
      await preview.commandInteraction.editReply({ content: 'This preview has expired.', attachments: [], components: [] });
      await interaction.editReply({ content: 'This preview has expired.' });
      return true;
    }
    preview.buffer = buffer;
    preview.color = color;
    await interaction.editReply({ content: 'Color updated in your original preview.' });
  } catch {
    // An upload failure can be ambiguous; discard rather than post a mismatched image.
    previews.delete(id, 'failed');
    await preview.commandInteraction.editReply({ content: 'Could not update the color. Run `/slap` again.', attachments: [], components: [] }).catch(() => {});
    if (interaction.deferred) await interaction.editReply({ content: 'Could not update the color. Please make a new preview.' }).catch(() => {});
  } finally {
    if (previews.get(id) === preview) preview.state = 'preview';
  }
  return true;
}
