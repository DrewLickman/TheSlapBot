import test from 'node:test';
import assert from 'node:assert/strict';
import { CANCEL_BUTTON, POST_BUTTON, HEX_BUTTON, buildPreviewButtons, buildPreviewComponents } from '../src/preview-components.js';

test('preview controls expose Post and Cancel, and can be disabled after a decision', () => {
  const buttons = buildPreviewButtons().toJSON().components;
  assert.deepEqual(buttons.map(({ custom_id, label }) => ({ custom_id, label })), [
    { custom_id: POST_BUTTON, label: 'Post' },
    { custom_id: CANCEL_BUTTON, label: 'Cancel' },
    { custom_id: HEX_BUTTON, label: 'Custom hex' },
  ]);
  assert.deepEqual(buildPreviewButtons(true).toJSON().components.map(({ disabled }) => disabled), [true, true, true]);
});

test('palette is directly on the preview and all controls disable during posting', () => {
  const rows = buildPreviewComponents(true).map(row => row.toJSON());
  assert.equal(rows[0].components[0].placeholder, 'Choose a phone color');
  assert.equal(rows[0].components[0].options.length, 8);
  assert.ok(rows.flatMap(row => row.components).every(item => item.disabled));
});
