import sharp from 'sharp';

export const PHONE_COLORS = Object.freeze([
  ['Green', '#45e600'], ['Teal', '#00d5b0'], ['Blue', '#248cff'],
  ['Purple', '#a855f7'], ['Pink', '#ff55b8'], ['Red', '#ef3340'],
  ['Orange', '#ff8800'], ['Yellow', '#ffda22'],
].map(([label, value]) => ({ label, value })));

export function normalizeColor(value) {
  const hex = String(value ?? '').trim();
  if (!/^#?[0-9a-f]{6}$/i.test(hex)) throw new RangeError('Enter a six-digit color, such as #FF8800.');
  return `#${hex.replace(/^#/, '').toLowerCase()}`;
}
export function randomPhoneColor() {
  return PHONE_COLORS[Math.floor(Math.random() * PHONE_COLORS.length)].value;
}

export function commandPhoneColor(value) {
  if (value == null) return randomPhoneColor();
  const named = PHONE_COLORS.find(({ label }) => label.toLowerCase() === value.trim().toLowerCase());
  if (named) return named.value;
  try { return normalizeColor(value); } catch {
    throw new RangeError('Use green, teal, blue, purple, pink, red, orange, yellow, or a six-digit hex such as #FF8800.');
  }
}

// Fixed template shell outline. The inner cutout protects the screen and controls.
const shellMask = Buffer.from(`<svg width="887" height="499"><path fill="white" stroke="white" stroke-width="18" stroke-linejoin="round" fill-rule="evenodd" d="M75 241 C77 165 164 127 253 88 C361 45 506 6 578 10 C666 6 742 60 783 133 C820 206 817 300 791 368 C765 436 685 478 583 480 C502 480 448 428 357 401 C284 378 229 405 164 394 C93 386 69 325 75 241 Z M94 243 C94 184 172 143 262 106 C360 68 502 26 577 28 C646 26 681 69 696 121 C711 175 711 245 700 303 C690 380 656 442 588 457 C511 476 449 416 365 381 C282 347 237 375 170 373 C111 372 89 319 94 243 Z"/></svg>`);
let maskPromise;

export async function recolorPhone(template, color) {
  const hex = normalizeColor(color);
  const target = [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255);
  const { data, info } = await sharp(template).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  maskPromise ??= sharp(shellMask).ensureAlpha().raw().toBuffer();
  const mask = await maskPromise;
  for (let pixel = 0; pixel < info.width * info.height; pixel++) {
    const i = pixel * 3;
    const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
    // Blend edge pixels and keep highlights, logos, and dark frame details intact.
    const strength = mask[pixel * 4 + 3] / 255 * Math.min(1, Math.max(0, (g - Math.max(r, b)) / 35));
    if (!strength) continue;
    const white = Math.min(r, g, b) / 255;
    const light = g / 255;
    for (let c = 0; c < 3; c++) {
      const replacement = 255 * (white + (light - white) * target[c]);
      data[i + c] = Math.round(data[i + c] * (1 - strength) + replacement * strength);
    }
  }
  return sharp(data, { raw: info }).png().toBuffer();
}

