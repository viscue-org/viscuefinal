import { updatePassword } from '../../../features/auth/actions';

export default async function UpdatePasswordPage(props: {
  searchParams: Promise<{ error?: string }>;
}) {
  const searchParams = await props.searchParams;
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

      <h1 className="auth-title">Set New Password</h1>
      <p className="auth-subtitle">
        Choose a secure password of at least 12 characters
      </p>

      {error && (
        <div role="alert" className="auth-alert-error">
          {error}
        </div>
      )}

      <form
        action={async (formData: FormData) => {
          'use server';
          await updatePassword(formData);
        }}
      >
        <div className="auth-field">
          <label htmlFor="update-password-input" className="auth-label">
            New password
          </label>
          <input
            id="update-password-input"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={12}
            placeholder="••••••••••••"
            className="auth-input"
          />
        </div>

        <button type="submit" className="auth-btn-primary">
          Update password
        </button>
      </form>
    </main>
  );
}
