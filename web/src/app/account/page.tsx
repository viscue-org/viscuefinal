import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createServerClient } from '../../lib/supabase/server';
import { requireUser } from '../../lib/auth/require-user';
import { getAccountSummary } from '../../lib/quota/repository';
import { signOut } from '../../features/auth/actions';
import { AccountDashboard } from '../../features/account/account-dashboard';

export default async function AccountPage() {
  const supabase = await createServerClient();
  let user;

  try {
    user = await requireUser(supabase);
  } catch {
    redirect('/login?next=/account');
  }

  let summary;
  try {
    summary = await getAccountSummary(supabase);
  } catch {
    // Default fallback when database is fresh
    summary = {
      email: user.email ?? 'Unknown',
      plan: 'free' as const,
      allowance: 9 as const,
      consumed: 0,
      reserved: 0,
      remaining: 9,
      resetsAt: new Date(Date.now() + 86400000).toISOString(),
      subscriptionStatus: null,
    };
  }

  return (
    <main style={{ minHeight: '100vh', padding: '40px 0' }}>
      <div className="container" style={{ maxWidth: '680px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
          <Link href="/" style={{ color: '#8E9BAE', fontSize: '14px' }}>
            &larr; Viscue Home
          </Link>
          <form action={signOut}>
            <button
              type="submit"
              style={{ background: 'transparent', border: '1px solid rgba(255, 255, 255, 0.2)', color: '#EDF2F6', borderRadius: '6px', padding: '6px 14px', fontSize: '13px', cursor: 'pointer' }}
            >
              Sign out
            </button>
          </form>
        </div>

        <h1 style={{ fontSize: '32px', fontWeight: 800, marginBottom: '24px' }}>Account &amp; Quota</h1>

        <AccountDashboard summary={summary} userId={user.id} />
      </div>
    </main>
  );
}
