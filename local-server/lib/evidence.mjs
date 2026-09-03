export function normalizeBbox(value) {
  if (!Array.isArray(value) || value.length !== 4) return null;
  const box = value.map(Number);
  if (box.some(number => !Number.isFinite(number) || number < 0 || number > 1)) return null;
  if (box[2] <= box[0] || box[3] <= box[1]) return null;
  return box;
}

function area(box) {
  return (box[2] - box[0]) * (box[3] - box[1]);
}

function intersection(a, b) {
  const width = Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0]));
  const height = Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
  return width * height;
}

export function validateCompositePanels(panels) {
  if (!Array.isArray(panels) || panels.length < 2 || panels.length > 9) return { ok: false, reason: 'A composite must contain 2 to 9 panels.' };
  const boxes = panels.map(panel => normalizeBbox(panel.bbox));
  if (boxes.some(box => !box)) return { ok: false, reason: 'Every panel requires a normalized bounding box.' };
  if (boxes.some(box => area(box) < 0.04)) return { ok: false, reason: 'Each panel must cover at least 4% of the parent.' };
  let covered = boxes.reduce((total, box) => total + area(box), 0);
  for (let left = 0; left < boxes.length; left += 1) {
    for (let right = left + 1; right < boxes.length; right += 1) {
      const overlap = intersection(boxes[left], boxes[right]);
      if (overlap / Math.min(area(boxes[left]), area(boxes[right])) > 0.08) return { ok: false, reason: 'Panel overlap exceeds 8%.' };
      covered -= overlap;
    }
  }
  if (covered < 0.55) return { ok: false, reason: 'Panels must cover at least 55% of the parent.' };
  return { ok: true, panels: panels.map((panel, index) => ({ ...panel, bbox: boxes[index] })) };
}

export function normalizeEvidence(claim = {}, context = {}) {
  const observationKind = claim.observation_kind || (['bbox', 'ocr', 'object', 'layout'].includes(claim.type) ? 'observed' : 'inferred');
  return {
    type: String(claim.type || 'unknown'),
    value: claim.value ?? null,
    bbox: normalizeBbox(claim.bbox),
    confidence: Math.max(0, Math.min(1, Number(claim.confidence || 0))),
    observation_kind: observationKind,
    provenance: {
      provider: context.provider || 'unknown',
      model: context.model || 'unknown',
      asset_id: context.assetId || null,
      source_region: normalizeBbox(context.sourceRegion),
    },
  };
}

export function deriveSpatialRelations(objects = []) {
  const normalized = objects.map(object => ({ ...object, bbox: normalizeBbox(object.bbox) })).filter(object => object.bbox);
  const relations = [];
  for (let left = 0; left < normalized.length; left += 1) {
    for (let right = left + 1; right < normalized.length; right += 1) {
      const a = normalized[left];
      const b = normalized[right];
      const ac = [(a.bbox[0] + a.bbox[2]) / 2, (a.bbox[1] + a.bbox[3]) / 2];
      const bc = [(b.bbox[0] + b.bbox[2]) / 2, (b.bbox[1] + b.bbox[3]) / 2];
      const horizontal = Math.abs(ac[0] - bc[0]);
      const vertical = Math.abs(ac[1] - bc[1]);
      const relation = intersection(a.bbox, b.bbox) > 0 ? 'overlaps' : horizontal >= vertical ? (ac[0] < bc[0] ? 'left_of' : 'right_of') : (ac[1] < bc[1] ? 'above' : 'below');
      relations.push({ source_id: a.id, relation, target_id: b.id, observation_kind: 'derived' });
    }
  }
  return relations;
}
