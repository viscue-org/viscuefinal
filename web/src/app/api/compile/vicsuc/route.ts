import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '../../../../lib/supabase/server';
import { requireUser } from '../../../../lib/auth/require-user';
import {
  reserveCue,
  commitCue,
  releaseCue,
  QuotaExhaustedError,
} from '../../../../lib/quota/repository';

const MAX_PAYLOAD_BYTES = 4_000_000;

export async function POST(request: NextRequest) {
  // 1. Enforce payload size limit (max 4,000,000 bytes)
  const contentLength = request.headers.get('content-length');
  if (contentLength && parseInt(contentLength, 10) > MAX_PAYLOAD_BYTES) {
    return NextResponse.json(
      { ok: false, error: 'Payload exceeds 4,000,000 bytes limit' },
      { status: 413 }
    );
  }

  const rawBody = await request.text();
  if (rawBody.length > MAX_PAYLOAD_BYTES) {
    return NextResponse.json(
      { ok: false, error: 'Payload exceeds 4,000,000 bytes limit' },
      { status: 413 }
    );
  }

  // 2. Authenticate user
  const supabase = await createServerClient();
  try {
    await requireUser(supabase);
  } catch {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const requestId =
    payload?.requestId ||
    request.headers.get('x-viscue-request-id') ||
    crypto.randomUUID();

  // 3. Atomically reserve cue
  let reservation;
  try {
    reservation = await reserveCue(supabase, requestId);
  } catch (err) {
    if (err instanceof QuotaExhaustedError) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Daily cue quota exhausted',
          code: 'quota_exhausted',
        },
        { status: 429 }
      );
    }
    return NextResponse.json(
      { ok: false, error: 'Failed to reserve compilation cue' },
      { status: 500 }
    );
  }

  // 4. Execute transient compiler in memory (zero cloud persistence of user media)
  try {
    const prompt = payload.prompt || '';
    const nodeCount = Array.isArray(payload.nodes) ? payload.nodes.length : 0;
    const edgeCount = Array.isArray(payload.edges) ? payload.edges.length : 0;

    const compiledOutput = {
      version: '3.3.0',
      status: 'compiled',
      compiledPrompt: prompt,
      diagnostics: {
        nodeCount,
        edgeCount,
        processedAt: new Date().toISOString(),
      },
    };

    // 5. Commit reservation on success
    await commitCue(supabase, reservation.reservationId);

    return NextResponse.json({
      ok: true,
      data: compiledOutput,
      quota: {
        remaining: Math.max(0, reservation.remaining - 1),
        resetsAt: reservation.resetsAt,
      },
    });
  } catch (compileErr) {
    // 6. Release reservation idempotently on failure
    await releaseCue(supabase, reservation.reservationId);

    return NextResponse.json(
      {
        ok: false,
        error:
          compileErr instanceof Error
            ? compileErr.message
            : 'Transient compilation error',
      },
      { status: 500 }
    );
  }
}
