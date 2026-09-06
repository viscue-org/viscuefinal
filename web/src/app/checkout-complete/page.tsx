export default function CheckoutCompletePage() {
  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ maxWidth: '480px', background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '24px', padding: '40px', textAlign: 'center' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#EDF2F6', marginBottom: '16px' }}>
          Checkout Complete!
        </h1>
        <p style={{ color: '#8E9BAE', fontSize: '15px', lineHeight: 1.6, marginBottom: '24px' }}>
          Your subscription has been successfully updated.
        </p>
        <p style={{ color: '#8E9BAE', fontSize: '15px', lineHeight: 1.6, marginBottom: '32px' }}>
          You can safely close this browser tab and return to the Viscue Chrome Extension.
        </p>
      </div>
    </main>
  );
}
