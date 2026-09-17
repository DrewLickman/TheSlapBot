import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { fetchMediaBuffer, imageFilename, validateGif } from '../src/media.js';
import { renderSlap, renderLayout, chooseMediaLayout } from '../src/render.js';

const raw = Buffer.concat([Buffer.from([255, 0, 0, 255]), Buffer.from([0, 0, 255, 255])]);
const gif = await sharp(raw, { raw: { width: 1, height: 2, channels: 4, pageHeight: 1 } })
  .gif({ delay: [100, 250], loop: 3 }).toBuffer();
const avatar = await sharp({ create: { width: 30, height: 30, channels: 3, background: 'green' } }).png().toBuffer();

test('GIF upload stays animated through rendering and recoloring with correct attachment names', async () => {
  const mediaBuffer = await fetchMediaBuffer({ url: 'https://cdn.discordapp.com/ephemeral-attachments/1/2/test.gif', size: gif.length }, { fetchImpl: async () => new Response(gif) });
  assert.deepEqual(mediaBuffer, gif);
  for (const color of ['#248cff', '#ff8800']) {
    const output = await renderSlap({ body: 'Animated!', feeling: 'Happy', avatarBuffer: avatar, mediaBuffer, color });
    const metadata = await sharp(output, { animated: true }).metadata();
    assert.equal(metadata.pages, 2);
    assert.equal(metadata.pageHeight, 499);
    assert.deepEqual(metadata.delay, [100, 250]);
    assert.equal(metadata.loop, 3);
    assert.equal(imageFilename(output, 'slap-preview'), 'slap-preview.gif');
    assert.equal(imageFilename(output), 'slap.gif');
    const frames = [];
    for (let page = 0; page < 2; page++) {
      frames.push(await sharp(output, { page, pages: 1 }).ensureAlpha().raw().toBuffer());
    }
    const layout = await chooseMediaLayout('Animated!', 1, 1);
    const { left, top } = layout.media;
    const offset = ((top + 10) * 887 + left + 10) * 4;
    assert.ok(frames[0][offset] > 200 && frames[0][offset + 2] < 50);
    assert.ok(frames[1][offset + 2] > 200 && frames[1][offset] < 50);
    // Static text/avatar region remains identical between frames.
    for (let y = 125; y < 280; y++) {
      assert.deepEqual(frames[0].subarray((y * 887 + 178) * 4, (y * 887 + 312) * 4), frames[1].subarray((y * 887 + 178) * 4, (y * 887 + 312) * 4));
    }
  }
});

test('animation resource bounds reject excessive frame counts and decoded pixels', () => {
  assert.throws(() => validateGif({ pages: 121, width: 1, height: 1 }), /120 frames/);
  assert.throws(() => validateGif({ pages: 100, width: 1000, height: 1000 }), /total frame pixels/);
  assert.equal(imageFilename(Buffer.from('PNG')), 'slap.png');
});
