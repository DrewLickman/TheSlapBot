import sharp from 'sharp';
import { convertVideo } from './video.js';

export const MAX_MEDIA_BYTES = 10 * 1024 * 1024;
const MAX_MEDIA_PIXELS = 20_000_000;
export const MAX_GIF_FRAMES = 120;
export function validateGif(metadata) {
  if (metadata.pages > MAX_GIF_FRAMES || metadata.width * (metadata.pageHeight ?? metadata.height) * metadata.pages > 40_000_000) {
    throw new RangeError('That GIF is too large to animate. Use up to 120 frames and 40 million total frame pixels.');
  }
}

export function imageFilename(buffer, stem = 'slap') {
  return `${stem}.${buffer.subarray(0, 6).toString().startsWith('GIF8') ? 'gif' : 'png'}`;
}

export function selectMediaSource(attachment, link) {
  if (attachment && link) throw new RangeError('Choose either media upload or media_link, not both.');
  return attachment ?? (link ? { url: link.trim() } : null);
}

export async function resolveMessageMedia(source, { client, interaction }) {
  if (!source) return source;
  let url;
  try { url = new URL(source.url); } catch { return source; }
  if (!['discord.com', 'www.discord.com', 'ptb.discord.com', 'canary.discord.com'].includes(url.hostname)) return source;
  const match = /^\/channels\/(\d+)\/(\d+)\/(\d+)\/?$/.exec(url.pathname);
  if (url.protocol !== 'https:' || url.username || url.password || url.port || !match) {
    throw new RangeError('Use a Discord message link or Copy Media Link, or upload an image with media.');
  }
  const [, guildId, channelId, messageId] = match;
  if (guildId !== interaction.guildId) throw new RangeError('Use an image message from this server, or upload the image with media.');
  try {
    const channel = await client.channels.fetch(channelId);
    if (channel?.guildId !== guildId || !channel.messages) throw new Error('Unavailable channel');
    const member = await channel.guild.members.fetch(interaction.user.id);
    if (!channel.permissionsFor(member)?.has(['ViewChannel', 'ReadMessageHistory'])) throw new Error('No access');
    // Private threads require membership even when the parent channel is visible.
    if (channel.isThread?.() && channel.type === 12 && !channel.permissionsFor(member)?.has('ManageThreads')) {
      await channel.members.fetch(interaction.user.id);
    }
    const message = await channel.messages.fetch(messageId);
    const attachment = message.attachments.find(item => item.contentType?.startsWith('image/') || item.contentType === 'video/mp4' || /\.(png|jpe?g|gif|webp|avif|mp4)$/i.test(item.name ?? ''));
    if (attachment) return attachment;
    throw new RangeError('No image attachment is visible to the bot in that message. Discord may hide it when Message Content Intent is disabled. Right-click the image and use Copy Media Link, or upload it with media.');
  } catch (error) {
    if (error instanceof RangeError) throw error;
    throw new RangeError('I cannot read that message. You and the bot need access to its channel and Read Message History, or upload the image with media.');
  }
}

export async function fetchMediaBuffer(attachment, { fetchImpl = globalThis.fetch } = {}) {
  if (!attachment) return null;
  if (attachment.size > MAX_MEDIA_BYTES) throw new RangeError('Please upload an image smaller than 10 MB.');
  let url;
  try { url = new URL(attachment.url); } catch { throw new RangeError('Upload an image with media, or paste a Discord Copy Media Link into media_link.'); }
  const attachmentUrl = ['cdn.discordapp.com', 'media.discordapp.net'].includes(url.hostname)
    && /^\/(?:ephemeral-)?attachments\//.test(url.pathname);
  const proxyUrl = /^images-ext-[12]\.discordapp\.net$/.test(url.hostname)
    && url.pathname.startsWith('/external/');
  if (url.protocol !== 'https:' || url.username || url.password || url.port || !(attachmentUrl || proxyUrl)) {
    throw new RangeError('Upload an image with media, or paste a Discord Copy Media Link into media_link.');
  }
  try {
    const response = await fetchImpl(url.toString(), { redirect: 'error', signal: AbortSignal.timeout(10_000) });
    if (!response.ok) {
      await response.body?.cancel();
      if ([403, 404, 410].includes(response.status)) {
        throw new RangeError('That Discord media link has expired or is unavailable. Copy a fresh Media Link from the image, or upload it directly with media.');
      }
      throw new RangeError(`Discord could not serve that image (HTTP ${response.status}). Try again or upload it directly with media.`);
    }
    if (Number(response.headers.get('content-length')) > MAX_MEDIA_BYTES) {
      await response.body?.cancel();
      throw new RangeError('Please upload an image smaller than 10 MB.');
    }
    const chunks = [];
    let size = 0;
    for await (const chunk of response.body) {
      size += chunk.length;
      if (size > MAX_MEDIA_BYTES) throw new RangeError('Please upload an image smaller than 10 MB.');
      chunks.push(Buffer.from(chunk));
    }
    const buffer = Buffer.concat(chunks);
    if (buffer.length >= 12 && buffer.toString('ascii', 4, 8) === 'ftyp') return await convertVideo(buffer);
    const metadata = await sharp(buffer, { limitInputPixels: MAX_MEDIA_PIXELS }).metadata();
    if (!['jpeg', 'png', 'webp', 'gif', 'avif'].includes(metadata.format)) throw new Error('Unsupported image');
    if (metadata.format === 'gif' && metadata.pages > 1) {
      validateGif(metadata);
      return buffer;
    }
    // Normalize orientation and retain a small still image for subsequent recolors.
    return await sharp(buffer, { limitInputPixels: MAX_MEDIA_PIXELS }).rotate()
      .resize(640, 640, { fit: 'inside', withoutEnlargement: true }).png().toBuffer();
  } catch (error) {
    if (error instanceof RangeError) throw error;
    throw new RangeError('Could not read that image. Upload a PNG, JPEG, WebP, GIF, or AVIF under 10 MB (up to 20 megapixels).');
  }
}
