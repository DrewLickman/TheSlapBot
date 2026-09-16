import 'dotenv/config';
import {
  AttachmentBuilder,
  Client,
  GatewayIntentBits,
  MessageFlags,
} from 'discord.js';
import { fetchAvatarBuffer } from './avatar.js';
import { buildPreviewButtons } from './preview-components.js';
import { handlePreviewButton } from './preview-actions.js';
import { renderSlap } from './render.js';
import { PreviewStore } from './preview-store.js';
import { normalizeSlapInput } from './validation.js';
import { randomPhoneColor } from './phone-colors.js';
import { handleColorInteraction } from './color-actions.js';

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
      const avatarStartedAt = performance.now();
      const avatarBuffer = await fetchAvatarBuffer(interaction);
      const avatarMs = performance.now() - avatarStartedAt;

      const renderStartedAt = performance.now();
      const color = randomPhoneColor();
      const imageBuffer = await renderSlap({ ...input, avatarBuffer, color });
      const renderMs = performance.now() - renderStartedAt;

      const uploadStartedAt = performance.now();
      const previewMessage = await interaction.editReply({
        content: 'Here’s your preview. Only you can see it; press **Post** to send the image to this channel.',
        files: [new AttachmentBuilder(imageBuffer, { name: PREVIEW_IMAGE_NAME })],
        components: [buildPreviewButtons()],
      });
      const uploadMs = performance.now() - uploadStartedAt;

      previews.create(previewMessage.id, {
        ownerId: interaction.user.id,
        channelId: interaction.channelId,
        buffer: imageBuffer,
        input,
        avatarBuffer,
        color,
        commandInteraction: interaction,
      });
      console.log(
        `[TheSlapBot] Preview timings: avatar=${Math.round(avatarMs)} ms, ` +
        `render=${Math.round(renderMs)} ms, Discord upload=${Math.round(uploadMs)} ms.`,
      );
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

  client.once('clientReady', (readyClient) => {
    console.log(`[TheSlapBot] Online as ${readyClient.user.tag}.`);
  });
  client.on('error', (error) => {
    console.error(`[TheSlapBot] Discord client error (${error?.code ?? error?.name}).`);
  });
  client.on('interactionCreate', async (interaction) => {
    try {
      if (interaction.isChatInputCommand() && interaction.commandName === 'slap') {
        await handleSlap(interaction);
      } else if (await handleColorInteraction({ interaction, previews })) {
        // Color buttons, palette selections, and custom-color modal submissions.
      } else if (interaction.isButton()) {
        await handlePreviewButton({ interaction, client, previews });
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
