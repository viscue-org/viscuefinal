import crypto from 'node:crypto';
import { validateResolution } from '../../gesture/shared/schema.mjs';

export function formatTime(seconds) {
  const milliseconds = Math.max(0, Math.round(Number(seconds || 0) * 1000));
  const minutes = Math.floor(milliseconds / 60000);
  const remaining = milliseconds % 60000;
  return `${String(minutes).padStart(2, '0')}:${String(Math.floor(remaining / 1000)).padStart(2, '0')}.${String(remaining % 1000).padStart(3, '0')}`;
}

function compassRegion(x, y) {
  // Divide image into a 3x3 grid for human-readable spatial description
  const col = x < 0.33 ? 'left' : x > 0.67 ? 'right' : 'center';
  const row = y < 0.33 ? 'top' : y > 0.67 ? 'bottom' : 'middle';
  if (row === 'middle' && col === 'center') return 'center';
  if (row === 'middle') return col;
  if (col === 'center') return row + '-center';
  return `${row}-${col}`;
}

export function formatPoint(cue = {}, evidenceList = []) {
  let matchedObject = null;
  if (evidenceList && evidenceList.length > 0) {
    const cueAssetId = cue.assetId;
    let cx, cy;
    if (cue.isArea && cue.area) {
      cx = cue.area.x + cue.area.width / 2;
      cy = cue.area.y + cue.area.height / 2;
    } else {
      cx = Number(cue.x || 0);
      cy = Number(cue.y || 0);
    }
    
    const matches = [];
    for (const ev of evidenceList) {
      if (ev.provenance?.asset_id === cueAssetId && ev.bbox) {
        const [bx1, by1, bx2, by2] = ev.bbox;
        if (cx >= bx1 && cx <= bx2 && cy >= by1 && cy <= by2) {
          if (ev.value && typeof ev.value === 'string') {
            matches.push(ev);
          }
        }
      }
    }
    
    if (matches.length > 0) {
      matches.sort((a, b) => {
        const areaA = (a.bbox[2] - a.bbox[0]) * (a.bbox[3] - a.bbox[1]);
        const areaB = (b.bbox[2] - b.bbox[0]) * (b.bbox[3] - b.bbox[1]);
        return areaA - areaB;
      });
      matchedObject = matches[0].value;
    }
  }

  if (cue.isArea && cue.area) {
    const { x = 0, y = 0, width = 0, height = 0 } = cue.area;
    const cx = x + width / 2;
    const cy = y + height / 2;
    const region = compassRegion(cx, cy);
    if (matchedObject) return `the ${region} region (at "${matchedObject}")`;
    return `the ${region} region`;
  }
  const px = Number(cue.x || 0);
  const py = Number(cue.y || 0);
  const region = compassRegion(px, py);
  if (matchedObject) return `the ${region} area (at "${matchedObject}")`;
  return `the ${region} area`;
}

function stateHash(item) {
  return crypto.createHash('sha256').update(`${item.hash || item.name || ''}::${item.annotations?.length || 0}`).digest('hex');
}

function operationEndpoints(intent) {
  if (['connect', 'apply_instruction', 'point_to', 'replace', 'insert_between', 'sequence', 'flow_direction', 'compare'].includes(intent)) return ['source', 'target'];
  if (['resize', 'move', 'reorder', 'align', 'distribute', 'duplicate', 'rotate', 'crop_region', 'emphasize', 'remove', 'approve', 'reject', 'annotate'].includes(intent)) return ['source'];
  return [];
}

export function buildCanonicalBrief({ graph = {}, selection = {}, evidence = [], alreadyAttached = [] } = {}) {
  const byId = new Map((graph.items || []).map(item => [item.id, item]));
  const selected = selection.selected || [];
  const trimmed = selection.trimmed || [];
  const selectedLogical = selected.flatMap(item => item.logicalItems?.length ? item.logicalItems.map(logical => ({ ...logical, required: item.required })) : [item]);
  const trimmedLogical = trimmed.flatMap(item => item.logicalItems?.length ? item.logicalItems : [item]);
  const selectedIds = new Set(selectedLogical.map(item => item.id));
  const lines = [];
  if (Array.isArray(alreadyAttached) && alreadyAttached.length > 0) {
    const priorNames = alreadyAttached.map(a => `“${a.name}”`).join(', ');
    lines.push(`(Note: ${priorNames} was already attached in prior turns of this conversation and will not be re-uploaded.)`);
  }
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
    const target = cue.isWholeAsset ? 'the whole reference' : formatPoint(cue, evidence);
    const instructionText = cue.instruction.trim();
    const punct = /[.!?:]$/.test(instructionText) ? '' : '.';
    // Natural phrasing so AI models interpret the directive without bureaucratic form inflation
    lines.push(`- On "${asset.name}"${timestamp} in ${target}: ${instructionText}${punct}`);
    protectedFacts.push({ id: `name:${asset.id}`, text: asset.name });
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

  for (const relation of graph.relations || []) {
    if (relation.type === 'CROSS_ASSET_ANNOTATION') {
      const sourceAsset = byId.get(relation.sourceAssetId) || selected.find(item => item.id === relation.sourceAssetId);
      const targetAsset = byId.get(relation.targetAssetId) || selected.find(item => item.id === relation.targetAssetId);
      if (sourceAsset && targetAsset) {
        const sourceLoc = formatPoint({
          x: relation.sourceX,
          y: relation.sourceY,
          isArea: relation.sourceIsArea,
          area: relation.sourceArea,
          assetId: relation.sourceAssetId
        }, evidence);
        const targetLoc = relation.targetIsWholeAsset
          ? 'the whole reference'
          : formatPoint({
              x: relation.targetX,
              y: relation.targetY,
              isArea: relation.targetIsArea,
              area: relation.targetArea,
              assetId: relation.targetAssetId
            }, evidence);
        const instruction = relation.instruction?.trim() || 'Connect and apply';
        const punct = /[.!?:]$/.test(instruction) ? '' : '.';
        lines.push(`- On "${sourceAsset.name}" (Target: ${sourceLoc}): ${instruction}${punct} Using reference "${targetAsset.name}" (${targetLoc}).`);
        protectedFacts.push({ id: `name:${sourceAsset.id}`, text: sourceAsset.name });
        protectedFacts.push({ id: `name:${targetAsset.id}`, text: targetAsset.name });
      }
    } else if (relation.type === 'FLOWS_TO') {
      const source = byId.get(relation.sourceId);
      const target = byId.get(relation.targetId);
      if (source && target) {
        if (source.text && target.text) {
          lines.push(`- Flowchart sequence: "${source.text.trim()}" -> "${target.text.trim()}"`);
        } else if (source.text && target.name) {
          lines.push(`- Note "${source.text.trim()}" directs to "${target.name}".`);
          protectedFacts.push({ id: `name:${target.id}`, text: target.name });
        } else if (source.name && target.text) {
          lines.push(`- Reference "${source.name}" leads to note "${target.text.trim()}".`);
          protectedFacts.push({ id: `name:${source.id}`, text: source.name });
        } else if (source.name && target.name) {
          lines.push(`- Sequence: "${source.name}" -> "${target.name}".`);
          protectedFacts.push({ id: `name:${source.id}`, text: source.name });
          protectedFacts.push({ id: `name:${target.id}`, text: target.name });
        }
      }
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
