import Link from 'next/link';

export default function PrivacyPage() {
  return (
    <main style={{ minHeight: '100vh', padding: '60px 0' }}>
      <div className="container" style={{ maxWidth: '780px' }}>
        <Link href="/" style={{ color: '#8E9BAE', fontSize: '14px', display: 'inline-block', marginBottom: '32px' }}>
          &larr; Back to Viscue
        </Link>
        <h1 style={{ fontSize: '40px', fontWeight: 800, marginBottom: '24px' }}>Privacy Policy</h1>
        <p style={{ color: '#8E9BAE', fontSize: '15px', marginBottom: '32px' }}>
          Last updated: September 3, 2026
        </p>

        <section style={{ marginBottom: '32px', lineHeight: '1.7', color: '#CBD5E1' }}>
          <p>
            Viscue takes your privacy seriously. We store only the minimum required information to provide our services.
          </p>
        </section>
      </div>
    </main>
  );
}
