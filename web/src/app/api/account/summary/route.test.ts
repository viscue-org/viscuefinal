import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from './route';

vi.mock('../../../../lib/supabase/server', () => ({
  createServerClient: vi.fn(),
}));

vi.mock('../../../../lib/auth/require-user', () => ({
  requireUser: vi.fn(),
}));

vi.mock('../../../../lib/quota/repository', () => ({
  getAccountSummary: vi.fn(),
}));

import { createServerClient } from '../../../../lib/supabase/server';
import { requireUser } from '../../../../lib/auth/require-user';
import { getAccountSummary } from '../../../../lib/quota/repository';

describe('GET /api/account/summary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 if unauthenticated', async () => {
    vi.mocked(requireUser).mockRejectedValueOnce(new Error('Unauthorized'));

    const response = await GET();
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body).toEqual({ ok: false, error: 'Unauthorized' });
  });

  it('returns account summary data for authenticated user', async () => {
    vi.mocked(requireUser).mockResolvedValueOnce({
      id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      email: 'witne@gmail.com',
    });

    vi.mocked(getAccountSummary).mockResolvedValueOnce({
      email: 'witne@gmail.com',
      plan: 'free',
      allowance: 9,
      consumed: 0,
      reserved: 0,
      remaining: 9,
      resetsAt: '2026-09-04T00:00:00.000Z',
      subscriptionStatus: null,
    });

    const response = await GET();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.data.remaining).toBe(9);
  });
});
