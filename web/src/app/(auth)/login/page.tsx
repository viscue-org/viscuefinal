import Link from 'next/link';
import { signInWithPassword, signInWithGoogle } from '../../../features/auth/actions';

export default async function LoginPage(props: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const searchParams = await props.searchParams;
  const next = searchParams.next ?? '';
  const error = searchParams.error;

  if (!next.startsWith('/connect')) {
    return (
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div style={{ maxWidth: '480px', background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '24px', padding: '40px', textAlign: 'center' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#EDF2F6', marginBottom: '16px' }}>
            Extension Required
          </h1>
          <p style={{ color: '#8E9BAE', fontSize: '15px', lineHeight: 1.6, marginBottom: '24px' }}>
            You can only sign in through the Viscue Chrome Extension. Please open the extension and click &quot;Start Viscue&quot; to authenticate.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ width: '100%', maxWidth: '420px', background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '24px', padding: '32px' }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <h2 style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#A5C2DE', fontWeight: 700, marginBottom: '6px' }}>
            Get visual-first prompting
          </h2>
          <p style={{ color: '#8E9BAE', fontSize: '14px', margin: 0 }}>
            Show AI what you mean before you send
          </p>
        </div>

        <h1 style={{ fontSize: '26px', fontWeight: 700, marginBottom: '8px', textAlign: 'center' }}>
          Welcome back
        </h1>
        <p style={{ color: '#8E9BAE', fontSize: '14px', marginBottom: '24px', textAlign: 'center' }}>
          Sign in to continue to your Viscue extension
        </p>

        {error && (
          <div role="alert" style={{ background: 'rgba(255, 90, 54, 0.15)', border: '1px solid #FF5A36', color: '#FF7D60', padding: '10px 14px', borderRadius: '18px', fontSize: '13px', marginBottom: '20px' }}>
            {error === 'auth_callback_failed'
              ? 'Authentication callback failed. Please try signing in again.'
              : 'Unable to authenticate. Please check your credentials.'}
          </div>
        )}

        <form action={async (formData: FormData) => {
          'use server';
          await signInWithPassword(formData, next);
        }}>
          <div style={{ marginBottom: '16px' }}>
            <label htmlFor="login-email" style={{ display: 'block', fontSize: '13px', color: '#CBD5E1', marginBottom: '6px' }}>
              Email address
            </label>
            <input
              id="login-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              style={{ width: '100%', background: 'rgba(0, 0, 0, 0.2)', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '10px', padding: '10px 12px', color: '#EDF2F6', fontSize: '14px' }}
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <label htmlFor="login-password" style={{ fontSize: '13px', color: '#CBD5E1' }}>
                Password
              </label>
              <Link href="/forgot-password" style={{ fontSize: '12px', color: '#8E9BAE' }}>
                Forgot password?
              </Link>
            </div>
            <input
              id="login-password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              style={{ width: '100%', background: 'rgba(0, 0, 0, 0.2)', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '10px', padding: '10px 12px', color: '#EDF2F6', fontSize: '14px' }}
            />
          </div>

          <button
            type="submit"
            style={{ width: '100%', background: '#5B7593', color: '#FFFFFF', border: 'none', borderRadius: '14px', padding: '12px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', marginBottom: '16px' }}
          >
            Sign in
          </button>
        </form>

        <form action={async () => {
          'use server';
          await signInWithGoogle(next);
        }}>
          <button
            type="submit"
            style={{ width: '100%', background: 'rgba(255, 255, 255, 0.08)', color: '#EDF2F6', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '14px', padding: '10px', fontSize: '14px', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          >
            <span>Continue with Google</span>
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '24px', fontSize: '13px', color: '#8E9BAE' }}>
          Don&apos;t have an account?{' '}
          <Link href={`/signup${next ? `?next=${encodeURIComponent(next)}` : ''}`} style={{ color: '#EDF2F6', fontWeight: 600 }}>
            Create account
          </Link>
        </p>
      </div>
    </main>
  );
}
