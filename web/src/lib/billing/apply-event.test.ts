import { describe, it, expect, vi } from 'vitest';
import { applyDodoEvent } from './apply-event';

describe('applyDodoEvent', () => {
  it('calls apply_dodo_subscription_event with payload hash and mapped attributes', async () => {
    const mockSupabase = {
      rpc: vi.fn().mockResolvedValue({ data: true, error: null }),
    };

    const payload = {
      webhook_id: 'wh_12345',
      type: 'subscription.active',
      data: {
        subscription_id: 'sub_999',
        customer_id: 'cus_888',
        product_id: 'pdt_0Njwkcq27QRFcZ5cACBD5',
        status: 'active',
      },
    };

    const success = await applyDodoEvent(
      mockSupabase as never,
      payload,
      JSON.stringify(payload)
    );

    expect(success).toBe(true);
    expect(mockSupabase.rpc).toHaveBeenCalledWith(
      'apply_dodo_subscription_event',
      expect.objectContaining({
        p_webhook_id: 'wh_12345',
        p_event_type: 'subscription.active',
        p_subscription_id: 'sub_999',
        p_customer_id: 'cus_888',
        p_product_id: 'pdt_0Njwkcq27QRFcZ5cACBD5',
        p_status: 'active',
      })
    );
  });
});
