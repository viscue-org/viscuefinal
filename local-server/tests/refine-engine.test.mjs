import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { parsePlatformChatContext } from '../lib/platform-capabilities.mjs';
import { runPipeline } from '../lib/pipeline.mjs';

function hash(text) {
  return crypto.createHash('sha256').update(String(text || '').trim()).digest('hex');
}

test('parsePlatformChatContext detects chat ID across all platforms and handles new chats', () => {
  // 1. ChatGPT
  const gpt1 = parsePlatformChatContext('https://chatgpt.com/c/67890-abcd-1234');
  assert.equal(gpt1.platform, 'ChatGPT');
  assert.equal(gpt1.chatId, '67890-abcd-1234');
  assert.equal(gpt1.destinationFingerprint, 'ChatGPT:67890-abcd-1234');
  assert.equal(gpt1.isNewChat, false);

  const gptCustom = parsePlatformChatContext('https://chatgpt.com/g/g-researcher-v1/c/abc-999');
  assert.equal(gptCustom.platform, 'ChatGPT');
  assert.equal(gptCustom.chatId, 'abc-999');

  const gptNew = parsePlatformChatContext('https://chatgpt.com/');
  assert.equal(gptNew.platform, 'ChatGPT');
  assert.equal(gptNew.chatId, 'new');
  assert.equal(gptNew.destinationFingerprint, 'ChatGPT:/');
  assert.equal(gptNew.isNewChat, true);

  // 2. Claude
  const claudeChat = parsePlatformChatContext('https://claude.ai/chat/550e8400-e29b-41d4-a716-446655440000');
  assert.equal(claudeChat.platform, 'Claude');
  assert.equal(claudeChat.chatId, '550e8400-e29b-41d4-a716-446655440000');
  assert.equal(claudeChat.destinationFingerprint, 'Claude:550e8400-e29b-41d4-a716-446655440000');

  const claudeNew = parsePlatformChatContext('https://claude.ai/new');
  assert.equal(claudeNew.platform, 'Claude');
  assert.equal(claudeNew.chatId, 'new');
  assert.equal(claudeNew.destinationFingerprint, 'Claude:/new');

  // 3. Gemini
  const geminiChat = parsePlatformChatContext('https://gemini.google.com/app/1a2b3c4d5e');
  assert.equal(geminiChat.platform, 'Gemini');
  assert.equal(geminiChat.chatId, '1a2b3c4d5e');

  const geminiUserChat = parsePlatformChatContext('https://gemini.google.com/u/1/app/9z8y7x');
  assert.equal(geminiUserChat.platform, 'Gemini');
  assert.equal(geminiUserChat.chatId, '9z8y7x');

  const geminiNew = parsePlatformChatContext('https://gemini.google.com/app');
  assert.equal(geminiNew.platform, 'Gemini');
  assert.equal(geminiNew.chatId, 'new');

  // 4. Copilot
  const copilotChat = parsePlatformChatContext('https://copilot.microsoft.com/chats/copilot-uuid-1');
  assert.equal(copilotChat.platform, 'Copilot');
  assert.equal(copilotChat.chatId, 'copilot-uuid-1');

  const copilotQuery = parsePlatformChatContext('https://copilot.microsoft.com/?conversationId=conv_xyz');
  assert.equal(copilotQuery.platform, 'Copilot');
  assert.equal(copilotQuery.chatId, 'conv_xyz');

  // 5. Perplexity
  const perplexChat = parsePlatformChatContext('https://www.perplexity.ai/search/search-token-42');
  assert.equal(perplexChat.platform, 'Perplexity');
  assert.equal(perplexChat.chatId, 'search-token-42');

  const perplexNew = parsePlatformChatContext('https://www.perplexity.ai/');
  assert.equal(perplexNew.platform, 'Perplexity');
  assert.equal(perplexNew.chatId, 'new');

  // 6. Grok
  const grokChat = parsePlatformChatContext('https://grok.com/c/grok-conv-77');
  assert.equal(grokChat.platform, 'Grok');
  assert.equal(grokChat.chatId, 'grok-conv-77');

  const grokNew = parsePlatformChatContext('https://grok.com/');
  assert.equal(grokNew.platform, 'Grok');
  assert.equal(grokNew.chatId, 'new');
});

