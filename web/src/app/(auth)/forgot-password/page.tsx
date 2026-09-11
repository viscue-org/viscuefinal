import Link from 'next/link';
import { requestPasswordReset } from '../../../features/auth/actions';

export default async function ForgotPasswordPage(props: {
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  const searchParams = await props.searchParams;
  const sent = searchParams.sent === 'true';
  const error = searchParams.error;

  return (
    <main className="auth-card-container">
      <div className="auth-brand-badge">
        <div className="auth-brand-logo-wrap" aria-hidden="true">
          <svg width="28" height="28" viewBox="0 0 100 100" fill="none" stroke="#FFFFFF" strokeWidth="8.2" strokeLinecap="round">
            <path d="M 79.5 14 C 58 7.5, 14 26, 14 50" />
            <path d="M 14 50 C 14 74, 46 88, 77.5 78" />
            <line x1="56" y1="50" x2="84" y2="50" />
          </svg>
        </div>
      </div>

      <h1 className="auth-title">Reset Password</h1>
      <p className="auth-subtitle">
        Enter your email to receive a password reset link
      </p>

      {sent ? (
        <div role="status" className="auth-alert-status">
          <p>If an account exists for that email, a password reset link has been sent.</p>
          <div style={{ marginTop: '18px' }}>
            <Link href="/login" className="auth-btn-primary" style={{ display: 'inline-block', textDecoration: 'none' }}>
              Return to Sign in
            </Link>
          </div>
        </div>
      ) : (
        <form
          action={async (formData: FormData) => {
            'use server';
            await requestPasswordReset(formData);
          }}
        >
          {error && (
            <div role="alert" className="auth-alert-error">
              {error}
            </div>
          )}

          <div className="auth-field">
            <label htmlFor="reset-email" className="auth-label">
              Email address
            </label>
            <input
              id="reset-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@example.com"
              className="auth-input"
            />
          </div>

          <button type="submit" className="auth-btn-primary">
            Send reset link
          </button>

          <p className="auth-footer-nav">
            Remember your password?{' '}
            <Link href="/login">
              Sign in
            </Link>
          </p>
        </form>
      )}
    </main>
  );
}
