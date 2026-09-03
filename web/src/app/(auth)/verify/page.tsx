import Link from 'next/link';

export default function VerifyPage() {
  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ width: '100%', maxWidth: '440px', background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '16px', padding: '36px', textAlign: 'center' }}>
        <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(91, 117, 147, 0.2)', border: '1px solid #5B7593', color: '#EDF2F6', display: 'grid', placeItems: 'center', margin: '0 auto 20px', fontSize: '24px' }}>
          ✉
        </div>
        <h1 style={{ fontSize: '26px', fontWeight: 700, marginBottom: '12px' }}>Check your email</h1>
        <p style={{ color: '#8E9BAE', fontSize: '15px', lineHeight: 1.6, marginBottom: '28px' }}>
          We sent a verification link to your inbox. Please click the link to activate your Viscue account and connect the extension.
        </p>
        <Link
          href="/login"
          style={{ display: 'inline-block', background: '#5B7593', color: '#FFFFFF', padding: '12px 24px', borderRadius: '8px', fontSize: '14px', fontWeight: 600 }}
        >
          Return to Sign in
        </Link>
      </div>
    </main>
  );
}
