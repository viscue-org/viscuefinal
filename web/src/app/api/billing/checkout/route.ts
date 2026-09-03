import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '../../../../lib/supabase/server';
import { requireUser } from '../../../../lib/auth/require-user';
import { productIdForPlan, type PaidPlan } from '../../../../lib/billing/config';
import { getOrCreateCustomer } from '../../../../lib/billing/customers';
import { createDodoClient } from '../../../../lib/billing/dodo';
import { publicEnv } from '../../../../lib/env';

export async function POST(request: NextRequest) {
  const supabase = await createServerClient();
  let user;

  try {
    user = await requireUser(supabase);
  } catch {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const plan = body?.plan as PaidPlan;
  if (plan !== 'plus' && plan !== 'pro') {
    return NextResponse.json(
      { ok: false, error: 'Invalid plan requested. Must be "plus" or "pro".' },
      { status: 400 }
    );
  }

  try {
    const customerId = await getOrCreateCustomer(
      supabase,
      user.id,
      user.email ?? `${user.id}@viscue.internal`
    );

    const productId = productIdForPlan(plan);
    const dodo = createDodoClient();
    const siteUrl = publicEnv.NEXT_PUBLIC_SITE_URL;

    const subscription = await dodo.subscriptions.create({
      billing: {
        city: 'City',
        country: 'US',
        state: 'State',
        street: 'Street',
        zipcode: '00000',
      },
      customer: {
        customer_id: customerId,
      },
      product_id: productId,
      quantity: 1,
      return_url: `${siteUrl}/account?checkout=complete`,
      metadata: {
        user_id: user.id,
        plan,
      },
    });

    const checkoutUrl = subscription.payment_link;
    if (!checkoutUrl || !checkoutUrl.startsWith('https://')) {
      throw new Error('Dodo Payments did not return a valid secure checkout link');
    }

    return NextResponse.json({ ok: true, checkoutUrl });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Checkout initiation failed';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
