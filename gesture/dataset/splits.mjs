import { createHash } from 'node:crypto';

export const SPLIT_NAMES = Object.freeze(['train', 'validation', 'test', 'hard_counterfactual', 'template_holdout', 'ood']);
const boundaries = Object.freeze([['train', 55], ['validation', 65], ['test', 75], ['hard_counterfactual', 83], ['template_holdout', 91], ['ood', 100]]);
const stableNumber = value => createHash('sha256').update(String(value)).digest().readUInt32BE(0);

/** Stable, seed-addressable partitioning. A group is never assigned to two splits. */
export function splitForGroup(groupId, seed = 0) {
  const bucket = stableNumber(`split-v1:${seed}:${groupId}`) % 100;
  return boundaries.find(([, upper]) => bucket < upper)[0];
}

export function groupAssignment({ personaIndex, worldSeed, templateIndex, seed }) {
  const split = splitForGroup(`persona:${personaIndex}`, seed);
  const templateFamilies = {
    train: 'arc-core', validation: 'arc-validation', test: 'arc-test',
    hard_counterfactual: 'arc-counterfactual', template_holdout: 'mirror-holdout', ood: 'recovery-ood',
  };
  return Object.freeze({
    split, persona_group: `persona-group:${personaIndex}`,
    world_group: `world-group:${worldSeed}`,
    template_group: `${templateFamilies[split]}:${templateIndex % (split === 'template_holdout' ? 6 : 19)}`,
    mechanism_id: split === 'template_holdout' ? 'executor-template-holdout-v1' : split === 'ood' ? 'executor-ood-v1' : 'executor-core-v1',
  });
}

export function emptySplitGroups() {
  return Object.fromEntries(SPLIT_NAMES.map(name => [name, { persona_groups: [], world_groups: [], template_groups: [], sample_ids: [] }]));
}
export function addSplitMembership(splits, assignment, sampleId) {
  const target = splits[assignment.split];
  target.persona_groups.push(assignment.persona_group);
  target.world_groups.push(assignment.world_group);
  target.template_groups.push(assignment.template_group);
  target.sample_ids.push(sampleId);
}
export function normalizeSplitMembership(splits) {
  for (const split of Object.values(splits)) for (const key of ['persona_groups', 'world_groups', 'template_groups', 'sample_ids']) split[key] = [...new Set(split[key])].sort();
  return splits;
}
