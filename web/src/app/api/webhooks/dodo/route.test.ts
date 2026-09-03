import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';

vi.mock('../../../../lib/supabase/admin', () => ({
  createAdminClient: vi.fn().mockReturnValue({}),
}));

vi.mock('../../../../lib/billing/apply-event', () => ({
  applyDodoEvent: vi.fn(),
}));

import { applyDodoEvent } from '../../../../lib/billing/apply-event';

describe('POST /api/webhooks/dodo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects malformed payload with 400', async () => {
    const req = new Request('http://localhost:3000/api/webhooks/dodo', {
      method: 'POST',
      body: 'invalid-json',
    });

    const res = await POST(req as never);
    expect(res.status).toBe(400);
  });

  it('successfully processes valid event and returns 200', async () => {
    vi.mocked(applyDodoEvent).mockResolvedValueOnce(true);

    const validPayload = {
      webhook_id: 'wh_test_1',
      type: 'subscription.active',
      data: {
        subscription_id: 'sub_test',
        customer_id: 'cus_test',
        product_id: 'pdt_0Njwkcq27QRFcZ5cACBD5',
      },
    };

    const req = new Request('http://localhost:3000/api/webhooks/dodo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validPayload),
    });

    const res = await POST(req as never);
    expect(res.status).toBe(200);
    expect(applyDodoEvent).toHaveBeenCalled();
  });
});
