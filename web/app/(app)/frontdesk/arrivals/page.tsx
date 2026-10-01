'use client';

import { Suspense } from 'react';
import { MovementsDay } from '@/components/reservations/MovementsDay';

export default function Page() {
  return (
    <Suspense fallback={<div className="h-48 animate-pulse rounded-lg bg-line/40" />}>
      <MovementsDay kind="arrivals" />
    </Suspense>
  );
}
