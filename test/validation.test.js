import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_BODY_CHARS, MAX_FEELING_CHARS, normalizeSlapInput } from '../src/validation.js';

test('normalizes required text and feeling without changing their inner content', () => {
  assert.deepEqual(normalizeSlapInput('  Lunch is ready\n  ', '  Pretty good  '), {
    body: 'Lunch is ready',
    feeling: 'Pretty good',
  });
});

test('rejects blank fields and input beyond Discord option limits', () => {
  assert.throws(() => normalizeSlapInput('  ', 'Fine'), /Text cannot be empty/);
  assert.throws(() => normalizeSlapInput('Update', '\n'), /Feeling cannot be empty/);
  assert.throws(() => normalizeSlapInput('x'.repeat(MAX_BODY_CHARS + 1), 'Fine'), /280 characters/);
  assert.throws(() => normalizeSlapInput('Update', 'x'.repeat(MAX_FEELING_CHARS + 1)), /32 characters/);
});

test('accepts the maximum supported lengths', () => {
  const result = normalizeSlapInput('x'.repeat(MAX_BODY_CHARS), 'y'.repeat(MAX_FEELING_CHARS));
  assert.equal(result.body.length, MAX_BODY_CHARS);
  assert.equal(result.feeling.length, MAX_FEELING_CHARS);
});
