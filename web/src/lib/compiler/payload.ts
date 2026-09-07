import { z } from 'zod';

const id = z.string().min(1).max(256);
const text = z.string().max(100_000);
const item = z.object({
  id, name: z.string().max(1000), kind: z.enum(['image', 'video', 'video_frame', 'document', 'webpage', 'note']),
  text: text.optional(), role: z.string().max(100).optional(), hash: z.string().max(256).optional(),
  intentional: z.boolean().default(true), preserved: z.boolean().optional(),
  annotations: z.array(z.record(z.unknown())).max(10000).optional(),
  provenance: z.object({ parentId: id.optional() }).passthrough().optional(),
}).passthrough();
const cue = z.object({
  id, assetId: id, instruction: text, noteId: id.optional(),
  x: z.number().finite().optional(), y: z.number().finite().optional(), timeMs: z.number().finite().nullable().optional(),
}).passthrough();
const graph = z.object({
  destination: z.string().max(256).optional(), items: z.array(item).max(500),
  cues: z.array(cue).max(5000).default([]), relations: z.array(z.record(z.unknown())).max(5000).default([]),
  motions: z.array(z.record(z.unknown())).max(500).default([]), operations: z.array(z.record(z.unknown())).max(10000).default([]),
});
const schema = z.object({
  graph: graph.optional(), prompt: text.optional(),
  media: z.record(z.object({ kind: z.string(), dataUrl: z.string().max(4_000_000) })).default({}),
  session: z.object({ chatId: z.string().max(1000).optional(), destinationFingerprint: z.string().max(2000).optional() }).default({}),
}).refine(value => value.graph || value.prompt?.trim(), 'A graph or instruction is required');

export function parseCompilePayload(value: unknown) {
  const payload = schema.parse(value);
  const normalized = payload.graph ?? { items: [{ id: 'instruction', kind: 'note' as const, name: 'Instruction', text: payload.prompt!, intentional: true }], cues: [], relations: [], motions: [], operations: [] };
  if (new Set(normalized.items.map(item => item.id)).size !== normalized.items.length) throw new Error('Duplicate item IDs');
  return { graph: normalized, media: payload.media, session: payload.session };
}
