export function formatTime(seconds) {
  const milliseconds = Math.max(0, Math.round(Number(seconds || 0) * 1000));
  const minutes = Math.floor(milliseconds / 60000);
  const remaining = milliseconds % 60000;
  return `${String(minutes).padStart(2, '0')}:${String(Math.floor(remaining / 1000)).padStart(2, '0')}.${String(remaining % 1000).padStart(3, '0')}`;
}

function compassRegion(x, y) {
  const col = x < 0.33 ? 'left' : x > 0.67 ? 'right' : 'center';
  const row = y < 0.33 ? 'top' : y > 0.67 ? 'bottom' : 'middle';
  if (row === 'middle' && col === 'center') return 'center';
  if (row === 'middle') return col;
  if (col === 'center') return row + '-center';
  return `${row}-${col}`;
}

export function formatPoint(cue = {}, evidenceList = []) {
  if (cue.isArea && cue.area) {
    const { x = 0, y = 0, width = 0, height = 0 } = cue.area;
    const cx = x + width / 2;
    const cy = y + height / 2;
    const region = compassRegion(cx, cy);
    return `the ${region} region [${Math.round(x * 100)}%, ${Math.round(y * 100)}% to ${Math.round((x + width) * 100)}%, ${Math.round((y + height) * 100)}%]`;
  }
  const px = Number(cue.x || 0);
  const py = Number(cue.y || 0);
  const region = compassRegion(px, py);
  return `the ${region} area at [${Math.round(px * 100)}%, ${Math.round(py * 100)}%]`;
}

export async function compileLocal(payload) {
  const graph = payload.graph || {};
  const lines = ["Please analyze these images and follow the instructions:"];
  const attachments = [];
  
  const byId = new Map((graph.items || []).map(item => [item.id, item]));

  for (const item of graph.items || []) {
    if (item.kind !== 'note') {
      attachments.push({
        id: item.id,
        name: item.name,
        kind: item.kind,
        stateHash: item.hash || item.id,
        required: true
      });
    }
  }

  const cueNoteIds = new Set((graph.cues || []).map(cue => cue.noteId).filter(Boolean));
  for (const cue of graph.cues || []) {
    const asset = byId.get(cue.assetId);
    if (!asset || !cue.instruction?.trim()) continue;
    const timestamp = cue.timeMs == null ? '' : ` at ${formatTime(cue.timeMs / 1000)}`;
    const target = cue.isWholeAsset ? 'the whole reference' : formatPoint(cue, []);
    const instructionText = cue.instruction.trim();
    const punct = /[.!?:]$/.test(instructionText) ? '' : '.';
    lines.push(`- On "${asset.name}"${timestamp} in ${target}: ${instructionText}${punct}`);
  }

  for (const item of graph.items || []) {
    if (item.kind === 'note' && item.text?.trim() && !cueNoteIds.has(item.id)) {
      lines.push(`- ${item.text.trim()}`);
    }
  }

  for (const relation of graph.relations || []) {
    if (relation.type === 'CROSS_ASSET_ANNOTATION') {
      const sourceAsset = byId.get(relation.sourceAssetId);
      const targetAsset = byId.get(relation.targetAssetId);
      if (sourceAsset && targetAsset) {
        const sourceLoc = formatPoint({ x: relation.sourceX, y: relation.sourceY, isArea: relation.sourceIsArea, area: relation.sourceArea });
        const targetLoc = relation.targetIsWholeAsset ? 'the whole reference' : formatPoint({ x: relation.targetX, y: relation.targetY, isArea: relation.targetIsArea, area: relation.targetArea });
        const instruction = relation.instruction?.trim() || 'Connect and apply';
        const punct = /[.!?:]$/.test(instruction) ? '' : '.';
        lines.push(`- On "${sourceAsset.name}" at ${sourceLoc}: ${instruction}${punct} Using reference "${targetAsset.name}" (${targetLoc}).`);
      }
    } else if (relation.type === 'FLOWS_TO') {
      const source = byId.get(relation.sourceId);
      const target = byId.get(relation.targetId);
      if (source && target) {
        if (source.text && target.text) lines.push(`- Flowchart sequence: "${source.text.trim()}" -> "${target.text.trim()}"`);
        else if (source.text && target.name) lines.push(`- Note "${source.text.trim()}" directs to "${target.name}".`);
        else if (source.name && target.text) lines.push(`- Reference "${source.name}" leads to note "${target.text.trim()}".`);
        else if (source.name && target.name) lines.push(`- Sequence: "${source.name}" -> "${target.name}".`);
      }
    }
  }

  // Generate execution ID
  const execution_id = 'loc-' + Date.now().toString(36) + Math.random().toString(36).substring(2);

  return {
    ok: true,
    status: 'ok',
    provider: 'local-compiler',
    final_prompt: lines.join('\n\n'),
    execution_id,
    attachments,
    destination_fingerprint: payload.session?.destinationFingerprint || 'local:chat',
    prompt_hash: 'local-hash-' + Date.now()
  };
}
