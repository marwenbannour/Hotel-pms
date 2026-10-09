'use client';

import { Bell, Download } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { downloadCsv } from '@/lib/csv';
import { useI18n } from '@/lib/lang-context';
import type { Dashboard } from '@/lib/types';
import { SEVERITY } from './TodayPanel';

const BUTTON = 'relative rounded-xl bg-surface p-2.5 ring-1 ring-line hover:bg-paper';

/** Cloche : nombre d'alertes du jour (« À traiter »), détaillées dans un menu. */
export function AlertsBell({ alerts }: { alerts: NonNullable<Dashboard['alerts']> }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        className={BUTTON}
        aria-label={`${t.toHandle} : ${alerts.length}`}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <Bell className="size-4 text-ink" aria-hidden />
        {alerts.length > 0 && (
          <span className="absolute -top-1.5 -end-1.5 flex min-w-5 items-center justify-center rounded-full bg-maintenance px-1 text-[11px] leading-5 font-semibold text-white" aria-hidden>
            {alerts.length}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute end-0 top-full z-20 mt-2 w-80 rounded-xl bg-surface p-4 shadow-lg ring-1 ring-line">
          <p className="mb-2 font-semibold text-ink">{t.toHandle}</p>
          {alerts.length === 0 ? (
            <p className="text-[14px] text-ink-soft">{t.nothingToHandle}</p>
          ) : (
            <ul className="space-y-3">
              {alerts.map((a) => {
                const s = SEVERITY[a.severity];
                return (
                  <li key={`${a.type}-${a.message}`} className="flex gap-2.5 text-[14px] leading-5 text-ink">
                    <s.icon className={`mt-0.5 size-4 shrink-0 ${s.className}`} aria-hidden />
                    {a.message}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

/** Export des arrivées et départs du jour (liste de travail de la réception), en CSV. */
export function ExportMovements({ data }: { data: Dashboard }) {
  const { t } = useI18n();
  const mv = data.movements;
  if (!mv) return null;

  const exportCsv = () => {
    const head = ['type', 'reference', 'guest', 'status', 'room_type', 'room', 'adults', 'children', 'board', 'arrival_date', 'departure_date', 'notes'];
    const rows = [
      ...mv.arrivals.map((m) => ['arrival', m] as const),
      ...mv.departures.map((m) => ['departure', m] as const),
    ].map(([type, m]) => [type, m.reference, m.guestName, m.status, m.roomType, m.roomNumber, m.adults, m.children, m.board, m.arrivalDate, m.departureDate, m.notes]);
    downloadCsv(`mouvements-${data.date}.csv`, head, rows);
  };

  return (
    <button type="button" onClick={exportCsv} className="flex items-center gap-2 rounded-xl bg-navy px-3.5 py-2.5 text-[14px] font-medium text-white hover:bg-navy-700">
      <Download className="size-4" aria-hidden />
      {t.export}
    </button>
  );
}
