const PLANS = new Set(['free', 'pro', 'plus']);
const VISUAL_KINDS = new Set(['image', 'video', 'video_frame', 'document', 'webpage']);

export function normalizePlan(value) {
  const plan = String(value || 'free').toLowerCase();
  return PLANS.has(plan) ? plan : 'free';
}

export function stageLabel(stage = {}) {
  if (stage.status === 'blocked') return 'Action required';
  if (stage.status === 'degraded') return 'Fallback used';
  if (stage.status === 'skipped') return 'Skipped';
  return 'Ready';
}

export function buildVicsucRequest(graph = {}, media = {}, profile = {}, session = {}) {
  const visualIds = new Set((graph.items || []).filter(item => item.intentional !== false && VISUAL_KINDS.has(item.kind)).map(item => item.id));
  const boundedMedia = Object.fromEntries(Object.entries(media || {}).filter(([id, value]) => visualIds.has(id) && value?.dataUrl && VISUAL_KINDS.has(value.kind)));
  return { graph, media: boundedMedia, profile: { ...profile, plan: normalizePlan(profile.plan) }, session };
}
