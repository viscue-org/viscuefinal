import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getOrCreateCustomer } from './customers';

vi.mock('./dodo', () => ({
  createDodoClient: vi.fn(),
}));

import { createDodoClient } from './dodo';

describe('Customer lookup and creation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns existing customer id without creating a new one', async () => {
    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { dodo_customer_id: 'cus_existing_123' },
              error: null,
            }),
          }),
        }),
      }),
    };

    const customerId = await getOrCreateCustomer(
      mockSupabase as never,
      'u-123',
      'test@example.com'
    );

    expect(customerId).toBe('cus_existing_123');
    expect(createDodoClient).not.toHaveBeenCalled();
  });

  it('creates new Dodo customer when not found locally', async () => {
    const mockCreate = vi.fn().mockResolvedValue({ customer_id: 'cus_new_456' });
    vi.mocked(createDodoClient).mockReturnValue({
      customers: { create: mockCreate },
    } as never);

    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
        insert: vi.fn().mockResolvedValue({ error: null }),
      }),
    };

    const customerId = await getOrCreateCustomer(
      mockSupabase as never,
      'u-123',
      'test@example.com'
    );

    expect(customerId).toBe('cus_new_456');
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'test@example.com' })
    );
  });
});
