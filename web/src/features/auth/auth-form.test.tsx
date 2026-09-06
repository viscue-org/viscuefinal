import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import VerifyPage from '../../app/(auth)/verify/page';
import ForgotPasswordPage from '../../app/(auth)/forgot-password/page';
import LoginPage from '../../app/(auth)/login/page';
import SignupPage from '../../app/(auth)/signup/page';

describe('Auth Forms Anti-Enumeration and Messaging', () => {
  it('uses the visual-first Viscue product story on the extension login page', async () => {
    const next = '/connect?authorization_id=authorization-123';
    const Component = await LoginPage({
      searchParams: Promise.resolve({ next }),
    });
    render(Component);

    expect(screen.getByRole('heading', { name: /get visual-first prompting/i })).toBeVisible();
    expect(screen.getByText(/show ai what you mean before you send/i)).toBeVisible();
    expect(screen.getByRole('heading', { name: /welcome back/i })).toBeVisible();
    expect(screen.getByRole('link', { name: /create account/i })).toHaveAttribute(
      'href',
      expect.stringContaining(encodeURIComponent(next))
    );
  });

  it('uses the same product shell and preserves the extension return path on signup', async () => {
    const next = '/connect?authorization_id=authorization-123';
    const Component = await SignupPage({
      searchParams: Promise.resolve({ next }),
    });
    render(Component);

    expect(screen.getByRole('heading', { name: /get visual-first prompting/i })).toBeVisible();
    expect(screen.getByRole('heading', { name: /create your account/i })).toBeVisible();
    expect(screen.getByText(/9 free cues every day/i)).toBeVisible();
    expect(screen.getByRole('link', { name: /sign in/i })).toHaveAttribute(
      'href',
      expect.stringContaining(encodeURIComponent(next))
    );
  });

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
