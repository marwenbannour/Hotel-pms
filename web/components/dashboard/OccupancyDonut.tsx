'use client';

import { useI18n } from '@/lib/lang-context';
import type { Dashboard, RoomStatus } from '@/lib/types';
import { CARD, CardLink, CardTitle } from './card';

/** Couleur pleine de chaque état, la même que les repères du tableau des chambres. */
const SEGMENTS: { status: RoomStatus; color: string; dot: string }[] = [
  { status: 'occupied', color: 'var(--color-occupied)', dot: 'bg-occupied' },
  { status: 'available', color: 'var(--color-available)', dot: 'bg-available' },
  { status: 'cleaning', color: 'var(--color-cleaning)', dot: 'bg-cleaning' },
  { status: 'maintenance', color: 'var(--color-maintenance)', dot: 'bg-maintenance' },
];

const R = 42;
const C = 2 * Math.PI * R;

/** Anneau de répartition des chambres par état, avec la légende chiffrée (lisible sans les couleurs). */
export function OccupancyDonut({ rooms, allowed }: { rooms: NonNullable<Dashboard['rooms']>; allowed: Set<string> }) {
  const { t, f } = useI18n();
  const total = rooms.total || SEGMENTS.reduce((s, x) => s + rooms[x.status], 0);
  let offset = 0;

  return (
    <section aria-labelledby="occupancy-title" className={`${CARD} flex flex-col gap-5 p-5`}>
      <CardTitle id="occupancy-title">{t.roomOccupancy}</CardTitle>
      <div className="flex flex-wrap items-center gap-6">
        <div className="relative size-36 shrink-0">
          <svg viewBox="0 0 100 100" className="size-full -rotate-90" aria-hidden>
            <circle cx="50" cy="50" r={R} fill="none" stroke="var(--color-line)" strokeWidth="14" />
            {total > 0 &&
              SEGMENTS.map(({ status, color }) => {
                const length = (rooms[status] / total) * C;
                const dash = (
                  <circle
                    key={status}
                    cx="50"
                    cy="50"
                    r={R}
                    fill="none"
                    stroke={color}
                    strokeWidth="14"
                    strokeDasharray={`${length} ${C - length}`}
                    strokeDashoffset={-offset}
                  />
                );
                offset += length;
                return dash;
              })}
          </svg>
          <p className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-display text-3xl leading-9 font-semibold">{total}</span>
            <span className="text-[13px] text-ink-soft">{t.total}</span>
          </p>
        </div>
        <ul className="min-w-48 flex-1 space-y-2.5 text-[14px]">
          {SEGMENTS.map(({ status, dot }) => (
            <li key={status} className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-x-2.5">
              <span className={`size-2.5 rounded-full ${dot}`} aria-hidden />
              <span className="whitespace-nowrap">{t.statuses[status]}</span>
              <span className="font-semibold">{rooms[status]}</span>
              <span className="w-12 text-end text-ink-soft">{f.percent(total ? (rooms[status] / total) * 100 : 0)}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="mt-auto">
        <CardLink href="/planning" allowed={allowed}>{t.seePlanning}</CardLink>
      </div>
    </section>
  );
}
