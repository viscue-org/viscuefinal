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
});
