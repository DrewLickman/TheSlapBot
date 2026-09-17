import test from 'node:test';
import assert from 'node:assert/strict';
import { handleColorInteraction } from '../src/color-actions.js';
import { PreviewStore } from '../src/preview-store.js';
import { handlePreviewButton } from '../src/preview-actions.js';

function setup(customId = 'slap:palette') {
  const edits = [];
  const previews = new PreviewStore();
  const entry = previews.create('p', { ownerId: 'owner', color: '#ff8800', input: { body: 'hello', feeling: 'happy' }, avatarBuffer: Buffer.from('avatar'), buffer: Buffer.from('old'), commandInteraction: { editReply: async (data) => edits.push(data) } });
  const interaction = { customId, user: { id: 'owner' }, message: { id: 'p' }, values: ['#248cff'], fields: { getTextInputValue: () => '#abcdef' }, replies: [], reply: async function(p) { this.replies.push(p); }, deferReply: async function() { this.deferred = true; }, editReply: async function(p) { this.replies.push(p); }, showModal: async function(p) { this.modal = p; } };
  return { previews, entry, interaction, edits };
}

test('custom hex opens directly from the preview', async () => {
  const ctx = setup('slap:hex');
  await handleColorInteraction(ctx);
  assert.equal(ctx.interaction.modal.toJSON().custom_id, 'slap:hexsubmit:p');
  assert.equal(ctx.interaction.replies.length, 0);
  ctx.previews.clear();
});

test('color change replaces original image and stored post buffer without extending expiry', async () => {
  const ctx = setup();
  const expires = ctx.entry.expiresAt;
  ctx.entry.mediaBuffer = Buffer.from('media');
  await handleColorInteraction({ ...ctx, render: async (input) => { assert.equal(input.mediaBuffer, ctx.entry.mediaBuffer); return Buffer.from('new'); } });
  assert.equal(ctx.entry.buffer.toString(), 'new');
  assert.equal(ctx.entry.color, '#248cff');
  assert.equal(ctx.entry.expiresAt, expires);
  assert.equal(ctx.edits[0].files[0].attachment.toString(), 'new');
  ctx.previews.clear();
});

test('wrong owner and malformed hex cannot render or change a preview', async () => {
  const ctx = setup('slap:hexsubmit:p');
  let calls = 0;
  const render = async () => { calls++; };
  ctx.interaction.user.id = 'other';
  await handleColorInteraction({ ...ctx, render });
  ctx.interaction.user.id = 'owner';
  ctx.interaction.fields.getTextInputValue = () => 'red';
  await handleColorInteraction({ ...ctx, render });
  assert.equal(calls, 0);
  assert.equal(ctx.entry.state, 'preview');
  ctx.previews.clear();
});

test('in-flight color changes block post and cancel; expiry prevents stale image upload', async () => {
  const ctx = setup();
  let finish;
  const pending = handleColorInteraction({ ...ctx, render: () => new Promise(resolve => { finish = resolve; }) });
  await new Promise(resolve => setImmediate(resolve));
  for (const customId of ['slap:post', 'slap:cancel']) {
    await handlePreviewButton({ interaction: { ...ctx.interaction, customId }, previews: ctx.previews, client: {} });
    assert.equal(ctx.entry.state, 'coloring');
  }
  ctx.previews.delete('p', 'expired');
  finish(Buffer.from('late'));
  await pending;
  assert.equal(ctx.edits.length, 0);
  assert.equal(ctx.previews.size, 0);
});

test('ambiguous image replacement failure closes preview to prevent a mismatched post', async () => {
  const ctx = setup();
  ctx.entry.commandInteraction.editReply = async () => { throw new Error('timeout'); };
  await handleColorInteraction({ ...ctx, render: async (input) => { assert.equal(input.mediaBuffer, ctx.entry.mediaBuffer); return Buffer.from('new'); } });
  assert.equal(ctx.previews.size, 0);
  assert.equal(ctx.entry.buffer, null);
});
