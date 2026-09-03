import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import VerifyPage from '../../app/(auth)/verify/page';
import ForgotPasswordPage from '../../app/(auth)/forgot-password/page';

describe('Auth Forms Anti-Enumeration and Messaging', () => {
  it('verify page displays generic check your email message without reflecting email address', () => {
    render(<VerifyPage />);
    expect(screen.getByRole('heading', { name: /check your email/i })).toBeVisible();
    expect(screen.getByText(/we sent a verification link to your inbox/i)).toBeVisible();
  });

  it('forgot-password page success state displays generic message without disclosing email existence', async () => {
    const Component = await ForgotPasswordPage({
      searchParams: Promise.resolve({ sent: 'true' }),
    });
    render(Component);
    expect(
      screen.getByText(/if an account exists for that email, a password reset link has been sent/i)
    ).toBeVisible();
  });
});
