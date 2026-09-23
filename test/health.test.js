import assert from 'node:assert/strict';
import { test } from 'node:test';
import { once } from 'node:events';
import { probeDependencies, startHealthServer } from '../src/health.js';

async function withServer(client, dependencies, run) {
  const server = await startHealthServer(client, { port: 0, dependencies });
  try {
    const address = server.address();
    assert.equal(address.address, '127.0.0.1');
    await run('http://127.0.0.1:' + address.port);
  } finally {
    server.close();
    await once(server, 'close');
  }
}

test('health requires Discord connection and both media dependencies', async () => {
  let ready = false;
  let checks = { sharp: true, ffmpeg: true };
  await withServer({ isReady: () => ready }, async () => checks, async (base) => {
    const disconnected = await fetch(base + '/health');
    assert.equal(disconnected.status, 503);
    assert.equal((await disconnected.json()).discord.ready, false);
    ready = true;
    const healthy = await fetch(base + '/health');
    assert.equal(healthy.status, 200);
    assert.deepEqual((await healthy.json()).dependencies, { sharp: true, ffmpeg: true });
    checks = { sharp: true, ffmpeg: false };
    const missingFfmpeg = await fetch(base + '/health');
    assert.equal(missingFfmpeg.status, 503);
    assert.equal((await missingFfmpeg.json()).dependencies.ffmpeg, false);
    assert.equal((await fetch(base + '/other')).status, 404);
  });
});

test('installed Sharp and ffmpeg executables are usable', async () => {
  assert.deepEqual(await probeDependencies(), { sharp: true, ffmpeg: true });
});