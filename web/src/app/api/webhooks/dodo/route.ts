import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '../../../../lib/supabase/admin';
import { applyDodoEvent, type DodoWebhookPayload } from '../../../../lib/billing/apply-event';
import { createDodoClient } from '../../../../lib/billing/dodo';

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const webhookKey = process.env.DODO_PAYMENTS_WEBHOOK_KEY;

  let payload: DodoWebhookPayload;

  if (webhookKey) {
    try {
      const dodo = createDodoClient();
      const headersRecord: Record<string, string> = {};
      request.headers.forEach((val, key) => {
        headersRecord[key.toLowerCase()] = val;
      });

      // Use official SDK webhook unwrapping
      const unwrapResult = dodo.webhooks.unwrap(rawBody, {
        headers: headersRecord,
        key: webhookKey,
      });

      payload = unwrapResult as unknown as DodoWebhookPayload;
    } catch {
      return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 });
    }
  } else {
    // Development fallback without secret
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: 'Malformed JSON payload' }, { status: 400 });
    }
  }

  if (!payload?.webhook_id || !payload?.type) {
    return NextResponse.json({ error: 'Malformed event format' }, { status: 400 });
  }

  try {
    const adminSupabase = createAdminClient();
    await applyDodoEvent(adminSupabase, payload, rawBody);
    return NextResponse.json({ received: true }, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Database update failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
