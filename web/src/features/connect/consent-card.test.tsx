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
        approveAction="/api/oauth/approve"
        denyUrl="https://abcdefghijklmnopabcdefghijklmnop.chromiumapp.org/oauth?error=access_denied"
      />
    );

    expect(screen.getByRole('heading', { name: /connect viscue/i })).toBeVisible();
    expect(screen.getByText(/witne@gmail\.com/i)).toBeVisible();
    expect(screen.getByText(/viscue chrome extension/i)).toBeVisible();
    expect(screen.getByRole('button', { name: /approve connection/i })).toBeVisible();
    expect(screen.getByRole('link', { name: /cancel/i })).toHaveAttribute(
      'href',
      expect.stringContaining('error=access_denied')
    );
  });
});
