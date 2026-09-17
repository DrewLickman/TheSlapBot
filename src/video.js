import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ffmpeg from 'ffmpeg-static';
import sharp from 'sharp';

const run = promisify(execFile);
export async function convertVideo(buffer) {
  const directory = await mkdtemp(join(tmpdir(), 'slap-video-'));
  try {
    const input = join(directory, 'input.mp4');
    const output = join(directory, 'output.gif');
    await writeFile(input, buffer);
    await run(ffmpeg, [
      '-hide_banner', '-loglevel', 'error', '-nostdin', '-threads', '1',
      '-protocol_whitelist', 'file,pipe', '-f', 'mov', '-i', input,
      '-an', '-sn', '-dn', '-map', '0:v:0', '-t', '12.1', '-frames:v', '121',
      '-filter_threads', '1', '-vf', 'fps=10,scale=340:160:force_original_aspect_ratio=decrease',
      '-loop', '0', output,
    ], { timeout: 30_000, maxBuffer: 64 * 1024, windowsHide: true });
    const gif = await readFile(output);
    const metadata = await sharp(gif).metadata();
    if (metadata.pages > 120) throw new RangeError('That video is too long. Use an MP4 clip up to 12 seconds.');
    return gif;
  } catch (error) {
    if (error instanceof RangeError) throw error;
    throw new RangeError('Could not convert that video. Use an MP4 clip up to 12 seconds and 10 MB, or upload a GIF.');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
