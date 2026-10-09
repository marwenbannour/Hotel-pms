'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { addDays } from '@/lib/dates';
import { RES } from '@/lib/i18n-res';
import { useI18n } from '@/lib/lang-context';
import type { Channel, Page, Reservation } from '@/lib/types';
import { CARD, CardLink, CardTitle } from './card';

const CHANNELS: { channel: Channel; color: string }[] = [
  { channel: 'direct', color: 'var(--color-navy)' },
  { channel: 'web', color: 'var(--color-info)' },
  { channel: 'ota', color: 'var(--color-available)' },
  { channel: 'agency', color: 'var(--color-cleaning)' },
  { channel: 'phone', color: 'var(--color-gold)' },
];

const R = 42;
const C = 2 * Math.PI * R;
/** Plafond de pages lues (200 réservations chacune) : largement assez pour un mois d'arrivées. */
const MAX_PAGES = 5;

/** Mois de la date de l'hôtel : premier et dernier jour. */
function monthOf(date: string) {
  const first = `${date.slice(0, 8)}01`;
  const [y, m] = date.split('-').map(Number);
  const nextFirst = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
  return { first, last: addDays(nextFirst, -1) };
}

/** Réservations arrivant ce mois-ci (annulations et no-shows exclus), réparties par canal de vente. */
export function ChannelChart({ date, allowed }: { date: string; allowed: Set<string> }) {
  const { lang, t, f } = useI18n();
  const r = RES[lang];
  const { first, last } = monthOf(date);

  const counts = useQuery({
    queryKey: ['reservations', 'by-channel', first],
    queryFn: async () => {
      const n: Record<Channel, number> = { direct: 0, web: 0, ota: 0, agency: 0, phone: 0 };
      let cursor: string | null = null;
      for (let page = 0; page < MAX_PAGES; page++) {
        const qs = new URLSearchParams({ arrival_from: first, arrival_to: last, status: 'confirmed,checked_in,checked_out', limit: '200' });
        if (cursor) qs.set('cursor', cursor);
        const { data } = await api<Page<Reservation>>(`/reservations?${qs}`);
        data.data.forEach((res) => (n[res.channel] += 1));
        cursor = data.nextCursor;
        if (!cursor) break;
      }
      return n;
    },
    staleTime: 60_000,
  });

  const total = counts.data ? Object.values(counts.data).reduce((s, v) => s + v, 0) : 0;
  let offset = 0;

  return (
    <section aria-labelledby="channels-title" className={`${CARD} flex flex-col gap-5 p-5`}>
      <div>
        <CardTitle id="channels-title">{t.byChannel}</CardTitle>
        <p className="text-[13px] text-ink-soft">{t.arrivalsOfMonth}</p>
      </div>
      {!counts.data ? (
        <div className="h-36 animate-pulse rounded-xl bg-line/40" aria-busy="true" />
      ) : (
        <div className="flex flex-wrap items-center gap-6">
          <div className="relative size-36 shrink-0">
            <svg viewBox="0 0 100 100" className="size-full -rotate-90" aria-hidden>
              <circle cx="50" cy="50" r={R} fill="none" stroke="var(--color-line)" strokeWidth="14" />
              {total > 0 &&
                CHANNELS.map(({ channel, color }) => {
                  const length = (counts.data[channel] / total) * C;
                  const arc = (
                    <circle key={channel} cx="50" cy="50" r={R} fill="none" stroke={color} strokeWidth="14"
                      strokeDasharray={`${length} ${C - length}`} strokeDashoffset={-offset} />
                  );
                  offset += length;
                  return arc;
                })}
            </svg>
            <p className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-display text-3xl leading-9 font-semibold">{total}</span>
              <span className="text-[13px] text-ink-soft">{t.total}</span>
            </p>
          </div>
          <ul className="min-w-48 flex-1 space-y-2.5 text-[14px]">
            {CHANNELS.map(({ channel, color }) => (
              <li key={channel} className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-x-2.5">
                <span className="size-2.5 rounded-full" style={{ background: color }} aria-hidden />
                <span className="whitespace-nowrap">{r.channels[channel]}</span>
                <span className="font-semibold">{counts.data[channel]}</span>
                <span className="w-12 text-end text-ink-soft">{f.percent(total ? (counts.data[channel] / total) * 100 : 0)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="mt-auto">
        <CardLink href="/reservations" allowed={allowed}>{t.seeReservations}</CardLink>
      </div>
    </section>
  );
}
