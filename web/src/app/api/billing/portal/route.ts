import { NextResponse } from 'next/server';
import { createServerClient } from '../../../../lib/supabase/server';
import { requireUser } from '../../../../lib/auth/require-user';
import { getOrCreateCustomer } from '../../../../lib/billing/customers';
import { createDodoClient } from '../../../../lib/billing/dodo';

export async function POST() {
  const supabase = await createServerClient();
  let user;

  try {
    user = await requireUser(supabase);
  } catch {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const customerId = await getOrCreateCustomer(
      supabase,
      user.id,
      user.email ?? `${user.id}@viscue.internal`
    );

    const dodo = createDodoClient();
    const portal = await dodo.customers.customerPortal.create(customerId);

    const portalUrl = portal.link;
    if (!portalUrl || !portalUrl.startsWith('https://')) {
      throw new Error('Dodo Payments did not return a valid customer portal link');
    }

    return NextResponse.json({ ok: true, portalUrl });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Customer portal generation failed';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
