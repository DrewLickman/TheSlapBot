import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ffmpeg from 'ffmpeg-static';
import sharp from 'sharp';
import { fetchMediaBuffer } from '../src/media.js';
import { convertVideo } from '../src/video.js';
const run = promisify(execFile);

test('Discord proxy MP4 converts to a looping animation; long clips are rejected', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'slap-video-test-'));
  try {
    for (const duration of [1, 13]) {
      const path = join(dir, `${duration}.mp4`);
      await run(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', `testsrc=size=32x32:rate=10:duration=${duration}`, '-pix_fmt', 'yuv420p', path], { windowsHide: true });
      const clip = await readFile(path);
      if (duration === 13) {
        await assert.rejects(convertVideo(clip), /too long/);
      } else {
        for (const url of ['https://images-ext-1.discordapp.net/external/hash/https/example.com/clip.mp4', 'https://images-ext-2.discordapp.net/external/hash/https/example.com/clip.mp4', 'https://cdn.discordapp.com/attachments/1/2/clip.mp4']) {
          const result = await fetchMediaBuffer({ url }, { fetchImpl: async requested => { assert.equal(requested, url); return new Response(clip); } });
          const metadata = await sharp(result, { animated: true }).metadata();
          assert.equal(metadata.pages, 10);
          assert.equal(metadata.loop, 0);
          assert.ok(metadata.width <= 340 && metadata.pageHeight <= 160);
        }
      }
    }
    await assert.rejects(convertVideo(Buffer.from('bad video')), /Could not convert/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('external proxy validation rejects lookalike hosts and non-proxy paths', async () => {
  for (const url of ['https://images-ext-1.discordapp.net.evil.test/external/a', 'https://images-ext-1.discordapp.net/not-external/a', 'http://images-ext-1.discordapp.net/external/a']) {
    await assert.rejects(fetchMediaBuffer({ url }, { fetchImpl: async () => { assert.fail('Must not download'); } }), /Copy Media Link/);
  }
});
