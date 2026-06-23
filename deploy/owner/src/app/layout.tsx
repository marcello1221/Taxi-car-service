import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Taxi Car Service — Owner Platform',
  description: 'Business reports, staff management, and company dashboard',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
