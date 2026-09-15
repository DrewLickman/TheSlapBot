import test from 'node:test';
import assert from 'node:assert/strict';
import { getPostFailureMessage } from '../src/post-errors.js';

test('explains the channel permissions needed after a known permission denial', () => {
  const message = getPostFailureMessage({ code: 50013, status: 403 });
  assert.match(message, /Send Messages/);
  assert.match(message, /Attach Files/);
});

test('warns the user to check the channel after an ambiguous send without retrying', () => {
  const message = getPostFailureMessage({ name: 'AbortError' });
  assert.match(message, /did not confirm/);
  assert.match(message, /Check the channel/);
  assert.match(message, /will not resend it automatically/);
});

test('reports a channel that disappeared while the preview was open', () => {
  assert.match(getPostFailureMessage({ status: 404 }), /no longer available/);
});
