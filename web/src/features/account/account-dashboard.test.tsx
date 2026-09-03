import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AccountDashboard } from './account-dashboard';

describe('AccountDashboard', () => {
  it('renders free plan with upgrade buttons and remaining cues', () => {
    render(
      <AccountDashboard
        userId="user-uuid-123"
        summary={{
          email: 'witne@gmail.com',
          plan: 'free',
          allowance: 9,
          consumed: 3,
          reserved: 0,
          remaining: 6,
          resetsAt: '2026-09-04T00:00:00Z',
          subscriptionStatus: null,
        }}
      />
    );

    expect(screen.getByText('witne@gmail.com')).toBeVisible();
    expect(screen.getByText('Free Tier')).toBeVisible();
    expect(screen.getByText('6 / 9')).toBeVisible();
    expect(screen.getByRole('button', { name: /upgrade to plus/i })).toBeVisible();
    expect(screen.getByRole('button', { name: /upgrade to pro/i })).toBeVisible();
  });

  it('renders paid plan with manage portal button', () => {
    render(
      <AccountDashboard
        userId="user-uuid-123"
        summary={{
          email: 'witne@gmail.com',
          plan: 'plus',
          allowance: 28,
          consumed: 5,
          reserved: 0,
          remaining: 23,
          resetsAt: '2026-09-04T00:00:00Z',
          subscriptionStatus: 'active',
        }}
      />
    );

    expect(screen.getByText('Plus Tier')).toBeVisible();
    expect(screen.getByText('23 / 28')).toBeVisible();
    expect(
      screen.getByRole('button', { name: /manage subscription/i })
    ).toBeVisible();
  });
});
