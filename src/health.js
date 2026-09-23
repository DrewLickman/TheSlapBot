import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import sharp from 'sharp';
import ffmpegPath from 'ffmpeg-static';

const execFileAsync = promisify(execFile);

export async function probeDependencies() {
  const sharpReady = await sharp({
    create: { width: 1, height: 1, channels: 4, background: '#000000' },
  }).raw().toBuffer().then(() => true, () => false);
  const ffmpegReady = ffmpegPath
    ? await execFileAsync(ffmpegPath, ['-version'], { timeout: 2000, windowsHide: true }).then(() => true, () => false)
    : false;
  return { sharp: sharpReady, ffmpeg: ffmpegReady };
}

export function createHealthServer(client, dependencies = probeDependencies) {
  return createServer(async (request, response) => {
    if (request.method !== 'GET' || request.url !== '/health') {
      response.writeHead(404).end();
      return;
    }

    let checks;
    try {
      checks = await dependencies();
    } catch {
      checks = { sharp: false, ffmpeg: false };
    }
    const discordReady = client.isReady();
    const healthy = discordReady && checks.sharp && checks.ffmpeg;
    response.writeHead(healthy ? 200 : 503, {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    }).end(JSON.stringify({
      status: healthy ? 'healthy' : 'unhealthy',
      discord: { ready: discordReady },
      dependencies: checks,
      observedAt: new Date().toISOString(),
    }));
  });
}

export async function startHealthServer(client, { port = Number(process.env.HEALTH_PORT || 4320), dependencies } = {}) {
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Invalid HEALTH_PORT');
  const server = createHealthServer(client, dependencies);
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => {
      server.off('error', reject);
      resolve();
    });
  });
  return server;
}