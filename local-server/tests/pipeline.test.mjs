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
  const request = requestWith();
  request.graph.cues[0].instruction = 'Identify the red object.';
  const result = await runPipeline(request, { bedrock, font: { identify: async () => ({ status: 'degraded', exact_match: null, candidates: [] }) } });
  assert.equal(result.ok, true);
  assert.equal(result.status, 'degraded');
  assert.equal(result.provider, 'deterministic');
  assert.match(result.final_prompt, /Identify the red object/);
  assert.ok(result.stages.every(stage => ['ok', 'degraded', 'skipped'].includes(stage.status)));
});

test('anchored generation edits from the reported workspace bypass visual perception', async () => {
  const calls = [];
  const request = requestWith(1, 'plus');
  request.graph.cues = [
    { id: 'cue_1', assetId: 'asset_0', instruction: 'use a girl instead of boy', x: 0.58, y: 0.42, isWholeAsset: false },
    { id: 'cue_2', assetId: 'asset_0', instruction: 'use actual tesla rocket there', x: 0.34, y: 0.51, isWholeAsset: false },
  ];
  const bedrock = {
    analyzeImage: async () => { calls.push('vision'); return { status: 'ok', evidence: [] }; },
    embedReference: async () => { calls.push('relevance'); return { model: 'titan.test', duration_ms: 1, embedding: [0.1] }; },
    compilePrompt: async canonical => { calls.push('compile'); return { status: 'degraded', provider: 'deterministic', text: canonical.prompt, duration_ms: 1 }; },
  };

  const result = await runPipeline(request, { bedrock });

  assert.equal(result.ok, true);
  assert.ok(!calls.includes('vision'));
  assert.ok(calls.includes('compile'));
  assert.match(result.final_prompt, /use a girl instead of boy/);
  assert.match(result.final_prompt, /use actual tesla rocket there/);
  assert.equal(result.stages.find(stage => stage.name === 'perception').status, 'skipped');
});

test('explicit visual inspection requests still invoke perception', async () => {
  let visionCalls = 0;
  const request = requestWith(1, 'plus');
  request.graph.cues[0].instruction = 'Identify and describe the main character.';
  const bedrock = {
    analyzeImage: async () => {
      visionCalls += 1;
      return { status: 'ok', provider: 'nova-lite', model: 'nova.test', duration_ms: 4, evidence: [{ type: 'object', value: 'a person', confidence: 0.9 }] };
    },
    compilePrompt: async canonical => ({ status: 'degraded', provider: 'deterministic', text: canonical.prompt, duration_ms: 1 }),
  };

  const result = await runPipeline(request, { bedrock });

  assert.equal(result.ok, true);
  assert.equal(visionCalls, 1);
  assert.equal(result.stages.find(stage => stage.name === 'perception.asset_0').model, 'nova.test');
});

test('perception only analyzes assets named by explicit visual-inspection cues', async () => {
  const request = requestWith(3, 'plus');
  request.platformCapability = { platform: 'chatgpt', plan: 'pro' };
  request.graph.cues = [
    { id: 'cue_0', assetId: 'asset_0', instruction: 'Identify the person in this region.', x: 0.4, y: 0.5, isWholeAsset: false },
    { id: 'cue_1', assetId: 'asset_1', instruction: 'Replace this background with blue.', x: 0.4, y: 0.5, isWholeAsset: false },
  ];
  const analyzed = [];
  const bedrock = {
    analyzeImage: async input => {
      analyzed.push(input.assetId);
      return { status: 'ok', provider: 'nova-lite', model: 'nova.test', duration_ms: 1, evidence: [{ type: 'object', value: 'a person', confidence: 0.9 }] };
    },
    compilePrompt: async canonical => ({ status: 'degraded', provider: 'deterministic', text: canonical.prompt, duration_ms: 1 }),
  };

  await runPipeline(request, { bedrock });

  assert.deepEqual(analyzed, ['asset_0']);
});

test('visual perception concurrency is bounded for large workspaces', async () => {
  const request = requestWith(8, 'plus');
  request.platformCapability = { platform: 'chatgpt', plan: 'pro' };
  request.graph.cues = request.graph.items.map((item, index) => ({
    id: `cue_${index}`,
    assetId: item.id,
    instruction: 'Identify the visible subject.',
    x: 0.5,
    y: 0.5,
    isWholeAsset: false,
  }));
  let active = 0;
  let maxActive = 0;
  const bedrock = {
    analyzeImage: async input => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise(resolve => setTimeout(resolve, 10));
      active -= 1;
      return { status: 'ok', provider: 'nova-lite', model: 'nova.test', duration_ms: 10, evidence: [{ type: 'object', value: input.assetId, confidence: 0.9 }] };
    },
    compilePrompt: async canonical => ({ status: 'degraded', provider: 'deterministic', text: canonical.prompt, duration_ms: 1 }),
  };

  const result = await runPipeline(request, { bedrock });

  assert.equal(result.ok, true);
  assert.ok(maxActive <= 4, `expected at most 4 concurrent calls, saw ${maxActive}`);
});

test('relevance begins before prompt compilation and remains represented in the ledger', async () => {
  const request = requestWith(1, 'plus');
  let relevanceStarted = false;
  const bedrock = {
    embedReference: async () => {
      relevanceStarted = true;
      await new Promise(resolve => setTimeout(resolve, 20));
      return { model: 'titan.test', duration_ms: 20, embedding: [0.1] };
    },
    compilePrompt: async canonical => {
      assert.equal(relevanceStarted, true);
      return { status: 'degraded', provider: 'deterministic', text: canonical.prompt, duration_ms: 1 };
    },
  };

  const result = await runPipeline(request, { bedrock });

  assert.equal(result.ok, true);
  assert.equal(result.stages.filter(stage => stage.name === 'relevance.titan').length, 1);
  assert.equal(result.stages.find(stage => stage.name === 'relevance.titan').duration_ms, 20);
});

test('failed perception preserves provider timing and attempt metadata in the ledger', async () => {
  const request = requestWith(1, 'plus');
  request.graph.cues[0].instruction = 'Identify the person.';
  const failure = Object.assign(new Error('Image perception unavailable'), {
    duration_ms: 3498,
    provider: 'nova-pro',
    model: 'us.amazon.nova-pro-v1:0',
    attempt: 2,
    fallback: true,
    fallback_from: 'us.amazon.nova-lite-v1:0',
  });
  const result = await runPipeline(request, { bedrock: { analyzeImage: async () => { throw failure; } } });

  const stage = result.stages.find(entry => entry.name === 'perception.asset_0');
  assert.equal(stage.duration_ms, 3498);
  assert.equal(stage.model, 'us.amazon.nova-pro-v1:0');
  assert.equal(stage.attempt, 2);
  assert.equal(stage.fallback, true);
  assert.ok(result.ledger.total_duration_ms >= 3498);
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
  const compiledText = 'AI compiled instruction: On "Image 0.png" at [40%, 50%], Keep the red object.';
  const request = requestWith(1, 'plus');
  request.graph.cues[0].isWholeAsset = false;
  const bedrock = {
    compilePrompt: async (canonical) => {
      const facts = canonical.protectedFacts.map(f => f.text).join(' ');
      return { status: 'ok', provider: 'bedrock', text: compiledText + ' ' + facts };
    }
  };
  const result = await runPipeline(request, { bedrock });
  assert.equal(result.ok, true);
  assert.match(result.final_prompt, /AI compiled instruction/);
  const expectedHash = crypto.createHash('sha256').update(result.final_prompt).digest('hex');
  assert.equal(result.prompt_hash, expectedHash);
});
