import React from 'react';

export interface ConsentCardProps {
  userEmail: string;
  clientName: string;
  scopes: string[];
  approveAction: string;
  denyUrl: string;
}

export function ConsentCard({
  userEmail,
  clientName,
  scopes,
  approveAction,
  denyUrl,
}: ConsentCardProps) {
  return (
    <div
      style={{
        width: '100%',
        maxWidth: '460px',
        background: 'rgba(255, 255, 255, 0.04)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '16px',
        padding: '32px',
      }}
    >
      <div
        style={{
          width: '52px',
          height: '52px',
          borderRadius: '12px',
          background: '#5B7593',
          display: 'grid',
          placeItems: 'center',
          color: '#FFFFFF',
          fontSize: '22px',
          fontWeight: 'bold',
          marginBottom: '20px',
        }}
      >
        V
      </div>

      <h1 style={{ fontSize: '26px', fontWeight: 700, marginBottom: '8px' }}>
        Connect Viscue
      </h1>
      <p style={{ color: '#8E9BAE', fontSize: '14px', marginBottom: '24px' }}>
        <strong>{clientName}</strong> wants to connect to your Viscue account (
        <span style={{ color: '#EDF2F6' }}>{userEmail}</span>).
      </p>

      <div
        style={{
          background: 'rgba(0, 0, 0, 0.2)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '10px',
          padding: '16px',
          marginBottom: '24px',
        }}
      >
        <div style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#8E9BAE', marginBottom: '8px', fontWeight: 600 }}>
          Requested Permissions
        </div>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '13px', color: '#CBD5E1', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <li>✓ Verify your account identity ({scopes.join(', ')})</li>
          <li>✓ Synchronize daily compilation quota</li>
          <li>✓ Zero access to local project files or device canvas</li>
        </ul>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <form action={approveAction} method="POST">
          <button
            type="submit"
            style={{
              width: '100%',
              background: '#5B7593',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '8px',
              padding: '12px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Approve Connection
          </button>
        </form>

        <a
          href={denyUrl}
          style={{
            display: 'block',
            textAlign: 'center',
            background: 'transparent',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            color: '#8E9BAE',
            borderRadius: '8px',
            padding: '10px',
            fontSize: '14px',
            fontWeight: 500,
          }}
        >
          Cancel
        </a>
      </div>
    </div>
  );
}