test('refine engine eliminates duplicate attachments when re-editing in the same chat', async () => {
  const itemA = { id: 'asset_a', kind: 'image', name: 'Layout.png', hash: 'hash_a', intentional: true, role: 'Reference' };
  const itemB = { id: 'asset_b', kind: 'image', name: 'Color_Palette.png', hash: 'hash_b', intentional: true, role: 'Reference' };

  // First turn: Both assets A and B are submitted
  const firstTurnRequest = {
    graph: {
      destination: 'ChatGPT',
      items: [itemA, itemB],
      cues: [
        { id: 'cue_1', assetId: 'asset_a', instruction: 'Make the navbar sticky.', x: 0.5, y: 0.2 },
        { id: 'cue_2', assetId: 'asset_b', instruction: 'Use this primary purple.', x: 0.5, y: 0.5 },
      ],
      relations: [],
      motions: [],
    },
    media: {
      asset_a: { dataUrl: 'data:image/png;base64,AAA=', kind: 'image' },
      asset_b: { dataUrl: 'data:image/png;base64,BBB=', kind: 'image' },
    },
    profile: { plan: 'plus' },
    session: { chatId: 'chat:123', destinationFingerprint: 'ChatGPT:chat:123' },
  };

  const firstTurnResult = await runPipeline(firstTurnRequest, {});
  assert.equal(firstTurnResult.ok, true);
  assert.equal(firstTurnResult.attachments.length, 2);
  const stateHashA = firstTurnResult.attachments.find(a => a.id === 'asset_a').stateHash;
  const stateHashB = firstTurnResult.attachments.find(a => a.id === 'asset_b').stateHash;

  // Turn 2 (Refinement): User re-edits workspace!
  // Asset A is still in workspace, but user adds Asset C, and updates instruction on Asset A.
  const itemC = { id: 'asset_c', kind: 'image', name: 'New_Icon.png', hash: 'hash_c', intentional: true, role: 'Reference' };
  const secondTurnRequest = {
    graph: {
      destination: 'ChatGPT',
      items: [itemA, itemC],
      cues: [
        { id: 'cue_1_refined', assetId: 'asset_a', instruction: 'Make the navbar sticky with a blur background.', x: 0.5, y: 0.2 },
        { id: 'cue_3', assetId: 'asset_c', instruction: 'Place this icon in the search bar.', x: 0.5, y: 0.5 },
      ],
      relations: [],
      motions: [],
    },
    media: {
      asset_a: { dataUrl: 'data:image/png;base64,AAA=', kind: 'image' },
      asset_c: { dataUrl: 'data:image/png;base64,CCC=', kind: 'image' },
    },
    profile: { plan: 'plus' },
    session: {
      chatId: 'chat:123',
      destinationFingerprint: 'ChatGPT:chat:123',
      previousState: {
        destination_fingerprint: 'ChatGPT:chat:123',
        sent_attachment_hashes: [stateHashA, stateHashB],
        prompt_hash: firstTurnResult.prompt_hash,
      },
    },
  };

  const secondTurnResult = await runPipeline(secondTurnRequest, {});
  assert.equal(secondTurnResult.ok, true);
  // Asset A was ALREADY sent in chat:123, so only Asset C should be attached!
  assert.equal(secondTurnResult.attachments.length, 1);
  assert.equal(secondTurnResult.attachments[0].id, 'asset_c');
  assert.equal(secondTurnResult.attachments[0].name, 'New_Icon.png');

  // Deduplication stage was recorded
  const dedupStage = secondTurnResult.stages.find(s => s.name === 'refine.deduplication');
  assert.ok(dedupStage);
  assert.equal(dedupStage.reused_attachments, 1);
  assert.equal(dedupStage.new_attachments, 1);

  // The prompt must NEVER be replaced with "Viscue: No visual or instruction updates..."
  assert.doesNotMatch(secondTurnResult.final_prompt, /No visual or instruction updates/);
  assert.match(secondTurnResult.final_prompt, /Make the navbar sticky with a blur background/);
  assert.match(secondTurnResult.final_prompt, /Place this icon in the search bar/);
});

test('re-editing workspace compiles real AI prompt and does not skip or emit dummy text', async () => {
  const item = { id: 'asset_1', kind: 'image', name: 'Dashboard.png', hash: 'hash_1', intentional: true, role: 'Reference' };
  const media = { asset_1: { dataUrl: 'data:image/png;base64,DDD=', kind: 'image' } };

  const initialReq = {
    graph: {
      destination: 'ChatGPT',
      items: [item],
      cues: [{ id: 'cue_1', assetId: 'asset_1', instruction: 'Dark mode theme.', x: 0.5, y: 0.5 }],
    },
    media,
    profile: { plan: 'free' },
    session: { chatId: 'chat:re-edit', destinationFingerprint: 'ChatGPT:chat:re-edit' },
  };

  const firstResult = await runPipeline(initialReq, {});
  const assetHash = firstResult.attachments[0].stateHash;

  // Re-edit: user changes cue instruction text, keep same asset
  const reEditReq = {
    graph: {
      destination: 'ChatGPT',
      items: [item],
      cues: [{ id: 'cue_1', assetId: 'asset_1', instruction: 'OLED pure black theme with indigo accents.', x: 0.5, y: 0.5 }],
    },
    media,
    profile: { plan: 'free' },
    session: {
      chatId: 'chat:re-edit',
      destinationFingerprint: 'ChatGPT:chat:re-edit',
      previousState: {
        destination_fingerprint: 'ChatGPT:chat:re-edit',
        sent_attachment_hashes: [assetHash],
        prompt_hash: firstResult.prompt_hash,
      },
    },
  };

  const reEditResult = await runPipeline(reEditReq, {});
  assert.equal(reEditResult.ok, true);
  // Duplicate asset was omitted from physical re-attachment
  assert.equal(reEditResult.attachments.length, 0);
  // Real instruction is present
  assert.match(reEditResult.final_prompt, /OLED pure black theme with indigo accents/);
  assert.doesNotMatch(reEditResult.final_prompt, /No visual or instruction updates found/);
  assert.doesNotMatch(reEditResult.final_prompt, /I updated the visual references\./);
  assert.notEqual(reEditResult.provider, 'delta-skip');
  // Hash is accurate
  const rawIntent = JSON.stringify([[0.5, 0.5, undefined, 'OLED pure black theme with indigo accents.']]);
  assert.equal(reEditResult.prompt_hash, hash(reEditResult.final_prompt + '\n' + rawIntent));
});
