import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { normalizeSlapInput } from './validation.js';

const TEMPLATE_PATH = fileURLToPath(new URL('../assets/pear-phone-template.png', import.meta.url));
const FONT_PATH = fileURLToPath(new URL('../assets/fonts/Play-Regular.ttf', import.meta.url));
const TEMPLATE_WIDTH = 887;
const TEMPLATE_HEIGHT = 499;
const BODY_BOX = { left: 312, top: 125, width: 340, height: 160 };
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

async function renderText(text, { width, height, color, fontSizes, wrap = 'word-char' }) {
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
      return rendered.data;
    }
  }

  throw new RangeError('That text is too long to fit legibly. Shorten it and try again.');
}

export async function renderSlap({ body, feeling, avatarBuffer, templateBuffer } = {}) {
  const normalized = normalizeSlapInput(body, feeling);
  if (!Buffer.isBuffer(avatarBuffer) || avatarBuffer.length === 0) {
    throw new TypeError('An avatar image is required.');
  }

  const template = templateBuffer ?? await getTemplate();
  const metadata = await sharp(template, { limitInputPixels: MAX_TEXT_PIXELS }).metadata();
  if (metadata.width !== TEMPLATE_WIDTH || metadata.height !== TEMPLATE_HEIGHT) {
    throw new Error(`The pear-phone template must be ${TEMPLATE_WIDTH} × ${TEMPLATE_HEIGHT} pixels.`);
  }

  const [bodyOverlay, feelingOverlay, avatar] = await Promise.all([
    renderText(normalized.body, {
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

  return sharp(template)
    .composite([
      { input: avatar, left: AVATAR_BOX.left, top: AVATAR_BOX.top },
      { input: bodyOverlay, left: BODY_BOX.left, top: BODY_BOX.top },
      { input: feelingOverlay, left: FEELING_BOX.left, top: FEELING_BOX.top },
    ])
    .png()
    .toBuffer();
}

export const renderLayout = Object.freeze({
  template: { width: TEMPLATE_WIDTH, height: TEMPLATE_HEIGHT },
  body: BODY_BOX,
  feeling: FEELING_BOX,
  avatar: AVATAR_BOX,
});
