import Link from 'next/link';

export default function VerifyPage() {
  return (
    <main className="auth-card-container" style={{ textAlign: 'center' }}>
      <div className="auth-brand-badge">
        <div className="auth-brand-logo-wrap" aria-hidden="true">
          <svg width="28" height="28" viewBox="0 0 100 100" fill="none" stroke="#FFFFFF" strokeWidth="8.2" strokeLinecap="round">
            <path d="M 79.5 14 C 58 7.5, 14 26, 14 50" />
            <path d="M 14 50 C 14 74, 46 88, 77.5 78" />
            <line x1="56" y1="50" x2="84" y2="50" />
          </svg>
        </div>
      </div>

      <div
        style={{
          width: '60px',
          height: '60px',
          borderRadius: '50%',
          background: 'rgba(91, 117, 147, 0.2)',
          border: '1px solid #5B7593',
          color: '#EDF2F6',
          display: 'grid',
          placeItems: 'center',
          margin: '0 auto 20px',
          fontSize: '26px',
        }}
        aria-hidden="true"
      >
        ✉
      </div>

      <h1 className="auth-title">Check your email</h1>
      <p className="auth-subtitle" style={{ lineHeight: 1.6, marginBottom: '28px' }}>
        We sent a verification link to your inbox. Please click the link to activate your Viscue account and connect the extension.
      </p>

      <Link
        href="/login"
        className="auth-btn-primary"
        style={{ display: 'inline-block', width: 'auto', padding: '12px 28px', textDecoration: 'none' }}
      >
        Return to Sign in
      </Link>
    </main>
  );
}
