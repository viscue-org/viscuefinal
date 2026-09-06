import { describe, it, expect, vi } from 'vitest';
import { GET, POST } from './route';
import { NextRequest } from 'next/server';
import { createServerClient } from '../../../../lib/supabase/server';

vi.mock('../../../../lib/supabase/server', () => ({
  createServerClient: vi.fn(),
}));

describe('api/auth/signout', () => {
  it('calls supabase signOut and redirects to login by default', async () => {
    const signOutMock = vi.fn().mockResolvedValue({});
    vi.mocked(createServerClient).mockResolvedValue({
      auth: { signOut: signOutMock },
    } as any);

    const req = new NextRequest('http://localhost:3000/api/auth/signout');
    const res = await GET(req);

    expect(signOutMock).toHaveBeenCalled();
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://localhost:3000/login');
  });

  it('redirects to next parameter if specified', async () => {
    const signOutMock = vi.fn().mockResolvedValue({});
    vi.mocked(createServerClient).mockResolvedValue({
      auth: { signOut: signOutMock },
    } as any);

    const req = new NextRequest('http://localhost:3000/api/auth/signout?next=/connect?foo=bar');
    const res = await POST(req);

    expect(signOutMock).toHaveBeenCalled();
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://localhost:3000/connect?foo=bar');
  });
});
