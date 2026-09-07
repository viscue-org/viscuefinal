import test from 'node:test';
import assert from 'node:assert/strict';
import { validateCueEligibility } from '../src/utils/cueEligibility.mjs';

test('a meaningful text-only workspace can be sent without an asset', () => {
  assert.deepEqual(validateCueEligibility([
    { id: 'note-1', type: 'text', data: { text: 'Create a calm onboarding flow with three steps.' } },
  ], []), { ok: true });
});
test('an empty workspace asks for either text or a visual asset', () => {
  assert.deepEqual(validateCueEligibility([], []), {
    ok: false,
    error: 'Add a text instruction or visual Asset before sending intent.',
  });
});

test('an empty text note remains invalid', () => {
  assert.deepEqual(validateCueEligibility([
    { id: 'note-1', type: 'text', data: { text: '   ' } },
  ], []), {
    ok: false,
    error: 'Please fill in all empty text notes before submitting.',
  });
});
