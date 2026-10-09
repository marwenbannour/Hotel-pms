'use client';

import { useQuery } from '@tanstack/react-query';
import { CalendarPlus, CalendarX } from 'lucide-react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { RES } from '@/lib/i18n-res';
import { useI18n } from '@/lib/lang-context';
import type { Page, Reservation } from '@/lib/types';
import { CARD, CardLink, CardTitle } from './card';

/** Dernières réservations enregistrées (toutes sources), les plus récentes d'abord. */
export function RecentActivity({ timeZone, allowed }: { timeZone?: string; allowed: Set<string> }) {
  const { lang, t, f } = useI18n();
  const r = RES[lang];
  const recent = useQuery({
    queryKey: ['reservations', 'recent'],
    queryFn: async () => (await api<Page<Reservation>>('/reservations?sort=-created_at&limit=6')).data.data,
    staleTime: 30_000,
  });

  return (
    <section aria-labelledby="activity-title" className={`${CARD} flex flex-col gap-4 p-5`}>
      <CardTitle id="activity-title">{t.recentActivity}</CardTitle>
      {!recent.data ? (
        <div className="h-36 animate-pulse rounded-xl bg-line/40" aria-busy="true" />
      ) : recent.data.length === 0 ? (
        <p className="text-ink-soft">{t.nothingToHandle}</p>
      ) : (
        <ul className="divide-y divide-line">
          {recent.data.map((res) => {
            const cancelled = res.status === 'cancelled' || res.status === 'no_show';
            const Icon = cancelled ? CalendarX : CalendarPlus;
            const guest = [res.guest.firstName, res.guest.lastName].filter(Boolean).join(' ');
            return (
              <li key={res.id} className="flex gap-3 py-2.5 first:pt-0">
                <span
                  className={`flex size-9 shrink-0 items-center justify-center rounded-full ${
                    cancelled ? 'bg-maintenance/10 text-maintenance' : 'bg-gold-soft text-brass'
                  }`}
                >
                  <Icon className="size-[18px]" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <Link href={`/reservations/${res.id}`} className="font-medium underline-offset-4 hover:underline">
                      {t.newReservation} <span dir="ltr">{res.reference}</span>
                    </Link>
                    <time dateTime={res.createdAt} className="text-[12px] text-ink-faint">{f.instant(res.createdAt, timeZone)}</time>
                  </p>
                  <p className="truncate text-[13px] text-ink-soft">
                    {guest} · {res.roomType.code ?? res.roomType.name} · {res.nights} {res.nights === 1 ? t.night : t.nights} · {f.dayMonth(res.arrivalDate)}
                    {cancelled && <span className="ms-2 font-medium text-maintenance">{r.statuses[res.status]}</span>}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <div className="mt-auto">
        <CardLink href="/reservations" allowed={allowed}>{t.seeReservations}</CardLink>
      </div>
    </section>
  );
}
