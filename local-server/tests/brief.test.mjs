import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCanonicalBrief, verifyProtectedFacts } from '../lib/brief.mjs';
import { enforceReferencePlan } from '../lib/policy.mjs';

function fixture() {
  return {
    graph: {
      destination: 'AI chat',
      items: [
        { id: 'asset_1', kind: 'video', name: 'Demo.mp4', hash: 'h1', intentional: true, role: 'Preserve' },
        { id: 'note_1', kind: 'note', name: 'Text', text: 'Make the transition calm.' },
      ],
      cues: [{ id: 'cue_1', assetId: 'asset_1', noteId: 'note_1', instruction: 'Use this movement.', x: 0.45, y: 0.42, timeMs: 12840 }],
      relations: [],
      motions: [],
    },
    selection: { selected: [{ id: 'asset_1', kind: 'video', name: 'Demo.mp4', hash: 'h1', role: 'Preserve', required: true }], trimmed: [] },
    evidence: [],
  };
}

test('canonical brief preserves exact filenames, coordinates, regions, and timestamps', () => {
  const brief = buildCanonicalBrief(fixture());
  assert.match(brief.prompt, /Demo\.mp4/);
  assert.match(brief.prompt, /00:12\.840/);
  assert.match(brief.prompt, /45% across/);
  assert.match(brief.prompt, /Preserve exactly/);
});

test('candidate verification rejects a missing preserve constraint', () => {
  const canonical = buildCanonicalBrief(fixture());
  const candidate = canonical.prompt.replace(/Preserve exactly:[^\n]+\n?/, '');
  const result = verifyProtectedFacts(candidate, canonical);
  assert.equal(result.ok, false);
  assert.deepEqual(result.missing, ['preserve:asset_1']);
});

test('candidate verification rejects mention of a reference intentionally trimmed by policy', () => {
  const input = fixture();
  input.selection.trimmed = [{ id: 'asset_2', name: 'Unused.png' }];
  const canonical = buildCanonicalBrief(input);
  const result = verifyProtectedFacts(`${canonical.prompt}\nAlso use Unused.png.`, canonical);
  assert.equal(result.ok, false);
  assert.deepEqual(result.forbidden, ['trimmed:asset_2']);
});

test('a selected video physical slot carries its logical frame cue and attachment', () => {
  const graph = {
    destination: 'AI chat',
    items: [
      { id: 'video_1', kind: 'video', name: 'Demo.mp4', hash: 'video', intentional: true },
      { id: 'frame_1', kind: 'video_frame', name: 'Demo.mp4 · 00:12.840', hash: 'frame', intentional: true, provenance: { kind: 'video_frame', parentId: 'video_1', timeMs: 12840 } },
      { id: 'image_1', kind: 'image', name: 'Style.png', hash: 'style', intentional: true },
    ],
    cues: [{ id: 'cue_frame', assetId: 'frame_1', instruction: 'Use this exact pose.', x: 0.5, y: 0.5, timeMs: 12840 }],
    relations: [], motions: [],
  };
  const selection = enforceReferencePlan(graph, 'free');
  const brief = buildCanonicalBrief({ graph, selection, evidence: [] });
  assert.equal(selection.selected.length, 2);
  assert.match(brief.prompt, /Use this exact pose/);
  assert.match(brief.prompt, /00:12\.840/);
  assert.ok(brief.attachments.some(item => item.id === 'frame_1'));
});

test('brief renders only schema-valid accepted operations with authoritative display names', () => {
  const graph = {
    items: [{ id: 'asset_1', kind: 'image', name: 'Source.png' }, { id: 'asset_2', kind: 'image', name: 'Target.png' }],
    operations: [
      {
        intent: 'connect', source: 'asset_1', target: 'asset_2',
        resolution: { schema_version: 'gesture-resolution/1.0', family: 'relation', intent: 'connect', confidence: 0.9, accepted: true, reason: null, alternatives: [], model_version: 'test/1' },
      },
      {
        intent: 'connect', source: 'raw_missing_id', target: 'asset_2',
        resolution: { schema_version: 'gesture-resolution/1.0', family: 'relation', intent: 'connect', confidence: 0.9, accepted: true, reason: null, alternatives: [], model_version: 'test/1' },
      },
      { unresolved: true, resolution: { schema_version: 'gesture-resolution/1.0', family: null, intent: null, confidence: 0, accepted: false, reason: 'model_unavailable', alternatives: [], model_version: null } },
    ],
  };
  const brief = buildCanonicalBrief({ graph, selection: { selected: [], trimmed: [] } });
  assert.match(brief.prompt, /connect from “Source\.png” to “Target\.png”/);
  assert.doesNotMatch(brief.prompt, /raw_missing_id/);
  assert.match(brief.prompt, /Some gesture intents were unresolved or abstained/);
});

test('brief renders a resize with only its authoritative source name', () => {
  const graph = {
    items: [{ id: 'asset_1', kind: 'image', name: 'Source.png' }],
    operations: [{
      intent: 'resize', source: 'asset_1', target: null,
      resolution: { schema_version: 'gesture-resolution/1.0', family: 'transform', intent: 'resize', confidence: 0.9, accepted: true, reason: null, alternatives: [], model_version: 'test/1' },
    }],
  };
  const brief = buildCanonicalBrief({ graph, selection: { selected: [], trimmed: [] } });
  assert.match(brief.prompt, /resize on “Source\.png”/);
  assert.doesNotMatch(brief.prompt, /unresolved or abstained/);
});

test('brief warns instead of printing an unresolved required operation endpoint', () => {
  const graph = {
    items: [{ id: 'asset_2', kind: 'image', name: 'Target.png' }],
    operations: [{
      intent: 'connect', source: 'raw_missing_id', target: 'asset_2',
      resolution: { schema_version: 'gesture-resolution/1.0', family: 'relation', intent: 'connect', confidence: 0.9, accepted: true, reason: null, alternatives: [], model_version: 'test/1' },
    }],
  };
  const brief = buildCanonicalBrief({ graph, selection: { selected: [], trimmed: [] } });
  assert.doesNotMatch(brief.prompt, /raw_missing_id/);
  assert.match(brief.prompt, /Some gesture intents were unresolved or abstained/);
});

test('brief warns instead of rendering a connect operation with one repeated endpoint', () => {
  const graph = {
    items: [{ id: 'asset_1', kind: 'image', name: 'Only.png' }],
    operations: [{
      intent: 'connect', source: 'asset_1', target: 'asset_1',
      resolution: { schema_version: 'gesture-resolution/1.0', family: 'relation', intent: 'connect', confidence: 0.9, accepted: true, reason: null, alternatives: [], model_version: 'test/1' },
    }],
  };
  const brief = buildCanonicalBrief({ graph, selection: { selected: [], trimmed: [] } });
  assert.doesNotMatch(brief.prompt, /connect from “Only\.png” to “Only\.png”/);
  assert.match(brief.prompt, /Some gesture intents were unresolved or abstained/);
});
