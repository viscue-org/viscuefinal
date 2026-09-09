import crypto from 'node:crypto';
import { createStage } from './contracts.mjs';
import { enforceReferencePlan } from './policy.mjs';
import { buildCanonicalBrief, verifyProtectedFacts } from './brief.mjs';
import { effectiveReferenceLimit } from './platform-capabilities.mjs';
import { normalizeExecutionLedger } from './execution-ledger.mjs';

const normalizeForHash = value => String(value || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
const hash = value => crypto.createHash('sha256').update(normalizeForHash(value)).digest('hex');

function explicitScores(graph = {}) {
  const scores = new Map();
  for (const [index, item] of (graph.items || []).entries()) {
    let score = Math.max(0, 0.1 - index * 0.001); // fallback deterministic order
    if ((graph.cues || []).some(cue => cue.assetId === item.id)) score += 0.3; // 30% explicit intent strength
    if ((graph.relations || []).some(relation => relation.sourceAssetId === item.id || relation.targetAssetId === item.id)) score += 0.25; // 25% relationship strength
    // Vision importance and prompt relevance will be added later
    scores.set(item.id, score);
  }
  return scores;
}

function requiresVision(graph) {
  const allText = (graph.cues || []).map(c => c.instruction).join(' ').toLowerCase();
  
  // Vision is required if there are temporal video queries, identification queries, or ambiguity
  const visionWords = /\b(what|who|how many|count|identify|read|compare|describe|locate|where|find|extract|which)\b/;
  if (visionWords.test(allText)) return true;

  // No-vision edit keywords (generation/edit instruction)
  const noVisionWords = /\b(larger|smaller|clearer|darker|lighter|color|move|align|remove|replace|copy|rotate|crop|emphasize|restyle|modify|transfer|follow)\b/;
  if (noVisionWords.test(allText)) {
    return false;
  }
  
  // Default to vision if ambiguous
  return true;
}

async function collectEvidence(selected, media, bedrock, priorEvidence = []) {
  if (!bedrock) {
    return {
      stages: [createStage('perception', 'skipped', { warning: 'Bedrock perception is not configured.' })],
      evidence: [],
    };
  }
  const priorByAsset = new Map();
  for (const ev of (Array.isArray(priorEvidence) ? priorEvidence : [])) {
    if (ev?.assetId) {
      if (!priorByAsset.has(ev.assetId)) priorByAsset.set(ev.assetId, []);
      priorByAsset.get(ev.assetId).push(ev);
    }
  }

  const itemResults = await Promise.all(selected.map(async item => {
    const source = media[item.id];
    if (!source?.dataUrl) {
      return {
        stage: createStage(`perception.${item.id}`, 'skipped', { warning: 'No bounded perception media was supplied.' }),
        evidence: [],
      };
    }
    // Differential perception: if this asset was already analyzed and unchanged, reuse evidence
    if (priorByAsset.has(item.id) && priorByAsset.get(item.id).length > 0) {
      const cachedEvidence = priorByAsset.get(item.id);
      return {
        stage: createStage(`perception.${item.id}`, 'ok', { provider: 'cached', evidence_count: cachedEvidence.length }),
        evidence: cachedEvidence,
      };
    }
    try {
      const analyze = item.kind === 'video' ? bedrock.analyzeVideo?.bind(bedrock) : bedrock.analyzeImage?.bind(bedrock);
      if (!analyze) throw new Error('Model route is unavailable.');
      const result = await analyze({ assetId: item.id, dataUrl: source.dataUrl, prompt: 'Report only directly visible objects, layout, OCR, and typography evidence. Unknown facts must remain unknown.' });
      return {
        stage: createStage(`perception.${item.id}`, result.status || 'ok', {
          provider: result.provider,
          model: result.model,
          duration_ms: result.duration_ms,
          evidence_count: result.evidence?.length || 0,
          fallback: result.fallback,
          fallback_from: result.fallback_from,
          attempt: result.attempt,
        }),
        evidence: (result.evidence || []).map(e => ({ ...e, assetId: item.id })),
      };
    } catch {
      return {
        stage: createStage(`perception.${item.id}`, 'degraded', { warning: 'Visual perception failed; user-authored intent remains authoritative.' }),
        evidence: [],
      };
    }
  }));

  return {
    stages: itemResults.map(r => r.stage),
    evidence: itemResults.flatMap(r => r.evidence),
  };
}

async function runRelevance(graph, bedrock) {
  if (!bedrock?.embedReference) {
    return createStage('relevance.titan', 'skipped', { warning: 'Titan relevance is not configured.' });
  }
  try {
    const result = await bedrock.embedReference({ text: (graph.cues || []).map(cue => cue.instruction).join(' ') });
    return createStage('relevance.titan', 'ok', { provider: 'titan', model: result?.model, duration_ms: result?.duration_ms });
  } catch {
    return createStage('relevance.titan', 'degraded', { warning: 'Titan relevance unavailable; explicit intent and stable ordering were used.' });
  }
}

async function runFontIdentification(request, font) {
  if (Array.isArray(request.font_requests) && request.font_requests.length && font) {
    const stages = [];
    const evidence = [];
    for (const fontRequest of request.font_requests) {
      const result = await font.identify(fontRequest);
      evidence.push({ type: 'font', value: result.exact_match?.name || null, candidates: result.candidates, observation_kind: result.exact_match ? 'observed' : 'unknown', confidence: result.exact_match?.score || 0 });
      stages.push(createStage(`font.${fontRequest.assetId || 'region'}`, result.status, { exact_match: result.exact_match?.name || null, warning: result.warning }));
    }
    return { stages, evidence };
  }
  return {
    stages: [createStage('font.identification', 'skipped', { warning: 'No font-identification region requested.' })],
    evidence: [],
  };
}

export async function runPipeline(request = {}, deps = {}) {
  const graph = request.graph || {};
  const stages = [];
  
  // Cheap pre-compilation scope filter
  const itemsInScope = (graph.items || []).filter(item => {
    return item.intentional || item.preserved || (graph.cues || []).some(c => c.assetId === item.id) || (graph.relations || []).some(r => r.sourceAssetId === item.id || r.targetAssetId === item.id);
  });

  const isNewChat = Boolean(
    request.session?.isNewChat === true ||
    request.session?.chatId === 'new' ||
    request.session?.chatId === 'ChatGPT:new' ||
    request.session?.chatId === 'Claude:new' ||
    request.session?.chatId === 'Gemini:new' ||
    request.session?.chatId === 'Copilot:new' ||
    request.session?.chatId === 'Perplexity:new' ||
    request.session?.chatId === 'Grok:new' ||
    (typeof request.session?.destinationFingerprint === 'string' && (
      request.session.destinationFingerprint.endsWith(':new') ||
      request.session.destinationFingerprint.endsWith(':/') ||
      request.session.destinationFingerprint.endsWith(':/app') ||
      request.session.destinationFingerprint.endsWith(':/new')
    ))
  );

  const prevState = isNewChat ? null : (request.session?.previousState || null);
  const sentHashes = new Set([
    ...(Array.isArray(prevState?.sent_attachment_hashes) ? prevState.sent_attachment_hashes : []),
    ...(Array.isArray(prevState?.attachment_state_hashes) ? prevState.attachment_state_hashes : []),
    ...(Array.isArray(prevState?.attachments) ? prevState.attachments.filter(a => a.confirmed !== false).map(a => a.stateHash || a.hash) : []),
  ].filter(Boolean));

  // 1. Deterministic vision gate
  const needsVision = requiresVision(graph);
  let perceptionResult = { stages: [], evidence: [] };
  
  if (needsVision) {
    perceptionResult = await collectEvidence(itemsInScope, request.media || {}, deps.bedrock, prevState?.evidence || []);
  } else {
    perceptionResult = {
      stages: [createStage('perception', 'skipped', { reason: 'generation_edit_sufficient' })],
      evidence: []
    };
  }

  const fontResult = await runFontIdentification(request, deps.font);
  stages.push(...perceptionResult.stages);
  stages.push(...fontResult.stages);
  const evidence = [...perceptionResult.evidence, ...fontResult.evidence];

  // 2. Prompt Compilation
  // We mock a 'selection' that includes all items in scope for compilation
  const mockSelection = { selected: itemsInScope, requiredIds: itemsInScope.map(i => i.id) };
  let canonical = buildCanonicalBrief({ graph, evidence, selection: mockSelection });
  
  let compiled = { status: 'degraded', provider: 'deterministic', text: canonical.prompt, warning: { reason: 'Compiler not configured.' } };
  if (deps.bedrock?.compilePrompt) compiled = await deps.bedrock.compilePrompt(canonical);
  const verified = verifyProtectedFacts(compiled.text, canonical);
  if (!verified.ok) compiled = { status: 'degraded', provider: 'deterministic', text: canonical.prompt, warning: verified };
  
  stages.push(createStage('prompt.compile', compiled.status || 'degraded', {
    provider: compiled.provider || 'deterministic',
    model: compiled.model || null,
    duration_ms: compiled.duration_ms || null,
    fallback: Boolean(compiled.fallback),
    fallback_from: compiled.fallback_from || null,
    warning: compiled.warning,
  }));
  stages.push(createStage('prompt.reverse_verification', 'ok', { protected_facts: canonical.protectedFacts.length, cue_coverage: canonical.coverageIds.length }));

  let finalPrompt = compiled.text;
  let provider = compiled.provider || 'deterministic';

  // 3. Final Reference Engine
  const baseScores = explicitScores(graph);
  // Add 15% relevance to the compiled prompt if titan is available
  let titanStage = createStage('relevance.titan', 'skipped', { warning: 'Titan relevance is not configured.' });
  if (deps.bedrock?.embedReference) {
    try {
      const result = await deps.bedrock.embedReference({ text: finalPrompt });
      titanStage = createStage('relevance.titan', 'ok', { provider: 'titan', model: result?.model, duration_ms: result?.duration_ms });
      // We would ideally compute dot product with item embeddings here, but since embedReference just returns ok,
      // we'll simulate prompt relevance score for now.
      for (const item of itemsInScope) {
         if (finalPrompt.includes(item.name || '')) baseScores.set(item.id, (baseScores.get(item.id) || 0) + 0.15);
      }
    } catch {
      titanStage = createStage('relevance.titan', 'degraded', { warning: 'Titan relevance unavailable.' });
    }
  }
  stages.push(titanStage);
  
  // Add 20% vision importance if vision legitimately ran
  if (needsVision) {
    for (const ev of perceptionResult.evidence) {
      if (ev.importance) {
        baseScores.set(ev.assetId, (baseScores.get(ev.assetId) || 0) + (ev.importance * 0.2));
      } else {
        baseScores.set(ev.assetId, (baseScores.get(ev.assetId) || 0) + 0.2); // Default importance
      }
    }
  }

  const referencePolicy = effectiveReferenceLimit({ viscuePlan: request.profile?.plan, capability: request.platformCapability });
  const policy = enforceReferencePlan(graph, { ...referencePolicy, plan: request.profile?.plan || 'free' }, baseScores);
  stages.push(createStage('plan.selection', policy.status, { summary: policy.summary, limit: policy.limit, constrained_by: policy.constrainedBy, required_ids: policy.requiredIds }));
  
  if (policy.status === 'blocked') {
    const ledger = normalizeExecutionLedger(stages);
    return {
      ok: false,
      status: 'blocked',
      error: policy.summary,
      stages,
      ledger,
      trust: ledger.trust,
      selected_references: [],
      trimmed_references: policy.trimmed,
    };
  }

  // Re-build canonical brief now that we have final selected attachments
  const preliminaryBrief = buildCanonicalBrief({ graph, evidence, selection: policy });
  const alreadyAttached = (preliminaryBrief.attachments || []).filter(a => sentHashes.has(a.stateHash) || (a.hash && sentHashes.has(a.hash)));
  const finalAttachments = (preliminaryBrief.attachments || []).filter(a => !sentHashes.has(a.stateHash) && (!a.hash || !sentHashes.has(a.hash)));

  // Re-build canonical to get correct summary now
  canonical = buildCanonicalBrief({ graph, evidence, selection: policy, alreadyAttached });

  const executionId = `exec_${crypto.randomUUID()}`;
  const status = stages.some(stage => stage.status === 'degraded') ? 'degraded' : 'ok';

  if (alreadyAttached.length > 0) {
    stages.push(createStage('refine.deduplication', 'ok', {
      reused_attachments: alreadyAttached.length,
      new_attachments: finalAttachments.length,
    }));
  }

  const newPromptHash = hash(finalPrompt);
  const ledger = normalizeExecutionLedger(stages);

  return {
    ok: true,
    status,
    provider,
    final_prompt: finalPrompt,
    prompt_hash: newPromptHash,
    executionId,
    execution_id: executionId,
    attachments: finalAttachments,
    selected_references: policy.selected,
    trimmed_references: policy.trimmed,
    stages,
    ledger,
    trust: ledger.trust,
    evidence,
    summary: canonical.summary,
  };
}
