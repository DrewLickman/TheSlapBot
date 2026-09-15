import test from 'node:test';
import assert from 'node:assert/strict';
import { isPreviewOwner, PreviewStore } from '../src/preview-store.js';

test('only the preview creator is authorized to use its controls', () => {
  const preview = { ownerId: 'user-1' };
  assert.equal(isPreviewOwner(preview, 'user-1'), true);
  assert.equal(isPreviewOwner(preview, 'user-2'), false);
  assert.equal(isPreviewOwner(undefined, 'user-1'), false);
});

test('a preview can be claimed only once and deleting it releases its image', () => {
  const store = new PreviewStore({ ttlMs: 1000 });
  const entry = store.create('message-1', { buffer: Buffer.from('image') });

  assert.equal(store.claim('message-1'), true);
  assert.equal(store.claim('message-1'), false);
  assert.equal(store.get('message-1').state, 'posting');
  assert.equal(store.delete('message-1', 'posted'), entry);
  assert.equal(entry.buffer, null);
  assert.equal(store.size, 0);
});

test('a preview expires once, releases its image, and calls its expiry handler', async () => {
  let resolveExpiry;
  const expiry = new Promise((resolve) => { resolveExpiry = resolve; });
  const store = new PreviewStore({
    ttlMs: 20,
    unrefTimers: false,
    onExpire: (id, entry) => resolveExpiry({ id, state: entry.state, buffer: entry.buffer }),
  });
  store.create('message-2', { buffer: Buffer.from('image') });

  assert.deepEqual(await expiry, { id: 'message-2', state: 'expired', buffer: null });
  assert.equal(store.get('message-2'), undefined);
  assert.equal(store.size, 0);
});
