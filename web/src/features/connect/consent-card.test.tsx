import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ConsentCard } from './consent-card';

describe('ConsentCard', () => {
  it('displays registered client name, user email, and requested permissions', () => {
    render(
      <ConsentCard
        userEmail="witne@gmail.com"
        clientName="Viscue Chrome Extension"
        scopes={['openid', 'email', 'profile']}
        approveAction={async () => {}}
        denyAction={async () => {}}
      />
    );

    expect(screen.getByRole('heading', { name: /connect viscue/i })).toBeVisible();
    expect(screen.getByText(/witne@gmail\.com/i)).toBeVisible();
    expect(screen.getByText(/viscue chrome extension/i)).toBeVisible();
    expect(screen.getByRole('button', { name: /connect extension/i })).toBeVisible();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeVisible();
  });

  it('renders switch account link when switchAccountUrl is provided', () => {
    render(
      <ConsentCard
        userEmail="connect.viscue@gmail.com"
        clientName="Viscue Chrome Extension"
        scopes={['openid']}
        approveAction="/api/auth/oauth/approve"
        denyUrl="https://example.com"
        switchAccountUrl="/api/auth/signout?next=%2Flogin"
      />
    );

    const switchLink = screen.getByRole('link', { name: /not you\? switch account/i });
    expect(switchLink).toBeVisible();
    expect(switchLink.getAttribute('href')).toBe('/api/auth/signout?next=%2Flogin');
  });
});
