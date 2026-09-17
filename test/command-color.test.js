import test from 'node:test';
import assert from 'node:assert/strict';
import { commandPhoneColor, PHONE_COLORS } from '../src/phone-colors.js';

test('command accepts named and hex colors, defaults only when omitted', () => {
  assert.equal(commandPhoneColor(' Blue '), '#248cff');
  assert.equal(commandPhoneColor('#ABCDEF'), '#abcdef');
  assert.equal(commandPhoneColor('FF8800'), '#ff8800');
  const randomColor = commandPhoneColor(null);
  assert.ok(PHONE_COLORS.some(({ value }) => value === randomColor));
  assert.throws(() => commandPhoneColor('invalid'), /Use green/);
  assert.throws(() => commandPhoneColor(''), /Use green/);
});
