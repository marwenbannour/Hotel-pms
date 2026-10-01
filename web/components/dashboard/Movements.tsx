'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { BILLING } from '@/lib/i18n-billing';
import { useI18n } from '@/lib/lang-context';
import type { Movement } from '@/lib/types';

interface Props {
  kind: 'arrivals' | 'departures';
  rows: Movement[];
  canOperate: boolean;
}

export function Movements({ kind, rows, canOperate }: Props) {
  const { lang, t } = useI18n();
  const qc = useQueryClient();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const action = kind === 'arrivals' ? 'check-in' : 'check-out';
  const actionable = (m: Movement) => (kind === 'arrivals' ? m.status === 'confirmed' : m.status === 'checked_in');
  const pending = rows.filter(actionable).length;

  const run = useMutation({
    mutationFn: (m: Movement) => api(`/reservations/${m.id}/${action}`, { method: 'POST', json: {} }),
    onMutate: (m) => setErrors((e) => ({ ...e, [m.id]: '' })),
    onError: (e, m) => setErrors((prev) => ({ ...prev, [m.id]: e instanceof ApiError ? e.message : String(e) })),
    onSettled: (_d, _e, m) => {
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['rooms'] });
      qc.invalidateQueries({ queryKey: ['reservation', m.id] });
    },
  });

  const statusLabel = (m: Movement) =>
    m.status === 'confirmed' ? t.confirmed : m.status === 'checked_in' ? t.checkedIn : t.checkedOut;
  const title = kind === 'arrivals' ? t.arrivals : t.departures;

  return (
    <section aria-labelledby={`${kind}-title`} className="min-w-0">
      <h2 id={`${kind}-title`} className="mb-3 flex items-baseline gap-2 text-lg font-semibold tracking-tight">
        {title}
        <span className="text-[15px] font-normal text-ink-soft">
          {pending}/{rows.length}
        </span>
      </h2>
      {rows.length === 0 ? (
        <p className="rounded-lg bg-surface px-4 py-6 text-ink-soft ring-1 ring-line">
          {kind === 'arrivals' ? t.noArrivals : t.noDepartures}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg bg-surface ring-1 ring-line">
          <table className="w-full min-w-[520px] text-start">
            <thead>
              <tr className="border-b border-line text-[13px] text-ink-faint">
                <th scope="col" className="px-4 py-2.5 text-start font-normal">{t.guest}</th>
                <th scope="col" className="px-2 py-2.5 text-start font-normal">{t.roomType}</th>
                <th scope="col" className="px-2 py-2.5 text-start font-normal">{t.room}</th>
                <th scope="col" className="px-2 py-2.5 text-start font-normal">{t.guests}</th>
                <th scope="col" className="px-4 py-2.5 text-end font-normal"><span className="sr-only">Action</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.id} className="border-b border-line last:border-0 align-top">
                  <td className="px-4 py-3">
                    <Link href={`/reservations/${m.id}`} className="font-medium underline-offset-4 hover:underline">{m.guestName}</Link>
                    <span className="block text-[13px] text-ink-faint">
                      <span dir="ltr">{m.reference}</span>, {t.boards[m.board]}
                    </span>
                    {m.notes && <span className="mt-1 block text-[13px] text-ink-soft">{m.notes}</span>}
                    {errors[m.id] && (
                      <span role="alert" className="mt-1 block text-[13px] text-maintenance">
                        {errors[m.id]}{' '}
                        {/* Départ refusé pour solde dû : accès direct au compte du séjour. */}
                        <Link href={`/reservations/${m.id}#billing-title`} className="font-medium underline underline-offset-2">
                          {BILLING[lang].billing}
                        </Link>
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-3">{m.roomType}</td>
                  <td className="px-2 py-3 font-medium">{m.roomNumber ?? '–'}</td>
                  <td className="px-2 py-3">{m.adults + m.children}</td>
                  <td className="px-4 py-2.5 text-end">
                    {canOperate && actionable(m) ? (
                      <button
                        type="button"
                        onClick={() => run.mutate(m)}
                        disabled={run.isPending && run.variables?.id === m.id}
                        className="rounded-md bg-ink px-3 py-1.5 text-[14px] font-medium whitespace-nowrap text-white hover:bg-ink/90 disabled:opacity-60"
                      >
                        {kind === 'arrivals' ? t.checkIn : t.checkOut}
                      </button>
                    ) : (
                      <span className="text-[14px] text-ink-soft">{statusLabel(m)}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
