import { NextResponse } from 'next/server';
import { createServerClient } from '../../../../lib/supabase/server';
import { requireUser } from '../../../../lib/auth/require-user';
import { getAccountSummary } from '../../../../lib/quota/repository';

export async function GET(request: Request) {
  const supabase = await createServerClient();
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;

  try {
    await requireUser(supabase, token);
  } catch {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const summary = await getAccountSummary(supabase);
    return NextResponse.json({ ok: true, data: summary });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to retrieve account summary';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
