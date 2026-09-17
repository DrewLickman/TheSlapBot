import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { fetchMediaBuffer, MAX_MEDIA_BYTES, selectMediaSource } from '../src/media.js';

const attachment = { url: 'https://cdn.discordapp.com/attachments/1/2/image.png', size: 100 };
test('optional media and untrusted or oversized uploads never download', async () => {
  const fetchImpl = async () => { throw new Error('Must not fetch'); };
  assert.equal(await fetchMediaBuffer(null, { fetchImpl }), null);
  await assert.rejects(fetchMediaBuffer({ ...attachment, size: MAX_MEDIA_BYTES + 1 }, { fetchImpl }), /10 MB/);
  await assert.rejects(fetchMediaBuffer({ ...attachment, url: 'https://example.com/image.png' }, { fetchImpl }), /Discord/);
});
test('downloads and normalizes images; rejects corrupt data and oversized streams', async () => {
  const source = await sharp({ create: { width: 800, height: 400, channels: 3, background: 'red' } }).png().toBuffer();
  const output = await fetchMediaBuffer(attachment, { fetchImpl: async (_url, options) => {
    assert.equal(options.redirect, 'error');
    return new Response(source);
  } });
  const metadata = await sharp(output).metadata();
  assert.equal(metadata.width, 640);
  assert.equal(metadata.height, 320);
  await assert.rejects(fetchMediaBuffer(attachment, { fetchImpl: async () => new Response('bad') }), /Could not read/);
  await assert.rejects(fetchMediaBuffer(attachment, { fetchImpl: async () => new Response(Buffer.alloc(MAX_MEDIA_BYTES + 1)) }), /10 MB/);
});


test('direct ephemeral uploads and copied Discord media links are accepted intact', async () => {
  const source = await sharp({ create: { width: 20, height: 20, channels: 3, background: 'blue' } }).png().toBuffer();
  for (const host of ['cdn.discordapp.com', 'media.discordapp.net']) {
    for (const path of ['attachments', 'ephemeral-attachments']) {
      const url = `https://${host}/${path}/1/2/image.png?ex=abc&is=def&hm=signature`;
      const fetchImpl = async (requested) => { assert.equal(requested, url); return new Response(source); };
      for (const input of [selectMediaSource({ url, size: source.length }, null), selectMediaSource(null, url)]) {
        assert.equal((await sharp(await fetchMediaBuffer(input, { fetchImpl })).metadata()).width, 20);
      }
    }
  }
});

test('rejects conflicting inputs and message links with actionable guidance', async () => {
  assert.throws(() => selectMediaSource(attachment, attachment.url), /either/);
  assert.equal(selectMediaSource(null, null), null);
  await assert.rejects(fetchMediaBuffer(selectMediaSource(null, 'https://discord.com/channels/1/2/3')), /Copy Media Link/);
});


test('expired media links explain recovery instead of reporting an invalid image', async () => {
  for (const status of [403, 404, 410]) {
    await assert.rejects(fetchMediaBuffer(attachment, { fetchImpl: async () => new Response(null, { status }) }), /expired or is unavailable/);
  }
  await assert.rejects(fetchMediaBuffer(attachment, { fetchImpl: async () => new Response(null, { status: 429 }) }), /HTTP 429/);
});
