import test from 'node:test';
import assert from 'node:assert/strict';
import { CANCEL_BUTTON, POST_BUTTON, buildPreviewButtons } from '../src/preview-components.js';

test('preview controls expose Post and Cancel, and can be disabled after a decision', () => {
  const buttons = buildPreviewButtons().toJSON().components;
  assert.deepEqual(buttons.map(({ custom_id, label }) => ({ custom_id, label })), [
    { custom_id: POST_BUTTON, label: 'Post' },
    { custom_id: CANCEL_BUTTON, label: 'Cancel' },
  ]);
  assert.deepEqual(buildPreviewButtons(true).toJSON().components.map(({ disabled }) => disabled), [true, true]);
});
