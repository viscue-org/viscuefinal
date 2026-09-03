import { updatePassword } from '../../../features/auth/actions';

export default async function UpdatePasswordPage(props: {
  searchParams: Promise<{ error?: string }>;
}) {
  const searchParams = await props.searchParams;
  const error = searchParams.error;

  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ width: '100%', maxWidth: '400px', background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '16px', padding: '32px' }}>
        <h1 style={{ fontSize: '26px', fontWeight: 700, marginBottom: '8px', textAlign: 'center' }}>Set New Password</h1>
        <p style={{ color: '#8E9BAE', fontSize: '14px', marginBottom: '24px', textAlign: 'center' }}>
          Choose a secure password of at least 12 characters
        </p>

        {error && (
          <div role="alert" style={{ background: 'rgba(255, 90, 54, 0.15)', border: '1px solid #FF5A36', color: '#FF7D60', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', marginBottom: '20px' }}>
            {error}
          </div>
        )}

        <form action={async (formData: FormData) => {
          'use server';
          await updatePassword(formData);
        }}>
          <div style={{ marginBottom: '20px' }}>
            <label htmlFor="update-password-input" style={{ display: 'block', fontSize: '13px', color: '#CBD5E1', marginBottom: '6px' }}>
              New password
            </label>
            <input
              id="update-password-input"
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
            style={{ width: '100%', background: '#5B7593', color: '#FFFFFF', border: 'none', borderRadius: '8px', padding: '12px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}
          >
            Update password
          </button>
        </form>
      </div>
    </main>
  );
}
