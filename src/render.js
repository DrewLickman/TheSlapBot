import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { normalizeSlapInput } from './validation.js';
import { validateGif, MAX_MEDIA_BYTES } from './media.js';
import { recolorPhone } from './phone-colors.js';

const TEMPLATE_PATH = fileURLToPath(new URL('../assets/pear-phone-template.png', import.meta.url));
const FONT_PATH = fileURLToPath(new URL('../assets/fonts/Play-Regular.ttf', import.meta.url));
const TEMPLATE_WIDTH = 887;
const TEMPLATE_HEIGHT = 499;
const BODY_BOX = { left: 312, top: 125, width: 340, height: 160 };
const MEDIA_GAP = 10;
const BODY_FONT_SIZES = [18, 17, 16, 15, 14, 13, 12];
const mediaLayouts = new WeakMap();
const FEELING_BOX = { left: 435, top: 308, width: 221, height: 28 };
const AVATAR_BOX = { left: 178, top: 180, size: 116 };
const MAX_TEXT_PIXELS = 1_000_000;

let templatePromise;

function getTemplate() {
  templatePromise ??= readFile(TEMPLATE_PATH);
  return templatePromise;
}

function escapePangoText(value) {
  return value
    .replace(/\r\n?/g, '\n')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

async function renderText(text, { width, height, color, fontSizes, wrap = 'word-char', measured = false }) {
  const markup = `<span foreground="${color}">${escapePangoText(text)}</span>`;
  for (const fontSize of fontSizes) {
    const rendered = await sharp({
      text: {
        text: markup,
        font: `Play ${fontSize}`,
        fontfile: FONT_PATH,
        width,
        dpi: 72,
        rgba: true,
        wrap,
        spacing: 1,
      },
    })
      .png()
      .toBuffer({ resolveWithObject: true });

    if (rendered.info.width <= width && rendered.info.height <= height) {
      return measured ? { buffer: rendered.data, width: rendered.info.width, height: rendered.info.height, fontSize } : rendered.data;
    }
  }

  throw new RangeError('That text is too long to fit legibly. Shorten it and try again.');
}

export async function chooseMediaLayout(body, mediaWidth, mediaHeight) {
  for (const fontSize of BODY_FONT_SIZES) {
    const candidates = [];
    for (const placement of ['beside', 'below']) {
      let text;
      try {
        text = await renderText(body, { width: placement === 'beside' ? 200 : BODY_BOX.width,
          height: BODY_BOX.height, color: '#263943', fontSizes: [fontSize], measured: true });
      } catch (error) {
        if (error instanceof RangeError) continue;
        throw error;
      }
      const available = placement === 'beside'
        ? { left: BODY_BOX.left + text.width + MEDIA_GAP, top: BODY_BOX.top,
            width: BODY_BOX.width - text.width - MEDIA_GAP, height: BODY_BOX.height }
        : { left: BODY_BOX.left, top: BODY_BOX.top + text.height + MEDIA_GAP,
            width: BODY_BOX.width, height: BODY_BOX.height - text.height - MEDIA_GAP };
      const scale = Math.min(available.width / mediaWidth, available.height / mediaHeight);
      const width = Math.floor(mediaWidth * scale);
      const height = Math.floor(mediaHeight * scale);
      if (width < 24 || height < 24) continue;
      const media = { width, height, left: available.left + Math.floor((available.width - width) / 2),
        top: available.top + Math.floor((available.height - height) / 2) };
      candidates.push({ placement, text, media, available });
    }
    if (candidates.length) {
      return candidates.reduce((best, item) => item.media.width * item.media.height > best.media.width * best.media.height ? item : best);
    }
  }
  throw new RangeError('That text is too long to fit legibly. Shorten it and try again.');
}

export async function renderSlap({ body, feeling, avatarBuffer, mediaBuffer, templateBuffer, color } = {}) {
  const normalized = normalizeSlapInput(body, feeling);
  if (!Buffer.isBuffer(avatarBuffer) || avatarBuffer.length === 0) {
    throw new TypeError('An avatar image is required.');
  }

  const template = templateBuffer ?? await getTemplate();
  const metadata = await sharp(template, { limitInputPixels: MAX_TEXT_PIXELS }).metadata();
  if (metadata.width !== TEMPLATE_WIDTH || metadata.height !== TEMPLATE_HEIGHT) {
    throw new Error(`The pear-phone template must be ${TEMPLATE_WIDTH} × ${TEMPLATE_HEIGHT} pixels.`);
  }

  const mediaMetadata = mediaBuffer ? await sharp(mediaBuffer, { limitInputPixels: 20_000_000 }).metadata() : null;
  const animated = mediaMetadata?.format === 'gif' && mediaMetadata.pages > 1;
  if (animated) validateGif(mediaMetadata);
  let layout;
  if (mediaBuffer) {
    const cached = mediaLayouts.get(mediaBuffer);
    if (cached?.body === normalized.body) layout = cached.layout;
    else {
      const rotated = [5, 6, 7, 8].includes(mediaMetadata.orientation);
      const width = mediaMetadata.width;
      const height = mediaMetadata.pageHeight ?? mediaMetadata.height;
      layout = await chooseMediaLayout(normalized.body, rotated ? height : width, rotated ? width : height);
      mediaLayouts.set(mediaBuffer, { body: normalized.body, layout });
    }
  }

  const [bodyOverlay, feelingOverlay, avatar] = await Promise.all([
    layout ? layout.text.buffer : renderText(normalized.body, {
      width: BODY_BOX.width,
      height: BODY_BOX.height,
      color: '#263943',
      fontSizes: [18, 17, 16, 15, 14, 13, 12],
    }),
    renderText(normalized.feeling.toLocaleUpperCase('en-US'), {
      width: FEELING_BOX.width,
      height: FEELING_BOX.height,
      color: '#a52d3c',
      fontSizes: [18, 17, 16, 15, 14, 13, 12],
      wrap: 'none',
    }),
    sharp(avatarBuffer, { limitInputPixels: MAX_TEXT_PIXELS })
      .rotate()
      .resize(AVATAR_BOX.size, AVATAR_BOX.size, { fit: 'cover', position: 'centre' })
      .png()
      .toBuffer(),
  ]);

  const tiltedFeeling = await sharp(feelingOverlay).rotate(-1.8, { background: '#00000000' }).png().toBuffer({ resolveWithObject: true });
  const base = await sharp(color ? await recolorPhone(template, color) : template)
    .composite([
      { input: avatar, left: AVATAR_BOX.left, top: AVATAR_BOX.top },
      { input: bodyOverlay, left: BODY_BOX.left, top: BODY_BOX.top },
      { input: tiltedFeeling.data, left: FEELING_BOX.left, top: 333 - tiltedFeeling.info.height },
    ]).png().toBuffer();
  if (!mediaBuffer) return base;
  const frameCount = animated ? mediaMetadata.pages : 1;
  const frameBytes = TEMPLATE_WIDTH * TEMPLATE_HEIGHT * 4;
  const frames = animated ? Buffer.alloc(frameBytes * frameCount) : null;
  for (let page = 0; page < frameCount; page++) {
    const media = await sharp(mediaBuffer, { page, pages: 1, limitInputPixels: 20_000_000 })
      .rotate().resize(layout.media.width, layout.media.height, { fit: 'contain', background: '#00000000' })
      .png().toBuffer();
    const frame = sharp(base).composite([{ input: media, left: layout.media.left, top: layout.media.top }]);
    if (!animated) return frame.png().toBuffer();
    (await frame.ensureAlpha().raw().toBuffer()).copy(frames, page * frameBytes);
  }
  const output = await sharp(frames, { raw: {
    width: TEMPLATE_WIDTH, height: TEMPLATE_HEIGHT * frameCount, channels: 4, pageHeight: TEMPLATE_HEIGHT,
  } }).gif({ delay: mediaMetadata.delay, loop: mediaMetadata.loop ?? 0 }).toBuffer();
  if (output.length > MAX_MEDIA_BYTES) throw new RangeError('The animated phone image exceeds 10 MB. Try a shorter GIF.');
  return output;
}

export const renderLayout = Object.freeze({
  template: { width: TEMPLATE_WIDTH, height: TEMPLATE_HEIGHT },
  body: BODY_BOX,
  mediaGap: MEDIA_GAP,
  feeling: FEELING_BOX,
  avatar: AVATAR_BOX,
});
