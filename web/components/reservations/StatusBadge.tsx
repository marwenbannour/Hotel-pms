'use client';

import { useRes } from '@/lib/lang-context';
import type { ReservationStatus } from '@/lib/types';

const STYLE: Record<ReservationStatus, string> = {
  confirmed: 'text-ink ring-1 ring-ink/30',
  checked_in: 'bg-available text-white',
  checked_out: 'text-ink-soft ring-1 ring-line',
  cancelled: 'text-maintenance ring-1 ring-maintenance/40 line-through decoration-maintenance/40',
  no_show: 'text-maintenance ring-1 ring-maintenance/40',
};

export function StatusBadge({ status }: { status: ReservationStatus }) {
  const r = useRes();
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-[13px] leading-5 whitespace-nowrap ${STYLE[status]}`}>
      {r.statuses[status]}
    </span>
  );
}
