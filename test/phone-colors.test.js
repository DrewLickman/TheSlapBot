import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import { recolorPhone, normalizeColor, randomPhoneColor, PHONE_COLORS } from '../src/phone-colors.js';

test('palette randomization and custom colors accept only six-digit hex', () => {
  assert.equal(normalizeColor(' ABCDEF '), '#abcdef');
  assert.throws(() => normalizeColor('#fff'), RangeError);
  for (let i = 0; i < 30; i++) {
    const color = randomPhoneColor();
    assert.ok(PHONE_COLORS.some(c => c.value === color));
  }
});

test('recoloring changes shell while preserving screen, avatar area and distant background', async () => {
  const template = await readFile(new URL('../assets/pear-phone-template.png', import.meta.url));
  const source = await sharp(template).removeAlpha().raw().toBuffer();
  const colored = await sharp(await recolorPhone(template, '#ff8800')).removeAlpha().raw().toBuffer();
  for (const [x, y] of [[10, 10], [440, 200], [200, 210], [520, 320]]) {
    const i = (y * 887 + x) * 3;
    assert.deepEqual(colored.subarray(i, i + 3), source.subarray(i, i + 3));
  }
  const shell = (200 * 887 + 760) * 3;
  assert.ok(colored[shell] > colored[shell + 1]);
  assert.notDeepEqual(colored.subarray(shell, shell + 3), source.subarray(shell, shell + 3));
});
