import 'dotenv/config';
import {
  AttachmentBuilder,
  Client,
  GatewayIntentBits,
  MessageFlags,
} from 'discord.js';
import { fetchAvatarBuffer } from './avatar.js';
import { CANCEL_BUTTON, POST_BUTTON, buildPreviewButtons } from './preview-components.js';
import { getPostFailureMessage } from './post-errors.js';
import { renderSlap } from './render.js';
import { isPreviewOwner, PreviewStore } from './preview-store.js';
import { normalizeSlapInput } from './validation.js';

const PREVIEW_IMAGE_NAME = 'slap-preview.png';

const { DISCORD_TOKEN } = process.env;
if (!DISCORD_TOKEN?.trim()) {
  console.error('Missing DISCORD_TOKEN. Copy .env.example to .env and fill in your bot token.');
  process.exitCode = 1;
} else {
  const client = new Client({
    intents: [GatewayIntentBits.Guilds],
    // Do not retry timed-out or 5xx POSTs: Discord may already have accepted the message.
    rest: { retries: 0 },
  });

  const previews = new PreviewStore({
    onExpire: async (_messageId, entry) => {
      try {
        await entry.commandInteraction.editReply({
          content: 'This preview expired. Run `/slap` again to make a new one.',
          attachments: [],
          components: [],
        });
      } catch {
        // The interaction token can expire if the process or machine was paused.
      }
    },
    onError: () => console.error('[TheSlapBot] Could not update an expired preview.'),
  });

  async function handleSlap(interaction) {
    let input;
    try {
      input = normalizeSlapInput(
        interaction.options.getString('text', true),
        interaction.options.getString('feeling', true),
      );
    } catch (error) {
      await interaction.reply({ content: error.message, flags: MessageFlags.Ephemeral });
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    try {
      const startedAt = performance.now();
      const avatarBuffer = await fetchAvatarBuffer(interaction);
      const imageBuffer = await renderSlap({ ...input, avatarBuffer });
      const previewMessage = await interaction.editReply({
        content: 'Here’s your preview. Only you can see it; press **Post** to send the image to this channel.',
        files: [new AttachmentBuilder(imageBuffer, { name: PREVIEW_IMAGE_NAME })],
        components: [buildPreviewButtons()],
      });

      previews.create(previewMessage.id, {
        ownerId: interaction.user.id,
        channelId: interaction.channelId,
        buffer: imageBuffer,
        commandInteraction: interaction,
      });
      console.log(`[TheSlapBot] Generated a preview in ${Math.round(performance.now() - startedAt)} ms.`);
    } catch (error) {
      console.error(`[TheSlapBot] Preview generation failed (${error?.name ?? 'Error'}).`);
      try {
        await interaction.editReply({
          content: error instanceof RangeError
            ? error.message
            : 'I could not make that preview. Please try again in a moment.',
          attachments: [],
          components: [],
        });
      } catch {
        // The user-facing interaction may have expired or Discord may be unavailable.
      }
    }
  }

  async function handleButton(interaction) {
    if (interaction.customId !== POST_BUTTON && interaction.customId !== CANCEL_BUTTON) return;

    const messageId = interaction.message.id;
    const preview = previews.get(messageId);
    if (!preview) {
      await interaction.update({
        content: 'This preview has expired or the bot restarted. Run `/slap` again.',
        attachments: [],
        components: [],
      });
      return;
    }
    if (!isPreviewOwner(preview, interaction.user.id)) {
      await interaction.reply({
        content: 'Only the person who created this preview can use its buttons.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    if (preview.expiresAt <= Date.now()) {
      previews.delete(messageId, 'expired');
      await interaction.update({
        content: 'This preview has expired. Run `/slap` again to make a new one.',
        attachments: [],
        components: [],
      });
      return;
    }

    if (interaction.customId === CANCEL_BUTTON) {
      previews.delete(messageId, 'cancelled');
      await interaction.update({
        content: 'Canceled. Run `/slap` whenever you want another preview.',
        attachments: [],
        components: [],
      });
      return;
    }

    if (!previews.claim(messageId)) {
      await interaction.reply({
        content: 'This preview is already being posted or is no longer active.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    try {
      await interaction.update({ content: 'Posting your image…', components: [buildPreviewButtons(true)] });
      const channel = await client.channels.fetch(preview.channelId);
      if (!channel?.isTextBased?.() || typeof channel.send !== 'function') {
        throw Object.assign(new Error('The channel cannot receive messages.'), { status: 404 });
      }

      const posted = await channel.send({
        files: [new AttachmentBuilder(preview.buffer, { name: 'slap.png' })],
        allowedMentions: { parse: [] },
      });
      previews.delete(messageId, 'posted');
      await interaction.editReply({ content: `Posted. ${posted.url}`, components: [] });
    } catch (error) {
      previews.delete(messageId, 'failed');
      console.error(`[TheSlapBot] Image post failed (${error?.status ?? error?.code ?? error?.name}).`);
      const message = getPostFailureMessage(error);
      if (interaction.replied || interaction.deferred) {
        await interaction.editReply({ content: message, components: [] }).catch(() => {});
      } else {
        await interaction.reply({ content: message, flags: MessageFlags.Ephemeral }).catch(() => {});
      }
    }
  }

  client.once('ready', (readyClient) => {
    console.log(`[TheSlapBot] Online as ${readyClient.user.tag}.`);
  });
  client.on('error', (error) => {
    console.error(`[TheSlapBot] Discord client error (${error?.code ?? error?.name}).`);
  });
  client.on('interactionCreate', async (interaction) => {
    try {
      if (interaction.isChatInputCommand() && interaction.commandName === 'slap') {
        await handleSlap(interaction);
      } else if (interaction.isButton()) {
        await handleButton(interaction);
      }
    } catch (error) {
      console.error(`[TheSlapBot] Interaction failed (${error?.code ?? error?.name ?? 'Error'}).`);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: 'Something went wrong. Please try again.',
          flags: MessageFlags.Ephemeral,
        }).catch(() => {});
      }
    }
  });

  const shutDown = async () => {
    previews.clear();
    client.destroy();
  };
  process.once('SIGINT', shutDown);
  process.once('SIGTERM', shutDown);

  await client.login(DISCORD_TOKEN);
}
