import Link from 'next/link';

export default function Home() {
  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div
        style={{
          maxWidth: '560px',
          width: '100%',
          background: 'rgba(255, 255, 255, 0.04)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '20.5px',
          padding: '40px',
          textAlign: 'center',
        }}
      >
        <div style={{ display: 'inline-block', background: 'rgba(91, 117, 147, 0.2)', border: '1px solid #5B7593', color: '#EDF2F6', padding: '6px 14px', borderRadius: '999px', fontSize: '13px', fontWeight: 600, marginBottom: '20px' }}>
          Local-First Visual Intent Compiler
        </div>
        <h1 style={{ fontSize: '36px', fontWeight: 800, color: '#EDF2F6', letterSpacing: '-0.02em', lineHeight: 1.2, marginBottom: '16px' }}>
          Make your intent visible
        </h1>
        <p style={{ color: '#8E9BAE', fontSize: '16px', lineHeight: 1.6, marginBottom: '28px' }}>
          Design, annotate, gesture, and direct multimodal AI models in real time. Projects stay on this device.
        </p>
        <Link
          href="/signup"
          style={{
            display: 'inline-block',
            background: '#5B7593',
            color: '#FFFFFF',
            padding: '12px 28px',
            borderRadius: '20.5px',
            fontSize: '15px',
            fontWeight: 600,
            textDecoration: 'none',
          }}
        >
          Get Started
        </Link>
      </div>
    </main>
  );
}
