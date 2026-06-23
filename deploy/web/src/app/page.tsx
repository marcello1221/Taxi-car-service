'use client';

import dynamic from 'next/dynamic';

const BookingApp = dynamic(() => import('@/components/BookingApp'), { ssr: false });

export default function HomePage() {
  return <BookingApp />;
}
