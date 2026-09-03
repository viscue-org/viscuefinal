import Link from 'next/link';

export default function Home() {
  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', padding: '20px 0' }}>
        <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#EDF2F6', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>Viscue</span>
          </div>
          <nav style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <Link href="/login" style={{ color: '#8E9BAE', fontSize: '14px', fontWeight: 500 }}>
              Sign In
            </Link>
            <Link href="/signup" style={{ background: '#5B7593', color: '#FFFFFF', padding: '8px 18px', borderRadius: '8px', fontSize: '14px', fontWeight: 600 }}>
              Get Started
            </Link>
            <Link href="/account" style={{ color: '#8E9BAE', fontSize: '14px', fontWeight: 500 }}>
              Account
            </Link>
          </nav>
        </div>
      </header>

      <section style={{ padding: '80px 0', textAlign: 'center' }}>
        <div className="container">
          <div style={{ display: 'inline-block', background: 'rgba(91, 117, 147, 0.2)', border: '1px solid #5B7593', color: '#EDF2F6', padding: '6px 14px', borderRadius: '999px', fontSize: '13px', fontWeight: 600, marginBottom: '24px' }}>
            Local-First Visual Intent Compiler
          </div>
          <h1 style={{ fontSize: '56px', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.15, marginBottom: '24px', maxWidth: '800px', margin: '0 auto 24px' }}>
            Make your intent visible
          </h1>
          <p style={{ fontSize: '20px', color: '#8E9BAE', maxWidth: '640px', margin: '0 auto 32px' }}>
            Design, annotate, gesture, and direct multimodal AI models in real time. Projects stay on this device.
          </p>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '16px' }}>
            <Link href="/signup" style={{ background: '#EDF2F6', color: '#0F1720', padding: '14px 28px', borderRadius: '10px', fontSize: '16px', fontWeight: 700 }}>
              Start for Free
            </Link>
            <Link href="/privacy" style={{ border: '1px solid rgba(255, 255, 255, 0.2)', color: '#EDF2F6', padding: '14px 28px', borderRadius: '10px', fontSize: '16px', fontWeight: 600 }}>
              Privacy &amp; Local Architecture
            </Link>
          </div>
        </div>
      </section>

      <section style={{ padding: '60px 0', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
        <div className="container">
          <h2 style={{ fontSize: '32px', fontWeight: 700, textAlign: 'center', marginBottom: '40px' }}>Simple, predictable plans</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
            {/* Free */}
            <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '16px', padding: '32px' }}>
              <h3 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>Free</h3>
              <div style={{ fontSize: '36px', fontWeight: 800, marginBottom: '16px' }}>$0 <span style={{ fontSize: '14px', color: '#8E9BAE', fontWeight: 400 }}>/ forever</span></div>
              <p style={{ color: '#8E9BAE', fontSize: '14px', marginBottom: '24px' }}>9 daily cues. Essential tools for individual developers.</p>
              <Link href="/signup" style={{ display: 'block', textAlign: 'center', background: 'rgba(255, 255, 255, 0.1)', color: '#EDF2F6', padding: '10px 0', borderRadius: '8px', fontSize: '14px', fontWeight: 600 }}>
                Get Started
              </Link>
            </div>

            {/* Plus */}
            <div style={{ background: 'rgba(91, 117, 147, 0.15)', border: '1px solid #5B7593', borderRadius: '16px', padding: '32px' }}>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#A5C2DE', fontWeight: 700, marginBottom: '4px' }}>Popular</div>
              <h3 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>Plus</h3>
              <div style={{ fontSize: '36px', fontWeight: 800, marginBottom: '16px' }}>$4.90 <span style={{ fontSize: '14px', color: '#8E9BAE', fontWeight: 400 }}>/ month</span></div>
              <p style={{ color: '#8E9BAE', fontSize: '14px', marginBottom: '24px' }}>28 daily cues. Dedicated compilation quota for active builders.</p>
              <Link href="/signup" style={{ display: 'block', textAlign: 'center', background: '#5B7593', color: '#FFFFFF', padding: '10px 0', borderRadius: '8px', fontSize: '14px', fontWeight: 600 }}>
                Upgrade to Plus
              </Link>
            </div>

            {/* Pro */}
            <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '16px', padding: '32px' }}>
              <h3 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>Pro</h3>
              <div style={{ fontSize: '36px', fontWeight: 800, marginBottom: '16px' }}>$9.00 <span style={{ fontSize: '14px', color: '#8E9BAE', fontWeight: 400 }}>/ month</span></div>
              <p style={{ color: '#8E9BAE', fontSize: '14px', marginBottom: '24px' }}>99 daily cues. High-capacity multimodal compilation for professionals.</p>
              <Link href="/signup" style={{ display: 'block', textAlign: 'center', background: 'rgba(255, 255, 255, 0.1)', color: '#EDF2F6', padding: '10px 0', borderRadius: '8px', fontSize: '14px', fontWeight: 600 }}>
                Upgrade to Pro
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer style={{ marginTop: 'auto', borderTop: '1px solid rgba(255, 255, 255, 0.08)', padding: '32px 0' }}>
        <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#8E9BAE', fontSize: '13px' }}>
          <div>&copy; {new Date().getFullYear()} Viscue. All rights reserved.</div>
          <div style={{ display: 'flex', gap: '20px' }}>
            <Link href="/privacy">Privacy Policy</Link>
            <Link href="/terms">Terms of Service</Link>
            <Link href="/account">Account</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
