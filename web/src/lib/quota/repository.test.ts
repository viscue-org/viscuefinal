import { describe, it, expect, vi } from 'vitest';
import {
  getAccountSummary,
  reserveCue,
  commitCue,
  releaseCue,
  QuotaExhaustedError,
} from './repository';

describe('Quota Repository', () => {
  it('maps get_account_summary rpc response cleanly', async () => {
    const mockSupabase = {
      rpc: vi.fn().mockResolvedValue({
        data: [
          {
            email: 'witne@gmail.com',
            plan: 'free',
            allowance: 9,
            consumed: 2,
            reserved: 1,
            remaining: 6,
            resets_at: '2026-09-04T00:00:00Z',
            subscription_status: null,
          },
        ],
        error: null,
      }),
    };

    const summary = await getAccountSummary(mockSupabase as never);
    expect(summary).toEqual({
      email: 'witne@gmail.com',
      plan: 'free',
      allowance: 9,
      consumed: 2,
      reserved: 1,
      remaining: 6,
      resetsAt: '2026-09-04T00:00:00.000Z',
      subscriptionStatus: null,
    });
  });

  it('throws QuotaExhaustedError when reserve_cue errors with quota_exhausted', async () => {
    const mockSupabase = {
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'quota_exhausted', code: 'P0001' },
      }),
    };

    await expect(reserveCue(mockSupabase as never, 'req-123')).rejects.toThrow(
      QuotaExhaustedError
    );
  });

  it('commits and releases cue idempotently', async () => {
    const mockSupabase = {
      rpc: vi.fn().mockResolvedValue({ data: true, error: null }),
    };

    const committed = await commitCue(mockSupabase as never, 'res-uuid');
    expect(committed).toBe(true);

    const released = await releaseCue(mockSupabase as never, 'res-uuid');
    expect(released).toBe(true);
  });
});
