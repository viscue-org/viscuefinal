import Link from 'next/link';
import { redirect } from 'next/navigation';
import { signInWithPassword, signInWithGoogle } from '../../../features/auth/actions';

export default async function LoginPage(props: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const searchParams = await props.searchParams;
  const next = searchParams.next ?? '';
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
        <div className="auth-product-story">
          <h2>Get visual-first prompting</h2>
          <p>Show AI what you mean before you send</p>
        </div>
      </div>

      <h1 className="auth-title">Welcome back</h1>
      <p className="auth-subtitle">Sign in to continue to your Viscue account</p>

      {error && (
        <div role="alert" className="auth-alert-error">
          {error === 'auth_callback_failed'
            ? 'Authentication callback failed. Please try signing in again.'
            : error === 'oauth_failed'
            ? 'Google sign-in failed. Please try again.'
            : error}
        </div>
      )}

      <form
        action={async (formData: FormData) => {
          'use server';
          const res = await signInWithPassword(formData, next);
          if (res && !res.ok && res.error) {
            const redirectUrl = `/login?${new URLSearchParams({
              ...(next ? { next } : {}),
              error: res.error,
            }).toString()}`;
            redirect(redirectUrl);
          }
        }}
      >
        <div className="auth-field">
          <label htmlFor="login-email" className="auth-label">
            Email address
          </label>
          <input
            id="login-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="you@example.com"
            className="auth-input"
          />
        </div>

        <div className="auth-field">
          <div className="auth-field-row">
            <label htmlFor="login-password" className="auth-label" style={{ marginBottom: 0 }}>
              Password
            </label>
            <Link href="/forgot-password" className="auth-link-subtle">
              Forgot password?
            </Link>
          </div>
          <input
            id="login-password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            placeholder="••••••••••••"
            className="auth-input"
          />
        </div>

        <button type="submit" className="auth-btn-primary">
          Sign in
        </button>
      </form>

      <div className="auth-divider">
        <span>or</span>
      </div>

      <form
        action={async () => {
          'use server';
          await signInWithGoogle(next);
        }}
      >
        <button type="submit" className="auth-btn-oauth">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              fill="#EA4335"
            />
          </svg>
          <span>Continue with Google</span>
        </button>
      </form>

      <p className="auth-footer-nav">
        Don&apos;t have an account?{' '}
        <Link href={`/signup${next ? `?next=${encodeURIComponent(next)}` : ''}`}>
          Create account
        </Link>
      </p>
    </main>
  );
}
