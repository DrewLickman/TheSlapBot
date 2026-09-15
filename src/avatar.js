import sharp from 'sharp';

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const MAX_AVATAR_PIXELS = 5_000_000;
const CDN_HOST = 'cdn.discordapp.com';

function trustedAvatarUrl(value) {
  if (typeof value !== 'string') return null;

  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === CDN_HOST ? url.toString() : null;
  } catch {
    return null;
  }
}

export function getAvatarCandidates(interaction) {
  const candidates = [];
  const memberAvatar = interaction.member?.avatar;

  if (typeof memberAvatar === 'string' && interaction.guildId) {
    const userId = encodeURIComponent(interaction.user.id);
    const guildId = encodeURIComponent(interaction.guildId);
    const hash = encodeURIComponent(memberAvatar);
    candidates.push(
      `https://${CDN_HOST}/guilds/${guildId}/users/${userId}/avatars/${hash}.png?size=128`,
    );
  }

  if (typeof interaction.user.avatarURL === 'function') {
    candidates.push(interaction.user.avatarURL({ extension: 'png', size: 128 }));
  }
  candidates.push(interaction.user.defaultAvatarURL);

  return [...new Set(candidates.map(trustedAvatarUrl).filter(Boolean))];
}

export async function fetchAvatarBuffer(interaction, {
  fetchImpl = globalThis.fetch,
  timeoutMs = 3000,
} = {}) {
  for (const url of getAvatarCandidates(interaction)) {
    try {
      const response = await fetchImpl(url, {
        redirect: 'error',
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok) continue;

      const contentLength = Number(response.headers?.get?.('content-length'));
      if (Number.isFinite(contentLength) && contentLength > MAX_AVATAR_BYTES) continue;

      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.length === 0 || buffer.length > MAX_AVATAR_BYTES) continue;

      const metadata = await sharp(buffer, { limitInputPixels: MAX_AVATAR_PIXELS }).metadata();
      if (!metadata.width || !metadata.height) continue;
      return buffer;
    } catch {
      // Move to the next Discord-hosted avatar, including the user's default avatar.
    }
  }

  throw new Error('Could not download a Discord avatar. Try again in a moment.');
}
