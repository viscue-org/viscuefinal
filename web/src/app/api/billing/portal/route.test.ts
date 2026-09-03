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

describe('POST /api/billing/portal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 if unauthenticated', async () => {
    vi.mocked(requireUser).mockRejectedValueOnce(new Error('Unauthorized'));

    const res = await POST();
    expect(res.status).toBe(401);
  });

  it('generates secure customer portal link for authenticated user', async () => {
    vi.mocked(requireUser).mockResolvedValueOnce({
      id: 'u-123',
      email: 'test@example.com',
    });

    vi.mocked(getOrCreateCustomer).mockResolvedValueOnce('cus_123');

    const mockPortal = vi.fn().mockResolvedValue({
      link: 'https://customer.dodopayments.com/portal/ses_123',
    });

    vi.mocked(createDodoClient).mockReturnValue({
      customers: { customerPortal: { create: mockPortal } },
    } as never);

    const res = await POST();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      ok: true,
      portalUrl: 'https://customer.dodopayments.com/portal/ses_123',
    });
  });
});
