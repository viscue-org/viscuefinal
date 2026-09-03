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
          <h2 style={{ fontSize: '22px', fontWeight: 700, color: '#EDF2F6', marginBottom: '12px' }}>1. Local-First Project Architecture</h2>
          <p>
            Viscue is built on a local-first philosophy. Your workspace canvas, nodes, assets, annotations, recorded gestures, snapshots, and history logs are stored exclusively on your device using Chrome local extension storage. Projects stay on this device.
          </p>
        </section>

        <section style={{ marginBottom: '32px', lineHeight: '1.7', color: '#CBD5E1' }}>
          <h2 style={{ fontSize: '22px', fontWeight: 700, color: '#EDF2F6', marginBottom: '12px' }}>2. Transient Processing with Amazon Bedrock</h2>
          <p>
            When you invoke a cue compilation, the visual representations, gesture vectors, and prompt metadata necessary for compilation are sent over an encrypted HTTPS connection to our API gateway. The gateway routes transient inference requests to Amazon Bedrock. Under AWS contractual terms, input and output payloads are neither stored for training nor retained across sessions. Viscue maintains zero persistent project databases in the cloud.
          </p>
        </section>

        <section style={{ marginBottom: '32px', lineHeight: '1.7', color: '#CBD5E1' }}>
          <h2 style={{ fontSize: '22px', fontWeight: 700, color: '#EDF2F6', marginBottom: '12px' }}>3. Minimal Online Account &amp; Billing Records</h2>
          <p>
            To provide user authentication, quota enforcement, and subscription management, our cloud services (powered by Supabase and Dodo Payments) store only:
          </p>
          <ul style={{ marginLeft: '24px', marginTop: '12px', color: '#8E9BAE' }}>
            <li>Your authenticated email address and unique user ID.</li>
            <li>Your active subscription tier (Free, Plus, or Pro).</li>
            <li>Daily cue consumption and reservation totals for quota enforcement (reset at 00:00 UTC).</li>
            <li>Customer and transaction reference identifiers managed securely by Dodo Payments.</li>
          </ul>
        </section>
      </div>
    </main>
  );
}
