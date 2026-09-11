import React from 'react';
import { AuthBackgroundEyelash } from '../../components/auth/AuthBackgroundEyelash';
import '../../components/auth/AuthLayout.css';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="auth-page-wrapper">
      <AuthBackgroundEyelash />
      {children}
    </div>
  );
}
