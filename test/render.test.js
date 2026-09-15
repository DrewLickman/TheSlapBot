import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { renderLayout, renderSlap } from '../src/render.js';

const avatar = await sharp({
  create: { width: 160, height: 80, channels: 3, background: { r: 27, g: 96, b: 225 } },
}).png().toBuffer();

test('renders the template, escaped body text, feeling, and avatar as a PNG', async () => {
  const output = await renderSlap({
    body: 'Lunch is ready! <b>Come get it.</b> & bring your appetite.',
    feeling: 'Pretty good',
    avatarBuffer: avatar,
  });

  const metadata = await sharp(output).metadata();
  assert.equal(metadata.format, 'png');
  assert.equal(metadata.width, renderLayout.template.width);
  assert.equal(metadata.height, renderLayout.template.height);

  const avatarPixel = await sharp(output)
    .extract({ left: renderLayout.avatar.left + 10, top: renderLayout.avatar.top + 10, width: 1, height: 1 })
    .raw()
    .toBuffer();
  assert.ok(avatarPixel[2] > avatarPixel[0], 'the avatar should cover the pink update area');
});

test('renders maximum-length text and feeling with punctuation and emoji', async () => {
  const output = await renderSlap({
    body: 'A bright day, coffee first, then work! '.repeat(8).slice(0, 280),
    feeling: 'Ready! 😃',
    avatarBuffer: avatar,
  });
  const metadata = await sharp(output).metadata();
  assert.equal(metadata.width, 887);
  assert.equal(metadata.height, 499);
});

test('rejects text that exceeds the supported command limit', async () => {
  await assert.rejects(
    renderSlap({ body: 'x'.repeat(281), feeling: 'Fine', avatarBuffer: avatar }),
    /280 characters/,
  );
});
