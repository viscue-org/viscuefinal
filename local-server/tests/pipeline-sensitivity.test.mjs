import test from 'node:test';
import assert from 'node:assert/strict';
import { runPipeline } from '../lib/pipeline.mjs';

function createMedia(items = []) {
  return Object.fromEntries(items.map(item => [
    item.id,
    { dataUrl: item.dataUrl || 'data:image/jpeg;base64,YQ==', kind: item.kind || 'image' },
  ]));
}

test('different prompts with identical references alter the compiled intent and prompt hash', async () => {
  const item = { id: 'asset_hero', kind: 'image', visualKind: 'image', name: 'Product_Hero.png', hash: 'hash_hero_1', intentional: true, role: 'Reference' };
  const items = [item];
  const media = createMedia(items);

  const request1 = {
    graph: {
      destination: 'ChatGPT',
      items,
      cues: [{ id: 'cue_1', assetId: 'asset_hero', instruction: 'Change background to dark charcoal #121212.', x: 0.5, y: 0.5 }],
      relations: [],
      motions: [],
    },
    media,
    profile: { plan: 'free' },
    session: { chatId: 'chat:1', destinationFingerprint: 'chatgpt:conversation:1' },
  };

  const request2 = {
    graph: {
      destination: 'ChatGPT',
      items,
      cues: [{ id: 'cue_2', assetId: 'asset_hero', instruction: 'Make the call to action button bright neon orange.', x: 0.5, y: 0.5 }],
      relations: [],
      motions: [],
    },
    media,
    profile: { plan: 'free' },
    session: { chatId: 'chat:1', destinationFingerprint: 'chatgpt:conversation:1' },
  };

  const result1 = await runPipeline(request1, {});
  const result2 = await runPipeline(request2, {});

  assert.equal(result1.ok, true);
  assert.equal(result2.ok, true);
  assert.notEqual(result1.final_prompt, result2.final_prompt);
  assert.notEqual(result1.prompt_hash, result2.prompt_hash);
  assert.match(result1.final_prompt, /dark charcoal #121212/);
  assert.doesNotMatch(result1.final_prompt, /bright neon orange/);
  assert.match(result2.final_prompt, /bright neon orange/);
  assert.doesNotMatch(result2.final_prompt, /dark charcoal #121212/);
});

test('different reference sets with identical prompts alter evidence, attachments, and output', async () => {
  const itemA = { id: 'asset_nav', kind: 'image', visualKind: 'image', name: 'Navbar_Layout.png', hash: 'hash_nav', intentional: true, role: 'Reference' };
  const itemB = { id: 'asset_footer', kind: 'image', visualKind: 'image', name: 'Footer_Layout.png', hash: 'hash_footer', intentional: true, role: 'Reference' };

  const requestA = {
    graph: {
      destination: 'ChatGPT',
      items: [itemA],
      cues: [{ id: 'cue_nav', assetId: 'asset_nav', instruction: 'Ensure alignment matches reference padding.', x: 0.2, y: 0.3 }],
      relations: [],
      motions: [],
    },
    media: createMedia([itemA]),
    profile: { plan: 'free' },
    session: { chatId: 'chat:1', destinationFingerprint: 'chatgpt:conversation:1' },
  };

  const requestB = {
    graph: {
      destination: 'ChatGPT',
      items: [itemB],
      cues: [{ id: 'cue_footer', assetId: 'asset_footer', instruction: 'Ensure alignment matches reference padding.', x: 0.2, y: 0.3 }],
      relations: [],
      motions: [],
    },
    media: createMedia([itemB]),
    profile: { plan: 'free' },
    session: { chatId: 'chat:1', destinationFingerprint: 'chatgpt:conversation:1' },
  };

  const resultA = await runPipeline(requestA, {});
  const resultB = await runPipeline(requestB, {});

  assert.equal(resultA.ok, true);
  assert.equal(resultB.ok, true);
  assert.deepEqual(resultA.selected_references.map(r => r.id), ['asset_nav']);
  assert.deepEqual(resultB.selected_references.map(r => r.id), ['asset_footer']);
  assert.match(resultA.final_prompt, /Navbar_Layout\.png/);
  assert.doesNotMatch(resultA.final_prompt, /Footer_Layout\.png/);
  assert.match(resultB.final_prompt, /Footer_Layout\.png/);
  assert.doesNotMatch(resultB.final_prompt, /Navbar_Layout\.png/);
  assert.notEqual(resultA.prompt_hash, resultB.prompt_hash);
});

test('trimmed references due to platform plan limit never reappear in final wording or attachments', async () => {
  const items = Array.from({ length: 4 }, (_, i) => ({
    id: `asset_${i}`,
    kind: 'image',
    visualKind: 'image',
    name: `Reference_Mock_${i}.png`,
    hash: `hash_${i}`,
    intentional: true,
    role: 'Reference',
  }));

  const request = {
    graph: {
      destination: 'ChatGPT',
      items,
      cues: [
        { id: 'cue_0', assetId: 'asset_0', instruction: 'Apply this card style.', x: 0.5, y: 0.5 },
        { id: 'cue_1', assetId: 'asset_1', instruction: 'Apply this border radius.', x: 0.5, y: 0.5 },
      ],
      relations: [],
      motions: [],
    },
    media: createMedia(items),
    profile: { plan: 'free' },
    platformCapability: { platform: 'chatgpt', plan: 'free' }, // limit is 2
    session: { chatId: 'chat:1', destinationFingerprint: 'chatgpt:conversation:1' },
  };

  const result = await runPipeline(request, {});

  assert.equal(result.ok, true);
  assert.deepEqual(result.selected_references.map(r => r.id), ['asset_0', 'asset_1']);
  assert.deepEqual(result.trimmed_references.map(r => r.id), ['asset_2', 'asset_3']);
  assert.doesNotMatch(result.final_prompt, /Reference_Mock_2\.png/);
  assert.doesNotMatch(result.final_prompt, /Reference_Mock_3\.png/);
  const attachmentIds = (result.attachments || []).map(a => a.assetId || a.id);
  assert.ok(!attachmentIds.includes('asset_2'));
  assert.ok(!attachmentIds.includes('asset_3'));
});

test('authoritative user text, exact coordinates, and filenames are protected against rogue compiler drift', async () => {
  const item = { id: 'asset_spec', kind: 'image', visualKind: 'image', name: 'Design_Spec_v3.png', hash: 'hash_spec', intentional: true, role: 'Reference' };
  const instructionText = 'Header height must be exactly 64px.';

  const request = {
    graph: {
      destination: 'ChatGPT',
      items: [item],
      cues: [{ id: 'cue_spec', assetId: 'asset_spec', instruction: instructionText, x: 0.45, y: 0.65 }],
      relations: [],
      motions: [],
    },
    media: createMedia([item]),
    profile: { plan: 'free' },
    session: { chatId: 'chat:1', destinationFingerprint: 'chatgpt:conversation:1' },
  };

  // Mock compiler that attempts to hallucinate or drop the protected fact
  const rogueCompiler = {
    compilePrompt: async () => ({
      status: 'ok',
      provider: 'rogue-ai',
      text: 'Make the header look nice and modern with good spacing.', // Dropped "64px" and filename
    }),
  };

  const result = await runPipeline(request, { bedrock: rogueCompiler });

  // Verification must detect the missing protected facts and degrade to the deterministic canonical prompt
  assert.equal(result.ok, true);
  assert.equal(result.status, 'degraded');
  assert.equal(result.provider, 'deterministic');
  assert.match(result.final_prompt, /Design_Spec_v3\.png/);
  assert.match(result.final_prompt, /Header height must be exactly 64px\./);
  const verificationStage = result.stages.find(s => s.name === 'prompt.reverse_verification');
  assert.ok(verificationStage);
  assert.equal(verificationStage.status, 'ok');
});

test('platform capability dynamically governs capacity and names the constraining authority', async () => {
  const items = Array.from({ length: 4 }, (_, i) => ({
    id: `item_${i}`,
    kind: 'image',
    visualKind: 'image',
    name: `Asset_${i}.png`,
    hash: `hash_${i}`,
    intentional: true,
    role: 'Reference',
  }));

  // Case A: Viscue Pro (allowance 10), but ChatGPT Free (budget 2) -> constrained by destination
  const requestConstrainedByDest = {
    graph: { destination: 'ChatGPT', items, cues: [], relations: [], motions: [] },
    media: createMedia(items),
    profile: { plan: 'pro' },
    platformCapability: { platform: 'chatgpt', plan: 'free' },
    session: { chatId: 'chat:1', destinationFingerprint: 'chatgpt:conversation:1' },
  };

  const resultA = await runPipeline(requestConstrainedByDest, {});
  assert.equal(resultA.ok, true);
  assert.equal(resultA.selected_references.length, 2);
  assert.equal(resultA.trimmed_references.length, 2);
  const stageA = resultA.stages.find(s => s.name === 'plan.selection');
  assert.equal(stageA.limit, 2);
  assert.equal(stageA.constrained_by, 'destination');

  // Case B: Viscue Free (allowance 2), but ChatGPT Plus (budget 10) -> constrained by viscue
  const requestConstrainedByViscue = {
    graph: { destination: 'ChatGPT', items, cues: [], relations: [], motions: [] },
    media: createMedia(items),
    profile: { plan: 'free' },
    platformCapability: { platform: 'chatgpt', plan: 'plus' },
    session: { chatId: 'chat:1', destinationFingerprint: 'chatgpt:conversation:1' },
  };

  const resultB = await runPipeline(requestConstrainedByViscue, {});
  assert.equal(resultB.ok, true);
  assert.equal(resultB.selected_references.length, 2);
  assert.equal(resultB.trimmed_references.length, 2);
  const stageB = resultB.stages.find(s => s.name === 'plan.selection');
  assert.equal(stageB.limit, 2);
  assert.equal(stageB.constrained_by, 'viscue');

  // Case C: Viscue Pro (allowance 10) AND ChatGPT Plus (budget 10, provider ceiling 10) -> all 4 fit
  const requestBothPro = {
    graph: { destination: 'ChatGPT', items, cues: [], relations: [], motions: [] },
    media: createMedia(items),
    profile: { plan: 'pro' },
    platformCapability: { platform: 'chatgpt', plan: 'plus' },
    session: { chatId: 'chat:1', destinationFingerprint: 'chatgpt:conversation:1' },
  };

  const resultC = await runPipeline(requestBothPro, {});
  assert.equal(resultC.ok, true);
  assert.equal(resultC.selected_references.length, 4);
  assert.equal(resultC.trimmed_references.length, 0);
});
