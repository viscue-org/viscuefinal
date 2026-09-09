import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '../../../../lib/supabase/server';
import { requireUser } from '../../../../lib/auth/require-user';
import { reserveCue, commitCue, releaseCue, QuotaExhaustedError } from '../../../../lib/quota/repository';
import { parseCompilePayload } from '../../../../lib/compiler/payload';
import { runConfiguredPipeline } from '../../../../lib/compiler/run.mjs';

const MAX_PAYLOAD_BYTES = 4_000_000;
export const maxDuration = 300;
const json = (value: unknown, status = 200) => NextResponse.json(value, { status, headers: { 'Cache-Control': 'no-store' } });

async function readBoundedBody(request: Request) {
  if (Number(request.headers.get('content-length')) > MAX_PAYLOAD_BYTES) throw new RangeError('Payload too large');
  const reader = request.body?.getReader();
  if (!reader) return '';
  const decoder = new TextDecoder();
  let size = 0;
  let body = '';
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_PAYLOAD_BYTES) { await reader.cancel(); throw new RangeError('Payload too large'); }
      body += decoder.decode(value, { stream: true });
    }
    return body + decoder.decode();
  } finally { reader.releaseLock(); }
}

export async function POST(request: NextRequest) {
  let body;
  try { body = await readBoundedBody(request); }
  catch (error) { return json({ ok: false, error: error instanceof RangeError ? 'Payload exceeds 4,000,000 bytes limit' : 'Invalid request body' }, error instanceof RangeError ? 413 : 400); }

  const supabase = await createServerClient(request);
  try { await requireUser(supabase, request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')); }
  catch { return json({ ok: false, error: 'Unauthorized' }, 401); }

  let payload;
  try { payload = parseCompilePayload(JSON.parse(body)); }
  catch { return json({ ok: false, error: 'Invalid compilation payload' }, 400); }

  // Ultra-fast cache hit bypassing quota check completely if canvas is entirely unchanged
  try {
    const crypto = await import('node:crypto');
    const normalizeForHash = (val: string) => String(val || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
    const hash = (val: string) => crypto.createHash('sha256').update(normalizeForHash(val)).digest('hex');
    const graphHash = hash(JSON.stringify(payload.graph || {}));

    if (!payload.session?.isNewChat && payload.session?.previousState?.graph_hash === graphHash && payload.session?.previousState?.final_prompt) {
      return json({
        ok: true, status: 'ok', provider: 'cache', cached: true,
        final_prompt: payload.session.previousState.final_prompt,
        prompt_hash: payload.session.previousState.prompt_hash,
        canonical_hash: payload.session.previousState.canonical_hash,
        graph_hash: graphHash,
        executionId: `cache_${crypto.randomUUID()}`, execution_id: `cache_${crypto.randomUUID()}`,
        attachments: [], alreadyAttached: payload.session.previousState.alreadyAttached || [],
        selected_references: payload.session.previousState.selected_references || [], trimmed_references: payload.session.previousState.trimmed_references || [],
        stages: payload.session.previousState.stages || [], ledger: payload.session.previousState.ledger || {}, trust: payload.session.previousState.trust || {},
        evidence: payload.session.previousState.evidence || [], summary: payload.session.previousState.summary || '',
        destination_fingerprint: payload.session?.destinationFingerprint || '',
        data: { version: '3.3.0', status: 'ok', compiledPrompt: payload.session.previousState.final_prompt },
        quota: { remaining: 0, resetsAt: new Date(Date.now() + 86400000).toISOString() } // Dummy quota for cache hits
      });
    }
  } catch (err) {}

  // Each new execution needs a server-owned reservation: a reused committed client
  // key would permit unlimited model calls against one consumed cue.
  let reservation;
  try { reservation = await reserveCue(supabase, crypto.randomUUID()); }
  catch (error) {
    return error instanceof QuotaExhaustedError
      ? json({ ok: false, error: 'Daily cue quota exhausted', code: 'quota_exhausted' }, 429)
      : json({ ok: false, error: 'Failed to reserve compilation cue' }, 500);
  }
  try {
    const plan = reservation.allowance === 99 ? 'pro' : reservation.allowance === 28 ? 'plus' : 'free';
    const result = await runConfiguredPipeline({ ...payload, profile: { plan } });
    if (!result.ok) {
      await releaseCue(supabase, reservation.reservationId);
      return json(result, result.status === 'blocked' ? 422 : 400);
    }
    const committed = await commitCue(supabase, reservation.reservationId);
    if (committed === false) throw new Error('Reservation was not committed');
    return json({
      ...result, destination_fingerprint: payload.session.destinationFingerprint || '',
      data: { version: '3.3.0', status: result.status, compiledPrompt: result.final_prompt },
      // Reservation already reduced remaining; commit must not decrement twice.
      quota: { remaining: reservation.remaining, resetsAt: reservation.resetsAt },
    });
  } catch {
    await releaseCue(supabase, reservation.reservationId).catch(() => {});
    return json({ ok: false, error: 'Transient compilation error. Please try again.' }, 500);
  }
}
