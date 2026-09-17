import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveMessageMedia } from '../src/media.js';
const source = { url: 'https://discord.com/channels/111/222/333' };
function setup({ allowed = true, attachments = [{ contentType: 'image/gif', url: 'https://cdn.discordapp.com/attachments/222/444/a.gif' }] } = {}) {
  let reads = 0;
  const channel = { guildId: '111', guild: { members: { fetch: async () => ({}) } }, permissionsFor: () => ({ has: () => allowed }), messages: { fetch: async id => { assert.equal(id, '333'); reads++; return { attachments: { find: fn => attachments.find(fn) } }; } } };
  return { client: { channels: { fetch: async () => channel } }, interaction: { guildId: '111', user: { id: 'user' } }, reads: () => reads, channel };
}
test('message links resolve to image attachments', async () => {
  const ctx = setup();
  assert.match((await resolveMessageMedia(source, ctx)).url, /a.gif$/);
  assert.equal(ctx.reads(), 1);
});
test('other-server and inaccessible messages cannot be read', async () => {
  const ctx = setup({ allowed: false });
  await assert.rejects(resolveMessageMedia(source, ctx), /cannot read/);
  assert.equal(ctx.reads(), 0);
  ctx.interaction.guildId = '999';
  await assert.rejects(resolveMessageMedia(source, ctx), /this server/);
  assert.equal(ctx.reads(), 0);
});
test('private thread membership and missing image failures are handled', async () => {
  const ctx = setup();
  ctx.channel.type = 12;
  ctx.channel.isThread = () => true;
  ctx.channel.permissionsFor = () => ({ has: flags => Array.isArray(flags) });
  ctx.channel.members = { fetch: async () => { throw new Error('Not a member'); } };
  await assert.rejects(resolveMessageMedia(source, ctx), /cannot read/);
  assert.equal(ctx.reads(), 0);
  await assert.rejects(resolveMessageMedia(source, setup({ attachments: [] })), /No image attachment is visible/);
});
test('direct media bypasses message lookup', async () => {
  const direct = { url: 'https://cdn.discordapp.com/attachments/1/2/a.gif' };
  assert.equal(await resolveMessageMedia(direct, {}), direct);
  assert.equal(await resolveMessageMedia(null, {}), null);
});
