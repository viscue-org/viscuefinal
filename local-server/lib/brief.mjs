import crypto from 'node:crypto';
import { validateResolution } from '../../gesture/shared/schema.mjs';

export function formatTime(seconds) {
  const milliseconds = Math.max(0, Math.round(Number(seconds || 0) * 1000));
  const minutes = Math.floor(milliseconds / 60000);
  const remaining = milliseconds % 60000;
  return `${String(minutes).padStart(2, '0')}:${String(Math.floor(remaining / 1000)).padStart(2, '0')}.${String(remaining % 1000).padStart(3, '0')}`;
}

export function formatPoint(cue = {}) {
  if (cue.isArea && cue.area) {
    const { x = 0, y = 0, width = 0, height = 0 } = cue.area;
    return `region from ${Math.round(x * 100)}%, ${Math.round(y * 100)}% to ${Math.round((x + width) * 100)}%, ${Math.round((y + height) * 100)}%`;
  }
  return `around ${Math.round(Number(cue.x || 0) * 100)}% across and ${Math.round(Number(cue.y || 0) * 100)}% down`;
}

function stateHash(item) {
  return crypto.createHash('sha256').update(`${item.hash || item.name || ''}::${item.annotations?.length || 0}`).digest('hex');
}

function operationEndpoints(intent) {
  if (['connect', 'apply_instruction', 'point_to', 'replace', 'insert_between', 'sequence', 'flow_direction', 'compare'].includes(intent)) return ['source', 'target'];
  if (['resize', 'move', 'reorder', 'align', 'distribute', 'duplicate', 'rotate', 'crop_region', 'emphasize', 'remove', 'approve', 'reject', 'annotate'].includes(intent)) return ['source'];
  return [];
}

export function buildCanonicalBrief({ graph = {}, selection = {}, evidence = [] } = {}) {
  const byId = new Map((graph.items || []).map(item => [item.id, item]));
  const selected = selection.selected || [];
  const trimmed = selection.trimmed || [];
  const selectedLogical = selected.flatMap(item => item.logicalItems?.length ? item.logicalItems.map(logical => ({ ...logical, required: item.required })) : [item]);
  const trimmedLogical = trimmed.flatMap(item => item.logicalItems?.length ? item.logicalItems : [item]);
  const selectedIds = new Set(selectedLogical.map(item => item.id));
  const lines = ['Use the selected clean references as an explicit visual specification.'];
  const coverageIds = [];
  const protectedFacts = [];
  const cueInstructions = new Set((graph.cues || []).map(cue => cue.instruction?.trim().toLowerCase()).filter(Boolean));
  const cueNoteIds = new Set((graph.cues || []).map(cue => cue.noteId).filter(Boolean));

  for (const cue of graph.cues || []) {
    if (!selectedIds.has(cue.assetId)) continue;
    const asset = byId.get(cue.assetId) || selected.find(item => item.id === cue.assetId);
    if (!asset || !cue.instruction?.trim()) continue;
    coverageIds.push(cue.id);
    const timestamp = cue.timeMs == null ? '' : ` at ${formatTime(cue.timeMs / 1000)}`;
    const target = cue.isWholeAsset ? 'the whole reference' : formatPoint(cue);
    const instructionText = cue.instruction.trim();
    const punct = /[.!?:]$/.test(instructionText) ? '' : '.';
    lines.push(`- ${instructionText}${punct} Apply to ${target} on “${asset.name}”${timestamp}.`);
    protectedFacts.push({ id: `cue:${cue.id}`, text: instructionText }, { id: `name:${asset.id}`, text: asset.name });
    if (cue.timeMs != null) protectedFacts.push({ id: `time:${cue.id}`, text: formatTime(cue.timeMs / 1000) });
  }

  for (const item of graph.items || []) {
    if (item.kind === 'note' && item.text?.trim()) {
      const noteText = item.text.trim();
      if (cueNoteIds.has(item.id) || cueInstructions.has(noteText.toLowerCase())) continue;
      lines.push(`- ${noteText}`);
      protectedFacts.push({ id: `note:${item.id}`, text: noteText });
    }
  }

  let hasUnresolved = false;
  for (const op of graph.operations || []) {
    const resolution = validateResolution(op?.resolution);
    if (resolution.ok && op.resolution.accepted === true && op.intent === op.resolution.intent) {
      const endpoints = operationEndpoints(op.intent);
      const named = Object.fromEntries(endpoints.map(endpoint => [endpoint, byId.get(op[endpoint])]));
      const repeatedPair = endpoints.length === 2 && op.source === op.target;
      if (repeatedPair || endpoints.some(endpoint => typeof op[endpoint] !== 'string' || !named[endpoint]?.name?.trim())) {
        hasUnresolved = true;
        continue;
      }
      if (endpoints.length === 2) lines.push(`- Intent: ${op.intent} from “${named.source.name}” to “${named.target.name}”.`);
      else if (endpoints.length === 1) lines.push(`- Intent: ${op.intent} on “${named.source.name}”.`);
      else lines.push(`- Intent: ${op.intent}.`);
    } else if (op?.unresolved || !resolution.ok || op?.resolution?.accepted === false) {
      hasUnresolved = true;
    }
  }
  
  if (hasUnresolved) {
    lines.push(`Warning: Some gesture intents were unresolved or abstained.`);
  }

  const preserved = selectedLogical.filter(item => String(item.role || '').toLowerCase() === 'preserve' || item.preserved);
  if (preserved.length) {
    const preserveLine = `Preserve exactly: ${preserved.map(item => `“${item.name}”`).join(', ')}.`;
    lines.push(preserveLine);
    for (const item of preserved) protectedFacts.push({ id: `preserve:${item.id}`, text: preserveLine });
  }

  return {
    prompt: lines.join('\n'),
    protectedFacts,
    coverageIds,
    attachments: selectedLogical.map(item => ({ id: item.id, name: item.name, kind: item.kind, hash: item.hash, stateHash: stateHash(item), required: Boolean(item.required) })),
    excluded: trimmedLogical.map(item => ({ id: item.id, name: item.name })),
    evidence,
    summary: { selected: selected.length, trimmed: trimmed.length, cues: coverageIds.length, destination: graph.destination || 'AI chat' },
  };
}

export function verifyProtectedFacts(candidate, canonical = {}) {
  const text = String(candidate || '');
  const missing = (canonical.protectedFacts || []).filter(fact => !text.includes(fact.text)).map(fact => fact.id);
  const forbidden = (canonical.excluded || []).filter(item => item.name && text.includes(item.name)).map(item => `trimmed:${item.id}`);
  return { ok: missing.length === 0 && forbidden.length === 0, missing: [...new Set(missing)], forbidden };
}
