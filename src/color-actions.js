import { imageFilename } from './media.js';
import { ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, MessageFlags, AttachmentBuilder } from 'discord.js';
import { normalizeColor } from './phone-colors.js';
import { HEX_BUTTON, PALETTE_SELECT } from './preview-components.js';
import { renderSlap } from './render.js';

export async function handleColorInteraction({ interaction, previews, render = renderSlap }) {
  const customId = interaction.customId ?? '';
  if (![HEX_BUTTON, PALETTE_SELECT].includes(customId) && !/^slap:hexsubmit:[^:]+$/.test(customId)) return false;
  const id = customId.startsWith('slap:hexsubmit:') ? customId.split(':')[2] : interaction.message.id;
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
  if (customId === HEX_BUTTON) {
    await interaction.showModal(new ModalBuilder().setCustomId(`slap:hexsubmit:${id}`).setTitle('Phone color').addComponents(
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('color').setLabel('Six-digit hex color').setPlaceholder('#FF8800').setValue(preview.color).setStyle(TextInputStyle.Short).setRequired(true).setMinLength(6).setMaxLength(7)),
    ));
    return true;
  }
  let color;
  try {
    color = normalizeColor(customId === PALETTE_SELECT ? interaction.values[0] : interaction.fields.getTextInputValue('color'));
  } catch (error) {
    await deny(error.message);
    return true;
  }
  preview.state = 'coloring';
  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const buffer = await render({ ...preview.input, avatarBuffer: preview.avatarBuffer, mediaBuffer: preview.mediaBuffer, color });
    if (previews.get(id) !== preview || preview.expiresAt <= Date.now()) {
      await interaction.editReply({ content: 'This preview expired before the color could be changed.' });
      return true;
    }
    await preview.commandInteraction.editReply({ attachments: [], files: [new AttachmentBuilder(buffer, { name: imageFilename(buffer, 'slap-preview') })] });
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
