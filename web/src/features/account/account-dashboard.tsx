'use client';

import React, { useState } from 'react';
import type { AccountSummary } from '../../lib/account/types';

export interface AccountDashboardProps {
  summary: AccountSummary;
  userId: string;
}

export function AccountDashboard({ summary, userId }: AccountDashboardProps) {
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [loadingPortal, setLoadingPortal] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleCheckout = async (plan: 'plus' | 'pro') => {
    setLoadingPlan(plan);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      });

      const data = await res.json();
      if (!res.ok || !data.checkoutUrl) {
        throw new Error(data.error || 'Failed to start checkout');
      }

      window.location.assign(data.checkoutUrl);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Checkout failed');
      setLoadingPlan(null);
    }
  };

  const handleOpenPortal = async () => {
    setLoadingPortal(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/billing/portal', {
        method: 'POST',
      });

      const data = await res.json();
      if (!res.ok || !data.portalUrl) {
        throw new Error(data.error || 'Failed to open customer portal');
      }

      window.location.assign(data.portalUrl);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Portal access failed');
      setLoadingPortal(false);
    }
  };

  const planName =
    summary.plan === 'pro'
      ? 'Pro Tier'
      : summary.plan === 'plus'
      ? 'Plus Tier'
      : 'Free Tier';

  return (
    <div>
      {errorMessage && (
        <div
          role="alert"
          style={{
            background: 'rgba(255, 90, 54, 0.15)',
            border: '1px solid #FF5A36',
            color: '#FF7D60',
            padding: '12px 16px',
            borderRadius: '8px',
            fontSize: '14px',
            marginBottom: '20px',
          }}
        >
          {errorMessage}
        </div>
      )}

      <div
        style={{
          background: 'rgba(255, 255, 255, 0.04)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '16px',
          padding: '24px',
          marginBottom: '24px',
        }}
      >
        <div
          style={{
            fontSize: '12px',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: '#8E9BAE',
            marginBottom: '4px',
          }}
        >
          Connected Profile
        </div>
        <div
          style={{
            fontSize: '18px',
            fontWeight: 600,
            color: '#EDF2F6',
            marginBottom: '12px',
          }}
        >
          {summary.email}
        </div>
        <div style={{ fontSize: '13px', color: '#8E9BAE' }}>
          User ID: <code style={{ color: '#CBD5E1' }}>{userId}</code>
        </div>
      </div>

      <div
        style={{
          background: 'rgba(91, 117, 147, 0.15)',
          border: '1px solid #5B7593',
          borderRadius: '16px',
          padding: '24px',
          marginBottom: '24px',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px',
          }}
        >
          <div>
            <div
              style={{
                fontSize: '12px',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: '#A5C2DE',
                fontWeight: 700,
              }}
            >
              Active Plan
            </div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#EDF2F6' }}>
              {planName}
            </div>
          </div>
          <div style={{ fontSize: '32px', fontWeight: 800, color: '#EDF2F6' }}>
            {summary.remaining} / {summary.allowance}
          </div>
        </div>

        <p style={{ fontSize: '14px', color: '#CBD5E1', marginBottom: '20px' }}>
          Daily quota resets at 00:00 UTC. Your project files and gesture recordings
          remain strictly on your local device.
        </p>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {summary.plan === 'free' && (
            <>
              <button
                type="button"
                onClick={() => handleCheckout('plus')}
                disabled={Boolean(loadingPlan)}
                style={{
                  background: '#5B7593',
                  color: '#FFFFFF',
                  padding: '10px 18px',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                  opacity: loadingPlan === 'plus' ? 0.7 : 1,
                }}
              >
                {loadingPlan === 'plus' ? 'Opening checkout...' : 'Upgrade to Plus ($4.90/mo)'}
              </button>

              <button
                type="button"
                onClick={() => handleCheckout('pro')}
                disabled={Boolean(loadingPlan)}
                style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  color: '#EDF2F6',
                  padding: '10px 18px',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 600,
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  cursor: 'pointer',
                  opacity: loadingPlan === 'pro' ? 0.7 : 1,
                }}
              >
                {loadingPlan === 'pro' ? 'Opening checkout...' : 'Upgrade to Pro ($9.00/mo)'}
              </button>
            </>
          )}

          {summary.plan !== 'free' && (
            <button
              type="button"
              onClick={handleOpenPortal}
              disabled={loadingPortal}
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                color: '#EDF2F6',
                padding: '10px 18px',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 600,
                border: '1px solid rgba(255, 255, 255, 0.2)',
                cursor: 'pointer',
              }}
            >
              {loadingPortal ? 'Opening portal...' : 'Manage Subscription & Invoices'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
