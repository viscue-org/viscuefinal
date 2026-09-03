import Link from 'next/link';
import { redirect } from 'next/navigation';
import { signUpWithPassword, signInWithGoogle } from '../../../features/auth/actions';

export default async function SignupPage(props: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const searchParams = await props.searchParams;
  const next = searchParams.next ?? '';
  const error = searchParams.error;

  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ width: '100%', maxWidth: '400px', background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '16px', padding: '32px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '8px', textAlign: 'center' }}>Create an Account</h1>
        <p style={{ color: '#8E9BAE', fontSize: '14px', marginBottom: '24px', textAlign: 'center' }}>
          Get started with 9 free daily cues
        </p>

        {error && (
          <div role="alert" style={{ background: 'rgba(255, 90, 54, 0.15)', border: '1px solid #FF5A36', color: '#FF7D60', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', marginBottom: '20px' }}>
            {error}
          </div>
        )}

        <form action={async (formData: FormData) => {
          'use server';
          const res = await signUpWithPassword(formData);
          if (!res.ok) {
            redirect(`/signup?error=${encodeURIComponent(res.error ?? 'Signup failed')}`);
          }
          redirect('/verify');
        }}>
          <div style={{ marginBottom: '16px' }}>
            <label htmlFor="signup-email" style={{ display: 'block', fontSize: '13px', color: '#CBD5E1', marginBottom: '6px' }}>
              Email address
            </label>
            <input
              id="signup-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              style={{ width: '100%', background: 'rgba(0, 0, 0, 0.2)', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '8px', padding: '10px 12px', color: '#EDF2F6', fontSize: '14px' }}
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label htmlFor="signup-password" style={{ display: 'block', fontSize: '13px', color: '#CBD5E1', marginBottom: '6px' }}>
              Password (min. 12 characters)
            </label>
            <input
              id="signup-password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={12}
              style={{ width: '100%', background: 'rgba(0, 0, 0, 0.2)', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '8px', padding: '10px 12px', color: '#EDF2F6', fontSize: '14px' }}
            />
          </div>

          <button
            type="submit"
            style={{ width: '100%', background: '#5B7593', color: '#FFFFFF', border: 'none', borderRadius: '8px', padding: '12px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', marginBottom: '16px' }}
          >
            Create account
          </button>
        </form>

        <form action={async () => {
          'use server';
          await signInWithGoogle(next);
        }}>
          <button
            type="submit"
            style={{ width: '100%', background: 'rgba(255, 255, 255, 0.08)', color: '#EDF2F6', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '8px', padding: '10px', fontSize: '14px', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          >
            <span>Continue with Google</span>
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '24px', fontSize: '13px', color: '#8E9BAE' }}>
          Already have an account?{' '}
          <Link href={`/login${next ? `?next=${encodeURIComponent(next)}` : ''}`} style={{ color: '#EDF2F6', fontWeight: 600 }}>
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
