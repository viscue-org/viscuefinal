import type { SupabaseClient } from '@supabase/supabase-js';
import { createDodoClient } from './dodo';

export async function getOrCreateCustomer(
  supabase: SupabaseClient,
  userId: string,
  userEmail: string
): Promise<string> {
  // 1. Check existing customer mapping
  const { data: existing } = await supabase
    .from('billing_customers')
    .select('dodo_customer_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (existing?.dodo_customer_id) {
    return existing.dodo_customer_id;
  }

  // 2. Create customer in Dodo Payments
  const dodo = createDodoClient();
  const customer = await dodo.customers.create({
    email: userEmail,
    name: userEmail.split('@')[0],
  });

  const dodoCustomerId = customer.customer_id;

  // 3. Upsert into billing_customers
  const { error: insertError } = await supabase
    .from('billing_customers')
    .insert({
      user_id: userId,
      dodo_customer_id: dodoCustomerId,
    });

  if (insertError) {
    // If concurrent insert occurred, return the stored customer id
    const { data: recheck } = await supabase
      .from('billing_customers')
      .select('dodo_customer_id')
      .eq('user_id', userId)
      .single();

    if (recheck?.dodo_customer_id) {
      return recheck.dodo_customer_id;
    }
  }

  return dodoCustomerId;
}
