import { describe, it, expect } from 'vitest';
import { requireUser } from './require-user';

describe('requireUser', () => {
  it('returns 401 when Supabase has no verified user', async () => {
    await expect(
      requireUser({
        auth: { getUser: async () => ({ data: { user: null }, error: null }) },
      } as never)
    ).rejects.toMatchObject({ status: 401 });
  });

  it('returns verified user id and email for authenticated user', async () => {
    const mockClient = {
      auth: {
        getUser: async () => ({
          data: {
            user: {
              id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
              email: 'witne@gmail.com',
            },
          },
          error: null,
        }),
      },
    };

    const user = await requireUser(mockClient as never);
    expect(user).toEqual({
      id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      email: 'witne@gmail.com',
    });
  });

  it('rejects user without valid UUID id', async () => {
    const mockClient = {
      auth: {
        getUser: async () => ({
          data: {
            user: {
              id: 'not-a-uuid',
              email: 'witne@gmail.com',
            },
          },
          error: null,
        }),
      },
    };

    await expect(requireUser(mockClient as never)).rejects.toMatchObject({
      status: 401,
    });
  });
});
