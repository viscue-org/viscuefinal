import Link from 'next/link';

export default function TermsPage() {
  return (
    <main style={{ minHeight: '100vh', padding: '60px 0' }}>
      <div className="container" style={{ maxWidth: '780px' }}>
        <Link href="/" style={{ color: '#8E9BAE', fontSize: '14px', display: 'inline-block', marginBottom: '32px' }}>
          &larr; Back to Viscue
        </Link>
        <h1 style={{ fontSize: '40px', fontWeight: 800, marginBottom: '24px' }}>Terms of Service</h1>
        <p style={{ color: '#8E9BAE', fontSize: '15px', marginBottom: '32px' }}>
          Last updated: September 3, 2026
        </p>

        <section style={{ marginBottom: '32px', lineHeight: '1.7', color: '#CBD5E1' }}>
          <h2 style={{ fontSize: '22px', fontWeight: 700, color: '#EDF2F6', marginBottom: '12px' }}>1. Service Overview</h2>
          <p>
            Viscue provides a multimodal visual intent compiler delivered as a browser extension and supporting online services. By registering an account or subscribing to paid tiers, you agree to these Terms.
          </p>
        </section>

        <section style={{ marginBottom: '32px', lineHeight: '1.7', color: '#CBD5E1' }}>
          <h2 style={{ fontSize: '22px', fontWeight: 700, color: '#EDF2F6', marginBottom: '12px' }}>2. Subscription Tiers and Quotas</h2>
          <p>
            Viscue offers Free, Plus ($4.90/month), and Pro ($9.00/month) plans. Each tier provides a daily allowance of compilation cues (Free: 9, Plus: 28, Pro: 99). Quotas reset at 00:00 UTC daily. Unused cues do not roll over. Billing is processed securely through Dodo Payments.
          </p>
        </section>

        <section style={{ marginBottom: '32px', lineHeight: '1.7', color: '#CBD5E1' }}>
          <h2 style={{ fontSize: '22px', fontWeight: 700, color: '#EDF2F6', marginBottom: '12px' }}>3. Acceptable Use</h2>
          <p>
            You may not reverse-engineer the compilation API, bypass rate limits or quota boundaries, or use Viscue to transmit unlawful, infringing, or malicious content.
          </p>
        </section>
      </div>
    </main>
  );
}
