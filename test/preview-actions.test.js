import test from 'node:test';
import assert from 'node:assert/strict';
import { MessageFlags } from 'discord.js';
import { CANCEL_BUTTON, POST_BUTTON } from '../src/preview-components.js';
import { handlePreviewButton } from '../src/preview-actions.js';
import { PreviewStore } from '../src/preview-store.js';

function makeInteraction(customId, userId = 'owner') {
  return {
    customId,
    user: { id: userId },
    message: { id: 'preview-1' },
    replied: false,
    deferred: false,
    updates: [],
    replies: [],
    edits: [],
    deferUpdates: 0,
    async update(payload) {
      this.updates.push(payload);
      this.replied = true;
    },
    async deferUpdate() {
      this.deferUpdates += 1;
      this.deferred = true;
    },
    async reply(payload) {
      this.replies.push(payload);
      this.replied = true;
    },
    async editReply(payload) {
      this.edits.push(payload);
    },
  };
}

function makePreviewStore() {
  const previews = new PreviewStore({ ttlMs: 60_000 });
  const entry = previews.create('preview-1', {
    ownerId: 'owner',
    channelId: 'channel-1',
    buffer: Buffer.from('png-data'),
    commandInteraction: { deleteReply: async () => { entry.deleteReplyCalls = (entry.deleteReplyCalls ?? 0) + 1; } },
  });
  return { previews, entry };
}

test('cancel removes the in-memory image and deletes the private preview without a replacement message', async () => {
  const { previews, entry } = makePreviewStore();
  const interaction = makeInteraction(CANCEL_BUTTON);
  let sendCalls = 0;

  await handlePreviewButton({
    interaction,
    previews,
    client: { channels: { fetch: async () => ({ send: async () => { sendCalls += 1; } }) } },
  });

  assert.equal(previews.get('preview-1'), undefined);
  assert.equal(entry.state, 'cancelled');
  assert.equal(entry.buffer, null);
  assert.equal(sendCalls, 0);
  assert.equal(interaction.deferUpdates, 1);
  assert.equal(entry.deleteReplyCalls, 1);
  assert.deepEqual(interaction.updates, []);
  assert.deepEqual(interaction.replies, []);
});

test('only the preview owner can post it', async () => {
  const { previews } = makePreviewStore();
  const interaction = makeInteraction(POST_BUTTON, 'another-user');
  let sendCalls = 0;

  await handlePreviewButton({
    interaction,
    previews,
    client: { channels: { fetch: async () => ({ send: async () => { sendCalls += 1; } }) } },
  });

  assert.equal(sendCalls, 0);
  assert.equal(previews.get('preview-1').state, 'preview');
  assert.equal(interaction.replies[0].flags, MessageFlags.Ephemeral);
  assert.match(interaction.replies[0].content, /Only the person/);
});

test('posting sends the preview image once, disables its controls, and releases the buffer', async () => {
  const { previews, entry } = makePreviewStore();
  const interaction = makeInteraction(POST_BUTTON);
  let sendCalls = 0;
  let sentPayload;
  const client = {
    channels: {
      fetch: async (id) => {
        assert.equal(id, 'channel-1');
        return {
          isTextBased: () => true,
          send: async (payload) => {
            sendCalls += 1;
            sentPayload = payload;
            return { url: 'https://discord.com/channels/1/2/3' };
          },
        };
      },
    },
  };

  await handlePreviewButton({ interaction, client, previews });

  assert.equal(sendCalls, 1);
  assert.equal(sentPayload.files[0].name, 'slap.png');
  assert.deepEqual(sentPayload.allowedMentions, { parse: [] });
  assert.equal(entry.state, 'posted');
  assert.equal(entry.buffer, null);
  assert.equal(previews.size, 0);
  assert.deepEqual(
    interaction.updates[0].components.flatMap(row => row.toJSON().components).map(({ disabled }) => disabled),
    [true, true, true, true],
  );
  assert.match(interaction.edits[0].content, /Posted\./);
  assert.deepEqual(interaction.edits[0].components, []);
});

test('simultaneous Post clicks claim the preview once and publish only one message', async () => {
  const { previews } = makePreviewStore();
  const firstInteraction = makeInteraction(POST_BUTTON);
  const secondInteraction = makeInteraction(POST_BUTTON);
  let resolveSend;
  let sendStarted;
  const started = new Promise((resolve) => { sendStarted = resolve; });
  const sendResult = new Promise((resolve) => { resolveSend = resolve; });
  let sendCalls = 0;
  const client = {
    channels: {
      fetch: async () => ({
        isTextBased: () => true,
        send: () => {
          sendCalls += 1;
          sendStarted();
          return sendResult;
        },
      }),
    },
  };

  const firstPost = handlePreviewButton({ interaction: firstInteraction, client, previews });
  await started;
  await handlePreviewButton({ interaction: secondInteraction, client, previews });
  assert.equal(sendCalls, 1);
  assert.match(secondInteraction.replies[0].content, /already in progress/);

  resolveSend({ url: 'https://discord.com/channels/1/2/3' });
  await firstPost;
  assert.equal(sendCalls, 1);
  assert.equal(previews.size, 0);
});

test('expired Post clears the stale preview without publishing', async () => {
  const { previews, entry } = makePreviewStore();
  entry.expiresAt = Date.now() - 1;
  const interaction = makeInteraction(POST_BUTTON);
  let sendCalls = 0;

  await handlePreviewButton({
    interaction,
    previews,
    client: { channels: { fetch: async () => ({ send: async () => { sendCalls += 1; } }) } },
  });

  assert.equal(sendCalls, 0);
  assert.equal(previews.size, 0);
  assert.equal(entry.state, 'expired');
  assert.equal(entry.buffer, null);
  assert.deepEqual(interaction.updates[0].attachments, []);
  assert.deepEqual(interaction.updates[0].components, []);
});

test('missing channel permissions leave no retryable duplicate and explain the required access', async () => {
  const { previews, entry } = makePreviewStore();
  const interaction = makeInteraction(POST_BUTTON);
  let sendCalls = 0;
  const client = {
    channels: {
      fetch: async () => ({
        isTextBased: () => true,
        send: async () => {
          sendCalls += 1;
          throw Object.assign(new Error('Missing permissions'), { code: 50013, status: 403 });
        },
      }),
    },
  };

  await handlePreviewButton({ interaction, client, previews });

  assert.equal(sendCalls, 1);
  assert.equal(previews.size, 0);
  assert.equal(entry.buffer, null);
  assert.match(interaction.edits[0].content, /Send Messages/);
  assert.match(interaction.edits[0].content, /Attach Files/);
  assert.deepEqual(interaction.edits[0].components, []);
});

test('a private preview that cannot be posted because its channel is gone is cleared', async () => {
  const { previews, entry } = makePreviewStore();
  const interaction = makeInteraction(POST_BUTTON);
  const client = { channels: { fetch: async () => null } };

  await handlePreviewButton({ interaction, client, previews });

  assert.equal(previews.size, 0);
  assert.equal(entry.buffer, null);
  assert.match(interaction.edits[0].content, /no longer available/);
  assert.deepEqual(interaction.edits[0].components, []);
});
