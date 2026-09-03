import { PLAN_POLICY } from './contracts.mjs';

const VISUAL_KINDS = new Set(['image', 'video', 'video_frame', 'document', 'webpage']);

function physicalId(item, itemIds) {
  const parentId = item?.provenance?.parentId;
  return parentId && itemIds.has(parentId) ? parentId : item.id;
}

export function rankReferences(references) {
  return [...references].sort((a, b) =>
    Number(Boolean(b.required)) - Number(Boolean(a.required)) ||
    Number(b.finalScore || 0) - Number(a.finalScore || 0) ||
    Number(a.workspaceIndex || 0) - Number(b.workspaceIndex || 0) ||
    String(a.id).localeCompare(String(b.id)));
}

export function requiredReferenceIds(graph = {}) {
  const required = new Set();
  const itemIds = new Set((graph.items || []).map(item => item.id));
  const byId = new Map((graph.items || []).map(item => [item.id, item]));
  const add = id => {
    const item = byId.get(id);
    if (item) required.add(physicalId(item, itemIds));
  };
  for (const item of graph.items || []) {
    if (String(item.role || '').toLowerCase() === 'preserve' || item.preserved) add(item.id);
  }
  for (const cue of graph.cues || []) add(cue.assetId);
  for (const relation of graph.relations || []) {
    if (relation.type === 'CROSS_ASSET_ANNOTATION') {
      add(relation.sourceAssetId);
      add(relation.targetAssetId);
    }
  }
  for (const motion of graph.motions || []) add(motion.assetId);
  return [...required];
}

export function enforceReferencePlan(graph = {}, planName = 'free', scores = new Map()) {
  const plan = PLAN_POLICY[String(planName).toLowerCase()] || PLAN_POLICY.free;
  const itemIds = new Set((graph.items || []).map(item => item.id));
  const requiredIds = requiredReferenceIds(graph);
  const requiredSet = new Set(requiredIds);
  const referencesByPhysical = new Map();

  for (const [workspaceIndex, item] of (graph.items || []).entries()) {
    if (!item?.intentional || item.kind === 'note' || !VISUAL_KINDS.has(item.kind)) continue;
    const id = physicalId(item, itemIds);
    const score = scores instanceof Map ? scores.get(id) : scores?.[id];
    const existing = referencesByPhysical.get(id);
    if (existing) {
      existing.logicalItems.push({ ...item });
      existing.finalScore = Math.max(existing.finalScore, Number(score || 0));
    } else {
      referencesByPhysical.set(id, { ...item, id, workspaceIndex, required: requiredSet.has(id), finalScore: Number(score || 0), logicalItems: [{ ...item }] });
    }
  }
  const references = [...referencesByPhysical.values()];

  if (requiredIds.length > plan.physicalReferences) {
    return {
      status: 'blocked',
      plan: String(planName).toLowerCase(),
      limit: plan.physicalReferences,
      requiredIds,
      selected: [],
      trimmed: references.filter(item => !item.required),
      summary: `${requiredIds.length} required references exceed the ${plan.physicalReferences}-reference plan limit.`,
    };
  }

  const ranked = rankReferences(references);
  const selected = ranked.slice(0, plan.physicalReferences);
  const selectedIds = new Set(selected.map(item => item.id));
  return {
    status: 'ok',
    plan: String(planName).toLowerCase(),
    limit: plan.physicalReferences,
    requiredIds,
    selected,
    trimmed: references.filter(item => !selectedIds.has(item.id)),
    summary: `${selected.length} of ${references.length} physical references selected.`,
  };
}
