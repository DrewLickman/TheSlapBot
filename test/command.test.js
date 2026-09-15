import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSlapCommand } from '../src/slap-command.js';

test('registers /slap with required, bounded text and feeling fields', () => {
  const command = buildSlapCommand().toJSON();
  assert.equal(command.name, 'slap');
  assert.deepEqual(command.options.map(({ name, required, max_length }) => ({ name, required, max_length })), [
    { name: 'text', required: true, max_length: 280 },
    { name: 'feeling', required: true, max_length: 32 },
  ]);
});
