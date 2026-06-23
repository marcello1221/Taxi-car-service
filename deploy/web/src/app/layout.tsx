import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Taxi Car Service — Pre-Book Your Ride',
  description: 'Premium pre-book taxi service across the USA. Econom, Lux, and Lux SUV.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
