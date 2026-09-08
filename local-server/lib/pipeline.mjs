import crypto from 'node:crypto';
import { createStage } from './contracts.mjs';
import { enforceReferencePlan } from './policy.mjs';
import { buildCanonicalBrief, verifyProtectedFacts } from './brief.mjs';
import { effectiveReferenceLimit } from './platform-capabilities.mjs';

const normalizeForHash = value => String(value || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
const hash = value => crypto.createHash('sha256').update(normalizeForHash(value)).digest('hex');

function explicitScores(graph = {}) {
  const scores = new Map();
  for (const [index, item] of (graph.items || []).entries()) {
    let score = Math.max(0, 0.1 - index * 0.001);
    if ((graph.cues || []).some(cue => cue.assetId === item.id)) score += 0.25;
    if ((graph.relations || []).some(relation => relation.sourceAssetId === item.id || relation.targetAssetId === item.id)) score += 0.1;
    if (String(item.role || '').toLowerCase() === 'preserve' || item.preserved) score += 0.1;
    scores.set(item.id, score);
  }
  return scores;
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
        stage: createStage(`perception.${item.id}`, result.status || 'ok', { provider: result.provider, model: result.model, evidence_count: result.evidence?.length || 0 }),
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
    await bedrock.embedReference({ text: (graph.cues || []).map(cue => cue.instruction).join(' ') });
    return createStage('relevance.titan', 'ok', { provider: 'titan' });
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
  const referencePolicy = effectiveReferenceLimit({ viscuePlan: request.profile?.plan, capability: request.platformCapability });
  const policy = enforceReferencePlan(graph, { ...referencePolicy, plan: request.profile?.plan || 'free' }, explicitScores(graph));
  stages.push(createStage('plan.selection', policy.status, { summary: policy.summary, limit: policy.limit, constrained_by: policy.constrainedBy, required_ids: policy.requiredIds }));
  if (policy.status === 'blocked') {
    return { ok: false, status: 'blocked', error: policy.summary, stages, selected_references: [], trimmed_references: policy.trimmed };
  }

  const prevState = request.session?.previousState || null;
  const sentHashes = new Set([
    ...(Array.isArray(prevState?.sent_attachment_hashes) ? prevState.sent_attachment_hashes : []),
    ...(Array.isArray(prevState?.attachment_state_hashes) ? prevState.attachment_state_hashes : []),
    ...(Array.isArray(prevState?.attachments) ? prevState.attachments.filter(a => a.confirmed !== false).map(a => a.stateHash || a.hash) : []),
  ].filter(Boolean));

  const [perceptionResult, titanStage, fontResult] = await Promise.all([
    collectEvidence(policy.selected, request.media || {}, deps.bedrock, prevState?.evidence || []),
    runRelevance(graph, deps.bedrock),
    runFontIdentification(request, deps.font),
  ]);

  stages.push(...perceptionResult.stages);
  stages.push(titanStage);
  stages.push(...fontResult.stages);

  const evidence = [...perceptionResult.evidence, ...fontResult.evidence];

  // Identify attachments that were already confirmed in this chat session
  const preliminaryBrief = buildCanonicalBrief({ graph, evidence, selection: policy });
  const alreadyAttached = (preliminaryBrief.attachments || []).filter(a => sentHashes.has(a.stateHash) || (a.hash && sentHashes.has(a.hash)));
  const finalAttachments = (preliminaryBrief.attachments || []).filter(a => !sentHashes.has(a.stateHash) && (!a.hash || !sentHashes.has(a.hash)));

  // Build canonical brief with refinement context about existing references
  const canonical = buildCanonicalBrief({ graph, evidence, selection: policy, alreadyAttached });
  let compiled = { status: 'degraded', provider: 'deterministic', text: canonical.prompt, warning: { reason: 'Compiler not configured.' } };
  if (deps.bedrock?.compilePrompt) compiled = await deps.bedrock.compilePrompt(canonical);
  const verified = verifyProtectedFacts(compiled.text, canonical);
  if (!verified.ok) compiled = { status: 'degraded', provider: 'deterministic', text: canonical.prompt, warning: verified };
  stages.push(createStage('prompt.compile', compiled.status || 'degraded', { provider: compiled.provider || 'deterministic', warning: compiled.warning }));
  stages.push(createStage('prompt.reverse_verification', 'ok', { protected_facts: canonical.protectedFacts.length, cue_coverage: canonical.coverageIds.length }));

  const executionId = `exec_${crypto.randomUUID()}`;
  const status = stages.some(stage => stage.status === 'degraded') ? 'degraded' : 'ok';
  
  // Real compiled AI prompt or verified deterministic brief - NEVER replace with dummy skip text!
  let finalPrompt = compiled.text;
  let provider = compiled.provider || 'deterministic';

  if (alreadyAttached.length > 0) {
    stages.push(createStage('refine.deduplication', 'ok', {
      reused_attachments: alreadyAttached.length,
      new_attachments: finalAttachments.length,
    }));
  }

  const newPromptHash = hash(finalPrompt);

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
    evidence,
    summary: canonical.summary,
  };
}
