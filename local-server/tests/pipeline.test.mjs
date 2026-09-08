import test from 'node:test';
import assert from 'node:assert/strict';
import { runPipeline } from '../lib/pipeline.mjs';

function requestWith(count = 1, plan = 'free') {
  const items = Array.from({ length: count }, (_, index) => ({ id: `asset_${index}`, kind: 'image', visualKind: 'image', name: `Image ${index}.png`, hash: `hash_${index}`, intentional: true, role: 'Reference' }));
  return {
    graph: { destination: 'ChatGPT', items, cues: [{ id: 'cue_0', assetId: 'asset_0', instruction: 'Keep the red object.', x: 0.4, y: 0.5 }], relations: [], motions: [] },
    media: Object.fromEntries(items.map(item => [item.id, { dataUrl: 'data:image/jpeg;base64,YQ==', kind: 'image' }])),
    profile: { plan },
    session: { chatId: 'chat:1', destinationFingerprint: 'chatgpt:conversation:1' },
  };
}

test('all provider failures still produce a deterministic prompt with degraded stages', async () => {
  const bedrock = {
    analyzeImage: async () => { throw new Error('vision down'); },
    analyzeVideo: async () => { throw new Error('video down'); },
    embedReference: async () => { throw new Error('titan down'); },
    compilePrompt: async canonical => ({ status: 'degraded', provider: 'deterministic', text: canonical.prompt }),
  };
  const result = await runPipeline(requestWith(), { bedrock, font: { identify: async () => ({ status: 'degraded', exact_match: null, candidates: [] }) } });
  assert.equal(result.ok, true);
  assert.equal(result.status, 'degraded');
  assert.equal(result.provider, 'deterministic');
  assert.match(result.final_prompt, /Keep the red object/);
  assert.ok(result.stages.every(stage => ['ok', 'degraded', 'skipped'].includes(stage.status)));
});

test('text-only flow compiles without physical references', async () => {
  const result = await runPipeline({
    graph: {
      destination: 'ChatGPT',
      items: [
        { id: 'note_start', kind: 'note', text: 'Start with account creation.', intentional: true },
        { id: 'note_finish', kind: 'note', text: 'Then show the dashboard.', intentional: true },
      ],
      cues: [],
      relations: [{ type: 'FLOWS_TO', sourceId: 'note_start', targetId: 'note_finish' }],
      motions: [],
    },
    profile: { plan: 'free' },
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.attachments, []);
  assert.deepEqual(result.selected_references, []);
  assert.match(result.final_prompt, /Start with account creation/);
  assert.match(result.final_prompt, /Then show the dashboard/);
  assert.match(result.final_prompt, /Flowchart sequence/);
});

test('required references above the plan block before any provider executes', async () => {
  const request = requestWith(3, 'free');
  request.graph.items.forEach(item => { item.role = 'Preserve'; });
  const calls = [];
  const bedrock = { analyzeImage: async () => { calls.push('image'); }, compilePrompt: async () => { calls.push('compile'); } };
  const result = await runPipeline(request, { bedrock });
  assert.equal(result.ok, false);
  assert.equal(result.status, 'blocked');
  assert.deepEqual(calls, []);
  assert.match(result.error, /plan limit/i);
});

test('optional references are reported as trimmed and cannot reappear in final wording', async () => {
  const request = requestWith(3, 'free');
  const result = await runPipeline(request, {});
  assert.deepEqual(result.selected_references.map(item => item.id), ['asset_0', 'asset_1']);
  assert.deepEqual(result.trimmed_references.map(item => item.id), ['asset_2']);
  assert.doesNotMatch(result.final_prompt, /Image 2\.png/);
});

test('prompt_hash matches sha256 of final_prompt when AI compiler returns compiled text', async () => {
  const crypto = await import('node:crypto');
  const compiledText = 'AI compiled instruction: Keep the red object. Apply to around 40% across and 50% down on “Image 0.png”.';
  const bedrock = {
    compilePrompt: async (canonical) => {
      const facts = canonical.protectedFacts.map(f => f.text).join(' ');
      return { status: 'ok', provider: 'bedrock', text: compiledText + ' ' + facts };
    }
  };
  const result = await runPipeline(requestWith(1, 'plus'), { bedrock });
  assert.equal(result.ok, true);
  assert.match(result.final_prompt, /AI compiled instruction/);
  const expectedHash = crypto.createHash('sha256').update(result.final_prompt).digest('hex');
  assert.equal(result.prompt_hash, expectedHash);
});

