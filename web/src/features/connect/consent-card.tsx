'use client';

import React, { useState } from 'react';

export interface ConsentCardProps {
  userEmail: string;
  clientName: string;
  scopes: string[];
  approveAction?: string | (() => Promise<void>) | ((formData: FormData) => void | Promise<void>);
  denyAction?: string | (() => Promise<void>) | ((formData: FormData) => void | Promise<void>);
  denyUrl?: string;
  switchAccountUrl?: string;
  hiddenParams?: Record<string, string>;
}

export function ConsentCard({
  userEmail,
  clientName,
  scopes,
  approveAction,
  denyAction,
  denyUrl,
  switchAccountUrl,
  hiddenParams,
}: ConsentCardProps) {
  const isApproveString = typeof approveAction === 'string';
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null);

  const handleApproveSubmit = async (e: React.FormEvent) => {
    if (!isApproveString) return;
    e.preventDefault();
    setIsConnecting(true);
    setError(null);

    try {
      const res = await fetch(approveAction, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(hiddenParams || {}),
      });

      if (res.status === 401) {
        window.location.href = '/login';
        return;
      }

      const data = await res.json();
      if (!res.ok || !data.ok || !data.redirectUrl) {
        throw new Error(data?.error || 'Failed to authorize extension');
      }

      setRedirectUrl(data.redirectUrl);
      window.location.assign(data.redirectUrl);
    } catch (err: any) {
      console.error('Connection approval error:', err);
      setError(err?.message || 'Connection failed. Please try again.');
      setIsConnecting(false);
    }
  };

  return (
    <div
      style={{
        width: '100%',
        maxWidth: '460px',
        background: 'rgba(255, 255, 255, 0.04)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '24px',
        padding: '32px',
      }}
    >
      <div
        style={{
          width: '52px',
          height: '52px',
          borderRadius: '14px',
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
      <p style={{ color: '#8E9BAE', fontSize: '14px', marginBottom: switchAccountUrl ? '8px' : '24px' }}>
        <strong>{clientName}</strong> wants to connect to your Viscue account (
        <span style={{ color: '#EDF2F6' }}>{userEmail}</span>).
      </p>

      {switchAccountUrl && (
        <div style={{ marginBottom: '20px' }}>
          <a
            href={switchAccountUrl}
            style={{
              color: '#FF7D60',
              fontSize: '13px',
              textDecoration: 'none',
              fontWeight: 500,
            }}
          >
            Not you? Switch account
          </a>
        </div>
      )}

      {error && (
        <div
          style={{
            background: 'rgba(255, 90, 54, 0.12)',
            border: '1px solid rgba(255, 90, 54, 0.4)',
            borderRadius: '14px',
            padding: '12px 16px',
            marginBottom: '20px',
            color: '#FF7D60',
            fontSize: '13px',
            lineHeight: 1.5,
          }}
        >
          {error}
        </div>
      )}

      {redirectUrl && (
        <div
          style={{
            background: 'rgba(91, 117, 147, 0.15)',
            border: '1px solid rgba(91, 117, 147, 0.4)',
            borderRadius: '14px',
            padding: '14px 16px',
            marginBottom: '20px',
            color: '#CBD5E1',
            fontSize: '13px',
            lineHeight: 1.5,
            textAlign: 'center',
          }}
        >
          Connecting to extension... If nothing happens,{' '}
          <a
            href={redirectUrl}
            style={{ color: '#FF7D60', textDecoration: 'underline', fontWeight: 600 }}
          >
            click here to complete connection
          </a>
          .
        </div>
      )}

      <div
        style={{
          background: 'rgba(0, 0, 0, 0.2)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '18px',
          padding: '16px',
          marginBottom: '24px',
        }}
      >
        <div
          style={{
            fontSize: '12px',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: '#8E9BAE',
            marginBottom: '8px',
            fontWeight: 600,
          }}
        >
          Requested Permissions
        </div>
        <ul
          style={{
            listStyle: 'none',
            padding: 0,
            margin: 0,
            fontSize: '13px',
            color: '#CBD5E1',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
          }}
        >
          <li>✓ Verify your account identity ({scopes.join(', ')})</li>
          <li>✓ Synchronize daily compilation quota</li>
          <li>✓ Zero access to local project files or device canvas</li>
        </ul>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {isApproveString ? (
          <form action={approveAction} method="POST" onSubmit={handleApproveSubmit}>
            {hiddenParams &&
              Object.entries(hiddenParams).map(([key, val]) => (
                <input key={key} type="hidden" name={key} value={val} />
              ))}
            <button
              type="submit"
              disabled={isConnecting}
              style={{
                width: '100%',
                background: isConnecting ? '#3A4C60' : '#5B7593',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '14px',
                padding: '12px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: isConnecting ? 'not-allowed' : 'pointer',
                opacity: isConnecting ? 0.8 : 1,
                transition: 'all 0.2s ease',
              }}
            >
              {isConnecting ? 'Connecting Extension...' : 'Connect Extension'}
            </button>
          </form>
        ) : (
          <form action={approveAction as any}>
            {hiddenParams &&
              Object.entries(hiddenParams).map(([key, val]) => (
                <input key={key} type="hidden" name={key} value={val} />
              ))}
            <button
              type="submit"
              style={{
                width: '100%',
                background: '#5B7593',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '14px',
                padding: '12px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Connect Extension
            </button>
          </form>
        )}

        {typeof denyAction === 'function' ? (
          <form action={denyAction as any}>
            <button
              type="submit"
              style={{
                width: '100%',
                background: 'transparent',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#8E9BAE',
                borderRadius: '14px',
                padding: '10px',
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </form>
        ) : (
          <a
            href={denyUrl || '#'}
            role="button"
            style={{
              display: 'block',
              textAlign: 'center',
              background: 'transparent',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: '#8E9BAE',
              borderRadius: '14px',
              padding: '10px',
              fontSize: '14px',
              fontWeight: 500,
              textDecoration: 'none',
            }}
          >
            Cancel
          </a>
        )}
      </div>
    </div>
  );
}

