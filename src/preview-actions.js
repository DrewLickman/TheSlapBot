import { imageFilename } from './media.js';
import { AttachmentBuilder, MessageFlags } from 'discord.js';
import { CANCEL_BUTTON, POST_BUTTON, buildPreviewComponents } from './preview-components.js';
import { getPostFailureMessage } from './post-errors.js';
import { isPreviewOwner } from './preview-store.js';

export async function handlePreviewButton({ interaction, client, previews }) {
  if (interaction.customId !== POST_BUTTON && interaction.customId !== CANCEL_BUTTON) return false;

  const messageId = interaction.message.id;
  const preview = previews.get(messageId);
  if (!preview) {
    await interaction.update({
      content: 'This preview has expired or the bot restarted. Run `/slap` again.',
      attachments: [],
      components: [],
    });
    return true;
  }
  if (!isPreviewOwner(preview, interaction.user.id)) {
    await interaction.reply({
      content: 'Only the person who created this preview can use its buttons.',
      flags: MessageFlags.Ephemeral,
    });
    return true;
  }
  if (preview.expiresAt <= Date.now()) {
    previews.delete(messageId, 'expired');
    await interaction.update({
      content: 'This preview has expired. Run `/slap` again to make a new one.',
      attachments: [],
      components: [],
    });
    return true;
  }

  if (preview.state !== 'preview') {
    await interaction.reply({ content: 'An update or post is already in progress. Please wait.', flags: MessageFlags.Ephemeral });
    return true;
  }
  if (interaction.customId === CANCEL_BUTTON) {
    previews.delete(messageId, 'cancelled');
    await interaction.deferUpdate();
    await Promise.resolve(preview.commandInteraction?.deleteReply?.()).catch(() => {});
    return true;
  }

  if (!previews.claim(messageId)) {
    await interaction.reply({
      content: 'This preview is already being posted or is no longer active.',
      flags: MessageFlags.Ephemeral,
    });
    return true;
  }

  let posted;
  try {
    await interaction.update({ content: 'Posting your image…', components: buildPreviewComponents(true) });
    const channel = await client.channels.fetch(preview.channelId);
    if (!channel?.isTextBased?.() || typeof channel.send !== 'function') {
      throw Object.assign(new Error('The channel cannot receive messages.'), { status: 404 });
    }

    posted = await channel.send({
      files: [new AttachmentBuilder(preview.buffer, { name: imageFilename(preview.buffer) })],
      allowedMentions: { parse: [] },
    });
  } catch (error) {
    previews.delete(messageId, 'failed');
    console.error(`[TheSlapBot] Image post failed (${error?.status ?? error?.code ?? error?.name}).`);
    const message = getPostFailureMessage(error);
    if (interaction.replied || interaction.deferred) {
      await interaction.editReply({ content: message, components: [] }).catch(() => {});
    } else {
      await interaction.reply({ content: message, flags: MessageFlags.Ephemeral }).catch(() => {});
    }
    return true;
  }

  previews.delete(messageId, 'posted');
  await interaction.editReply({ content: `Posted. ${posted.url}`, components: [] }).catch(() => {});
  return true;
}
