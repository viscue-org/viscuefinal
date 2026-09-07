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

  it('runs the real compiler and preserves annotated instructions and stable attachment identity', async () => {
    vi.mocked(reserveCue).mockResolvedValue({ reservationId: 'r', allowance: 9, consumed: 0, reserved: 1, remaining: 8, resetsAt: '2026-09-07T00:00:00Z' });
    const payload = {
      graph: { items: [{ id: 'a', name: 'Hero.png', kind: 'image', hash: 'content-hash', intentional: true }], cues: [{ id: 'c', assetId: 'a', instruction: 'Preserve the red heading', x: 0.25, y: 0.5 }] },
      session: { destinationFingerprint: 'chatgpt:test' },
    };
    const run = async () => (await POST(new Request('http://localhost/api/compile/vicsuc', { method: 'POST', body: JSON.stringify(payload) }) as never)).json();
    const first = await run();
    const second = await run();
    expect(first.final_prompt).toContain('Preserve the red heading');
    expect(first.final_prompt).toContain('Hero.png');
    expect(first.stages.some((stage: { name: string }) => stage.name === 'prompt.reverse_verification')).toBe(true);
    expect(first.attachments[0].stateHash).toBe(second.attachments[0].stateHash);
    expect(first.quota.remaining).toBe(8);
  });

  it('rejects invalid graph types before consuming quota', async () => {
    const response = await POST(new Request('http://localhost/api/compile/vicsuc', { method: 'POST', body: JSON.stringify({ graph: { items: 'not-an-array' } }) }) as never);
    expect(response.status).toBe(400);
    expect(reserveCue).not.toHaveBeenCalled();
  });

  it('enforces actual UTF-8 byte limit without trusting content-length', async () => {
    const response = await POST(new Request('http://localhost/api/compile/vicsuc', { method: 'POST', body: JSON.stringify({ prompt: 'अ'.repeat(1_340_000) }) }) as never);
    expect(response.status).toBe(413);
    expect(reserveCue).not.toHaveBeenCalled();
  });

  it('cannot upgrade reference limits using a client-supplied plan', async () => {
    vi.mocked(reserveCue).mockResolvedValue({ reservationId: 'r', allowance: 9, consumed: 0, reserved: 1, remaining: 8, resetsAt: '2026-09-07T00:00:00Z' });
    const response = await POST(new Request('http://localhost/api/compile/vicsuc', { method: 'POST', body: JSON.stringify({ profile: { plan: 'plus' }, graph: { items: ['a','b','c'].map(id => ({ id, name: id, kind: 'image', intentional: true, preserved: true })) } }) }) as never);
    expect(response.status).toBe(422);
    expect(commitCue).not.toHaveBeenCalled();
    expect(releaseCue).toHaveBeenCalledWith(expect.anything(), 'r');
  });

  it('uses the lower destination capability even for a paid Viscue reservation', async () => {
    vi.mocked(reserveCue).mockResolvedValue({ reservationId: 'r', allowance: 28, consumed: 0, reserved: 1, remaining: 27, resetsAt: '2026-09-07T00:00:00Z' });
    const response = await POST(new Request('http://localhost/api/compile/vicsuc', {
      method: 'POST',
      body: JSON.stringify({
        platformCapability: { platform: 'perplexity', plan: 'max' },
        graph: { items: ['a', 'b', 'c', 'd', 'e'].map(id => ({ id, name: id, kind: 'image', intentional: true, preserved: true })) },
      }),
    }) as never);
    expect(response.status).toBe(422);
    expect(commitCue).not.toHaveBeenCalled();
    expect(releaseCue).toHaveBeenCalledWith(expect.anything(), 'r');
  });

  it('does not reuse a client-controlled quota reservation key for a new compilation', async () => {
    vi.mocked(reserveCue).mockResolvedValue({ reservationId: 'r', allowance: 9, consumed: 0, reserved: 1, remaining: 8, resetsAt: '2026-09-07T00:00:00Z' });
    for (let i = 0; i < 2; i++) await POST(new Request('http://localhost/api/compile/vicsuc', { method: 'POST', body: JSON.stringify({ prompt: 'test', requestId: 'reuse-forever' }) }) as never);
    const calls = vi.mocked(reserveCue).mock.calls;
    expect(calls[0][1]).not.toBe(calls[1][1]);
  });
});
