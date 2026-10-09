'use client';

import Link from 'next/link';
import { useState } from 'react';
import { BILLING } from '@/lib/i18n-billing';
import { useI18n } from '@/lib/lang-context';
import type { Movement } from '@/lib/types';
import { CARD, CardLink, CardTitle } from './card';
import { useStayAction } from './Movements';

type Kind = 'arrivals' | 'departures';

interface Props {
  arrivals: Movement[];
  departures: Movement[];
  canOperate: boolean;
  allowed: Set<string>;
}

/** Arrivées et départs du jour dans une même carte, en onglets ; l'action reste sur chaque ligne. */
export function MovementsTabs({ arrivals, departures, canOperate, allowed }: Props) {
  const { t } = useI18n();
  const [kind, setKind] = useState<Kind>('arrivals');
  const arrival = useStayAction('arrivals');
  const departure = useStayAction('departures');
  const tabs: { kind: Kind; label: string; rows: Movement[]; pending: number }[] = [
    { kind: 'arrivals', label: t.arrivals, rows: arrivals, pending: arrivals.filter(arrival.actionable).length },
    { kind: 'departures', label: t.departures, rows: departures, pending: departures.filter(departure.actionable).length },
  ];
  const current = tabs.find((x) => x.kind === kind)!;

  return (
    <section aria-labelledby="movements-title" className={`${CARD} flex flex-col gap-4 p-5`}>
      <CardTitle id="movements-title">{t.movementsToday}</CardTitle>
      <div role="tablist" aria-labelledby="movements-title" className="grid grid-cols-2 border-b border-line">
        {tabs.map((tab) => {
          const selected = tab.kind === kind;
          return (
            <button
              key={tab.kind}
              id={`${tab.kind}-title`}
              role="tab"
              type="button"
              aria-selected={selected}
              aria-controls={`${tab.kind}-panel`}
              onClick={() => setKind(tab.kind)}
              className={`-mb-px border-b-2 px-2 pb-2.5 text-[14px] ${
                selected ? 'border-gold font-semibold text-ink' : 'border-transparent text-ink-soft hover:text-ink'
              }`}
            >
              {/* « à traiter / total », comme sur l'écran de la réception. */}
              {tab.label} <span className="font-normal text-ink-soft">{tab.pending}/{tab.rows.length}</span>
            </button>
          );
        })}
      </div>

      <div id={`${kind}-panel`} role="tabpanel" aria-labelledby={`${kind}-title`} className="flex-1">
        <MovementList kind={kind} rows={current.rows} canOperate={canOperate} stay={kind === 'arrivals' ? arrival : departure} />
      </div>

      <CardLink href={kind === 'arrivals' ? '/frontdesk/arrivals' : '/frontdesk/departures'} allowed={allowed}>
        {kind === 'arrivals' ? t.seeArrivals : t.seeDepartures}
      </CardLink>
    </section>
  );
}

function MovementList({ kind, rows, canOperate, stay }: { kind: Kind; rows: Movement[]; canOperate: boolean; stay: ReturnType<typeof useStayAction> }) {
  const { lang, t } = useI18n();
  if (rows.length === 0) return <p className="py-6 text-ink-soft">{kind === 'arrivals' ? t.noArrivals : t.noDepartures}</p>;

  return (
    <ul className="divide-y divide-line">
      {rows.map((m) => (
        <li key={m.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3">
          <div className="min-w-0 flex-1">
            <Link href={`/reservations/${m.id}`} className="font-medium underline-offset-4 hover:underline">{m.guestName}</Link>
            <p className="text-[13px] text-ink-soft">
              {m.roomType} · <span dir="ltr">{m.reference}</span> · {t.guests} {m.adults + m.children}
            </p>
            {stay.errors[m.id] && (
              <p role="alert" className="mt-1 text-[13px] text-maintenance">
                {stay.errors[m.id]}{' '}
                <Link href={`/reservations/${m.id}#billing-title`} className="font-medium underline underline-offset-2">
                  {BILLING[lang].billing}
                </Link>
              </p>
            )}
          </div>
          <span
            className={`min-w-11 rounded-md px-2 py-1 text-center text-[13px] font-semibold ${
              m.roomNumber ? 'bg-available-soft text-available-text' : 'bg-paper text-ink-faint'
            }`}
            title={t.room}
          >
            {m.roomNumber ?? '–'}
          </span>
          {canOperate && stay.actionable(m) ? (
            <button
              type="button"
              onClick={() => stay.run.mutate(m)}
              disabled={stay.run.isPending && stay.run.variables?.id === m.id}
              className="rounded-lg bg-navy px-3 py-1.5 text-[13px] font-medium whitespace-nowrap text-white hover:bg-navy-700 disabled:opacity-60"
            >
              {kind === 'arrivals' ? t.checkIn : t.checkOut}
            </button>
          ) : (
            <span className="text-[13px] text-ink-soft">{stay.statusLabel(m)}</span>
          )}
        </li>
      ))}
    </ul>
  );
}
