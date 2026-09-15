import test from 'node:test';
import assert from 'node:assert/strict';
import { getAvatarCandidates, fetchAvatarBuffer } from '../src/avatar.js';

function makeInteraction({ memberAvatar = 'aabbccdd', accountAvatar = true } = {}) {
  return {
    guildId: '123456789012345678',
    member: { avatar: memberAvatar },
    user: {
      id: '234567890123456789',
      avatarURL: () => accountAvatar ? 'https://cdn.discordapp.com/avatars/234567890123456789/accounthash.png?size=128' : null,
      defaultAvatarURL: 'https://cdn.discordapp.com/embed/avatars/2.png',
    },
  };
}

test('orders guild avatar, account avatar, and Discord default avatar fallbacks', () => {
  const candidates = getAvatarCandidates(makeInteraction());
  assert.match(candidates[0], /\/guilds\/123456789012345678\/users\/234567890123456789\/avatars\/aabbccdd\.png/);
  assert.match(candidates[1], /avatars\/234567890123456789\/accounthash\.png/);
  assert.match(candidates[2], /embed\/avatars\/2\.png/);
});

test('skips unavailable server/account avatars and returns the first valid default image', async () => {
  const interaction = makeInteraction({ memberAvatar: 'guildhash', accountAvatar: false });
  let requests = 0;
  const image = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xde,
    0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41, 0x54,
    0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0xf0, 0x1f,
    0x00, 0x05, 0x00, 0x01, 0xff, 0x89, 0x99, 0x3d, 0x1d,
    0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
  ]);
  const result = await fetchAvatarBuffer(interaction, {
    fetchImpl: async (url) => {
      requests += 1;
      if (url.includes('/guilds/')) return { ok: false };
      return { ok: true, headers: { get: () => String(image.length) }, arrayBuffer: async () => image };
    },
  });

  assert.deepEqual(result, image);
  assert.equal(requests, 2);
});

test('rejects non-Discord avatar URLs', () => {
  const interaction = makeInteraction();
  interaction.user.avatarURL = () => 'https://example.com/avatar.png';
  interaction.member.avatar = null;
  assert.deepEqual(getAvatarCandidates(interaction), ['https://cdn.discordapp.com/embed/avatars/2.png']);
});
