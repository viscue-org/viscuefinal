import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Viscue — Make your intent visible',
  description: 'AI-assisted visual intent compiler for frontend engineering. Projects stay on your device.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
