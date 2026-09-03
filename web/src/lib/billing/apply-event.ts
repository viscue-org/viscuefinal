import crypto from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface DodoWebhookPayload {
  webhook_id: string;
  type: string;
  data: {
    subscription_id?: string;
    customer?: {
      customer_id?: string;
    };
    customer_id?: string;
    product_id?: string;
    status?: string;
    current_period_start?: string;
    current_period_end?: string;
  };
}

export async function applyDodoEvent(
  adminSupabase: SupabaseClient,
  payload: DodoWebhookPayload,
  rawBody: string
): Promise<boolean> {
  const hash = crypto.createHash('sha256').update(rawBody).digest('hex');

  const customerId =
    payload.data.customer?.customer_id ?? payload.data.customer_id ?? '';
  const subscriptionId = payload.data.subscription_id ?? '';
  const productId = payload.data.product_id ?? '';
  const status = payload.data.status ?? 'active';

  const { data, error } = await adminSupabase.rpc(
    'apply_dodo_subscription_event',
    {
      p_webhook_id: payload.webhook_id,
      p_event_type: payload.type,
      p_payload_hash: hash,
      p_subscription_id: subscriptionId,
      p_customer_id: customerId,
      p_product_id: productId,
      p_status: status,
      p_period_start: payload.data.current_period_start || null,
      p_period_end: payload.data.current_period_end || null,
    }
  );

  if (error) {
    throw new Error(error.message);
  }

  return Boolean(data);
}
