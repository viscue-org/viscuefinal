import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';

vi.mock('../../../../lib/supabase/server', () => ({
  createServerClient: vi.fn(),
}));

vi.mock('../../../../lib/auth/require-user', () => ({
  requireUser: vi.fn(),
}));

vi.mock('../../../../lib/quota/repository', () => ({
  reserveCue: vi.fn(),
  commitCue: vi.fn(),
  releaseCue: vi.fn(),
  QuotaExhaustedError: class QuotaExhaustedError extends Error {
    code = 'quota_exhausted';
    status = 429;
  },
}));

import { createServerClient } from '../../../../lib/supabase/server';
import { requireUser } from '../../../../lib/auth/require-user';
import {
  reserveCue,
  commitCue,
  releaseCue,
  QuotaExhaustedError,
} from '../../../../lib/quota/repository';

describe('POST /api/compile/vicsuc', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createServerClient).mockResolvedValue({} as never);
  });

  it('rejects payload exceeding 4,000,000 bytes with 413', async () => {
    const req = new Request('http://localhost:3000/api/compile/vicsuc', {
      method: 'POST',
      headers: { 'Content-Length': '4000001' },
      body: 'x',
    });

    const res = await POST(req as never);
    expect(res.status).toBe(413);
  });

  it('rejects unauthenticated request with 401', async () => {
    vi.mocked(requireUser).mockRejectedValueOnce(new Error('Unauthorized'));

    const req = new Request('http://localhost:3000/api/compile/vicsuc', {
      method: 'POST',
      body: JSON.stringify({ prompt: 'test' }),
    });

    const res = await POST(req as never);
    expect(res.status).toBe(401);
  });

  it('returns 429 when quota is exhausted', async () => {
    vi.mocked(requireUser).mockResolvedValueOnce({
      id: 'u-123',
      email: 'test@example.com',
    });
    vi.mocked(reserveCue).mockRejectedValueOnce(new QuotaExhaustedError());

    const req = new Request('http://localhost:3000/api/compile/vicsuc', {
      method: 'POST',
      body: JSON.stringify({ prompt: 'test' }),
    });

    const res = await POST(req as never);
    expect(res.status).toBe(429);
  });

  it('compiles and commits reservation on success', async () => {
    vi.mocked(requireUser).mockResolvedValueOnce({
      id: 'u-123',
      email: 'test@example.com',
    });
    vi.mocked(reserveCue).mockResolvedValueOnce({
      reservationId: 'res-1',
      allowance: 9,
      consumed: 0,
      reserved: 1,
      remaining: 8,
      resetsAt: '2026-09-04T00:00:00Z',
    });

    const req = new Request('http://localhost:3000/api/compile/vicsuc', {
      method: 'POST',
      body: JSON.stringify({ prompt: 'compile this UI', nodes: [], edges: [] }),
    });

    const res = await POST(req as never);
    expect(res.status).toBe(200);
    expect(commitCue).toHaveBeenCalledWith(expect.anything(), 'res-1');
  });
});
