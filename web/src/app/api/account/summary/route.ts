import { NextResponse } from 'next/server';
import { createServerClient } from '../../../../lib/supabase/server';
import { requireUser } from '../../../../lib/auth/require-user';
import { getAccountSummary } from '../../../../lib/quota/repository';

export async function GET() {
  const supabase = await createServerClient();

  try {
    await requireUser(supabase);
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
