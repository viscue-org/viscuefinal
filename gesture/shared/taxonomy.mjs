export const INTENTS = Object.freeze([
  'select_region', 'lasso_select', 'apply_instruction', 'connect', 'move', 'resize', 'group', 'emphasize', 'remove', 'replace',
  'point_to', 'rough_layout', 'crop_region', 'reorder', 'insert_between', 'align', 'distribute', 'duplicate', 'rotate', 'zoom',
  'pan', 'approve', 'reject', 'compare', 'sequence', 'flow_direction', 'bracket_group', 'annotate', 'draw_layout', 'unknown',
]);

export const FAMILIES = Object.freeze([
  'selection', 'relation', 'transform', 'navigation', 'markup', 'layout', 'abstention',
]);

const familyEntries = [
  ['select_region', 'selection'], ['lasso_select', 'selection'], ['crop_region', 'selection'],
  ['apply_instruction', 'relation'], ['connect', 'relation'], ['point_to', 'relation'],
  ['replace', 'relation'], ['insert_between', 'relation'], ['sequence', 'relation'],
  ['flow_direction', 'relation'],
  ['move', 'transform'], ['resize', 'transform'], ['reorder', 'transform'], ['align', 'transform'],
  ['distribute', 'transform'], ['duplicate', 'transform'], ['rotate', 'transform'],
  ['zoom', 'navigation'], ['pan', 'navigation'],
  ['emphasize', 'markup'], ['remove', 'markup'], ['approve', 'markup'], ['reject', 'markup'],
  ['annotate', 'markup'],
  ['rough_layout', 'layout'], ['draw_layout', 'layout'], ['compare', 'layout'],
  ['bracket_group', 'layout'], ['group', 'layout'],
  ['unknown', 'abstention'],
];

export const FAMILY_BY_INTENT = Object.freeze(Object.fromEntries(familyEntries));

const intentsByFamily = Object.fromEntries(FAMILIES.map(family => [family, []]));
for (const intent of INTENTS) intentsByFamily[FAMILY_BY_INTENT[intent]].push(intent);
for (const family of FAMILIES) Object.freeze(intentsByFamily[family]);
export const INTENTS_BY_FAMILY = Object.freeze(intentsByFamily);

