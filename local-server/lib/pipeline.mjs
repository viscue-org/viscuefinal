import crypto from 'node:crypto';
import { createStage } from './contracts.mjs';
import { enforceReferencePlan } from './policy.mjs';
import { buildCanonicalBrief, verifyProtectedFacts } from './brief.mjs';

const hash = value => crypto.createHash('sha256').update(String(value || '')).digest('hex');

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

async function collectEvidence(selected, media, bedrock, stages) {
  const evidence = [];
  if (!bedrock) {
    stages.push(createStage('perception', 'skipped', { warning: 'Bedrock perception is not configured.' }));
    return evidence;
  }
  for (const item of selected) {
    const source = media[item.id];
    if (!source?.dataUrl) {
      stages.push(createStage(`perception.${item.id}`, 'skipped', { warning: 'No bounded perception media was supplied.' }));
      continue;
    }
    try {
      const analyze = item.kind === 'video' ? bedrock.analyzeVideo?.bind(bedrock) : bedrock.analyzeImage?.bind(bedrock);
      if (!analyze) throw new Error('Model route is unavailable.');
      const result = await analyze({ assetId: item.id, dataUrl: source.dataUrl, prompt: 'Report only directly visible objects, layout, OCR, and typography evidence. Unknown facts must remain unknown.' });
      evidence.push(...(result.evidence || []));
      stages.push(createStage(`perception.${item.id}`, result.status || 'ok', { provider: result.provider, model: result.model, evidence_count: result.evidence?.length || 0 }));
    } catch {
      stages.push(createStage(`perception.${item.id}`, 'degraded', { warning: 'Visual perception failed; user-authored intent remains authoritative.' }));
    }
  }
  return evidence;
}

export async function runPipeline(request = {}, deps = {}) {
  const graph = request.graph || {};
  const stages = [];
  const policy = enforceReferencePlan(graph, request.profile?.plan || 'free', explicitScores(graph));
  stages.push(createStage('plan.selection', policy.status, { summary: policy.summary, limit: policy.limit, required_ids: policy.requiredIds }));
  if (policy.status === 'blocked') {
    return { ok: false, status: 'blocked', error: policy.summary, stages, selected_references: [], trimmed_references: policy.trimmed };
  }

  const evidence = await collectEvidence(policy.selected, request.media || {}, deps.bedrock, stages);

  if (deps.bedrock?.embedReference) {
    try {
      await deps.bedrock.embedReference({ text: (graph.cues || []).map(cue => cue.instruction).join(' ') });
      stages.push(createStage('relevance.titan', 'ok', { provider: 'titan' }));
    } catch {
      stages.push(createStage('relevance.titan', 'degraded', { warning: 'Titan relevance unavailable; explicit intent and stable ordering were used.' }));
    }
  } else {
    stages.push(createStage('relevance.titan', 'skipped', { warning: 'Titan relevance is not configured.' }));
  }

  if (Array.isArray(request.font_requests) && request.font_requests.length && deps.font) {
    for (const fontRequest of request.font_requests) {
      const result = await deps.font.identify(fontRequest);
      evidence.push({ type: 'font', value: result.exact_match?.name || null, candidates: result.candidates, observation_kind: result.exact_match ? 'observed' : 'unknown', confidence: result.exact_match?.score || 0 });
      stages.push(createStage(`font.${fontRequest.assetId || 'region'}`, result.status, { exact_match: result.exact_match?.name || null, warning: result.warning }));
    }
  } else {
    stages.push(createStage('font.identification', 'skipped', { warning: 'No font-identification region requested.' }));
  }

  const canonical = buildCanonicalBrief({ graph, evidence, selection: policy });
  let compiled = { status: 'degraded', provider: 'deterministic', text: canonical.prompt, warning: { reason: 'Compiler not configured.' } };
  if (deps.bedrock?.compilePrompt) compiled = await deps.bedrock.compilePrompt(canonical);
  const verified = verifyProtectedFacts(compiled.text, canonical);
  if (!verified.ok) compiled = { status: 'degraded', provider: 'deterministic', text: canonical.prompt, warning: verified };
  stages.push(createStage('prompt.compile', compiled.status || 'degraded', { provider: compiled.provider || 'deterministic', warning: compiled.warning }));
  stages.push(createStage('prompt.reverse_verification', 'ok', { protected_facts: canonical.protectedFacts.length, cue_coverage: canonical.coverageIds.length }));

  const executionId = `exec_${crypto.randomUUID()}`;
  const status = stages.some(stage => stage.status === 'degraded') ? 'degraded' : 'ok';
  return {
    ok: true,
    status,
    provider: compiled.provider || 'deterministic',
    final_prompt: compiled.text,
    prompt_hash: hash(compiled.text),
    executionId,
    execution_id: executionId,
    attachments: canonical.attachments,
    selected_references: policy.selected,
    trimmed_references: policy.trimmed,
    stages,
    evidence,
    summary: canonical.summary,
  };
}
