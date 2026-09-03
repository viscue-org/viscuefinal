import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';

vi.mock('../../../../lib/supabase/server', () => ({
  createServerClient: vi.fn(),
}));

vi.mock('../../../../lib/auth/require-user', () => ({
  requireUser: vi.fn(),
}));

vi.mock('../../../../lib/billing/customers', () => ({
  getOrCreateCustomer: vi.fn(),
}));

vi.mock('../../../../lib/billing/dodo', () => ({
  createDodoClient: vi.fn(),
}));

import { requireUser } from '../../../../lib/auth/require-user';
import { getOrCreateCustomer } from '../../../../lib/billing/customers';
import { createDodoClient } from '../../../../lib/billing/dodo';

describe('POST /api/billing/checkout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 if unauthenticated', async () => {
    vi.mocked(requireUser).mockRejectedValueOnce(new Error('Unauthorized'));

    const req = new Request('http://localhost:3000/api/billing/checkout', {
      method: 'POST',
      body: JSON.stringify({ plan: 'plus' }),
    });

    const res = await POST(req as never);
    expect(res.status).toBe(401);
  });

  it('returns 400 for invalid plan', async () => {
    vi.mocked(requireUser).mockResolvedValueOnce({
      id: 'u-123',
      email: 'test@example.com',
    });

    const req = new Request('http://localhost:3000/api/billing/checkout', {
      method: 'POST',
      body: JSON.stringify({ plan: 'unsupported' }),
    });

    const res = await POST(req as never);
    expect(res.status).toBe(400);
  });

  it('generates secure checkout link for valid plan', async () => {
    vi.mocked(requireUser).mockResolvedValueOnce({
      id: 'u-123',
      email: 'test@example.com',
    });

    vi.mocked(getOrCreateCustomer).mockResolvedValueOnce('cus_123');

    const mockCreate = vi.fn().mockResolvedValue({
      payment_link: 'https://checkout.dodopayments.com/buy/sub_123',
    });

    vi.mocked(createDodoClient).mockReturnValue({
      subscriptions: { create: mockCreate },
    } as never);

    const req = new Request('http://localhost:3000/api/billing/checkout', {
      method: 'POST',
      body: JSON.stringify({ plan: 'plus' }),
    });

    const res = await POST(req as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      ok: true,
      checkoutUrl: 'https://checkout.dodopayments.com/buy/sub_123',
    });
  });
});
