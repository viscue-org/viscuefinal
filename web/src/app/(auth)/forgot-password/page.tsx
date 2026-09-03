import Link from 'next/link';
import { requestPasswordReset } from '../../../features/auth/actions';

export default async function ForgotPasswordPage(props: {
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  const searchParams = await props.searchParams;
  const sent = searchParams.sent === 'true';
  const error = searchParams.error;

  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ width: '100%', maxWidth: '400px', background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '16px', padding: '32px' }}>
        <h1 style={{ fontSize: '26px', fontWeight: 700, marginBottom: '8px', textAlign: 'center' }}>Reset Password</h1>
        <p style={{ color: '#8E9BAE', fontSize: '14px', marginBottom: '24px', textAlign: 'center' }}>
          Enter your email to receive a password reset link
        </p>

        {sent ? (
          <div role="status" style={{ background: 'rgba(91, 117, 147, 0.2)', border: '1px solid #5B7593', color: '#EDF2F6', padding: '16px', borderRadius: '8px', fontSize: '14px', lineHeight: 1.5, textAlign: 'center' }}>
            If an account exists for that email, a password reset link has been sent.
            <div style={{ marginTop: '16px' }}>
              <Link href="/login" style={{ color: '#EDF2F6', fontWeight: 600 }}>
                Return to Sign in
              </Link>
            </div>
          </div>
        ) : (
          <form action={async (formData: FormData) => {
            'use server';
            await requestPasswordReset(formData);
          }}>
            {error && (
              <div role="alert" style={{ background: 'rgba(255, 90, 54, 0.15)', border: '1px solid #FF5A36', color: '#FF7D60', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', marginBottom: '20px' }}>
                {error}
              </div>
            )}

            <div style={{ marginBottom: '20px' }}>
              <label htmlFor="reset-email" style={{ display: 'block', fontSize: '13px', color: '#CBD5E1', marginBottom: '6px' }}>
                Email address
              </label>
              <input
                id="reset-email"
                name="email"
                type="email"
                autoComplete="email"
                required
                style={{ width: '100%', background: 'rgba(0, 0, 0, 0.2)', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '8px', padding: '10px 12px', color: '#EDF2F6', fontSize: '14px' }}
              />
            </div>

            <button
              type="submit"
              style={{ width: '100%', background: '#5B7593', color: '#FFFFFF', border: 'none', borderRadius: '8px', padding: '12px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', marginBottom: '16px' }}
            >
              Send reset link
            </button>

            <p style={{ textAlign: 'center', fontSize: '13px', color: '#8E9BAE' }}>
              Remember your password?{' '}
              <Link href="/login" style={{ color: '#EDF2F6', fontWeight: 600 }}>
                Sign in
              </Link>
            </p>
          </form>
        )}
      </div>
    </main>
  );
}
