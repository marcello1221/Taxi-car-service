'use client';

import dynamic from 'next/dynamic';

const OwnerPortal = dynamic(() => import('@/components/OwnerPortal'), { ssr: false });

export default function OwnerPage() {
  return <OwnerPortal />;
}
