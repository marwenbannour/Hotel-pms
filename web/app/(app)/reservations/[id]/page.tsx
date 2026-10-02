'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useRef, useState } from 'react';
import { StatusBadge } from '@/components/reservations/StatusBadge';
import { StayFields, StayValue } from '@/components/reservations/StayFields';
import { Button, ErrorNote, Field, fieldClass } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { GUESTS } from '@/lib/i18n-guests';
import { useI18n, useRes } from '@/lib/lang-context';
import { splitProblem } from '@/lib/problem';
import type { Guest, HistoryEntry, Reservation } from '@/lib/types';
import { FolioPanel } from '@/components/billing/FolioPanel';
import { useMe } from '../../shell';

export default function ReservationPage() {
  const { id } = useParams<{ id: string }>();
  const { lang, t, f } = useI18n();
  const r = useRes();
  const qc = useQueryClient();
  const me = useMe();
  const can = (p: string) => !!me.data?.permissions.includes(p);
  const tz = me.data?.hotel.timezone;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<(StayValue & { notes: string }) | null>(null);
  const [conflict, setConflict] = useState(false);
  const [reason, setReason] = useState('');
  const cancelDialog = useRef<HTMLDialogElement>(null);

  const res = useQuery({ queryKey: ['reservation', id], queryFn: async () => (await api<Reservation>(`/reservations/${id}`)).data });
  const guest = useQuery({
    queryKey: ['guest', res.data?.guest.id],
    queryFn: async () => (await api<Guest>(`/guests/${res.data!.guest.id}`)).data,
    enabled: !!res.data && can('guests:read'),
  });
  const history = useQuery({
    queryKey: ['reservation', id, 'history'],
    queryFn: async () => (await api<{ data: HistoryEntry[] }>(`/reservations/${id}/history`)).data.data,
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['reservation', id] });
    qc.invalidateQueries({ queryKey: ['folio', id] });
    qc.invalidateQueries({ queryKey: ['reservations'] });
    qc.invalidateQueries({ queryKey: ['dashboard'] });
  };
  const onConflict = (e: unknown) => {
    if (e instanceof ApiError && e.status === 412) {
      setConflict(true);
      setEditing(false);
      refresh();
    }
  };

  const save = useMutation({
    mutationFn: () => {
      const cur = res.data!;
      const d = draft!;
      const body: Record<string, unknown> = {};
      if (d.arrivalDate !== cur.arrivalDate) body.arrivalDate = d.arrivalDate;
      if (d.departureDate !== cur.departureDate) body.departureDate = d.departureDate;
      if (d.adults !== cur.adults) body.adults = d.adults;
      if (d.children !== cur.children) body.children = d.children;
      if (d.board !== cur.board) body.board = d.board;
      if (d.roomTypeId !== cur.roomType.id) body.roomTypeId = d.roomTypeId;
      if (d.notes !== (cur.notes ?? '')) body.notes = d.notes;
      return api<Reservation>(`/reservations/${id}`, { method: 'PATCH', json: body, headers: { 'If-Match': `"${cur.version}"` } });
    },
    onSuccess: ({ data }) => {
      qc.setQueryData(['reservation', id], data);
      setConflict(false);
      setEditing(false);
      refresh();
    },
    onError: onConflict,
  });

  const cancel = useMutation({
    mutationFn: () => api<Reservation>(`/reservations/${id}/cancel`, { method: 'POST', json: { reason: reason.trim() } }),
    onSuccess: () => {
      cancelDialog.current?.close();
      setConflict(false);
      refresh();
    },
  });

  const frontdesk = useMutation({
    mutationFn: (action: 'check-in' | 'check-out') => api<Reservation>(`/reservations/${id}/${action}`, { method: 'POST', json: {} }),
    onSuccess: () => {
      setConflict(false);
      refresh();
    },
  });

  if (res.isError) {
    return <p role="alert" className="py-16 text-[17px]">{res.error instanceof ApiError && res.error.status === 404 ? r.noResults : t.loadError}</p>;
  }
  if (!res.data) return <div className="h-96 animate-pulse rounded-lg bg-line/40" aria-busy="true" />;

  const d = res.data;
  const name = `${d.guest.firstName ?? ''} ${d.guest.lastName ?? ''}`.trim();
  const startEdit = () => {
    setConflict(false);
    setDraft({
      arrivalDate: d.arrivalDate, departureDate: d.departureDate, adults: d.adults, children: d.children,
      board: d.board, roomTypeId: d.roomType.id, notes: d.notes ?? '',
    });
    setEditing(true);
  };
  const canEdit = d.status === 'confirmed' && can('reservations:write');
  const saveErrors = splitProblem(save.isError && !(save.error instanceof ApiError && save.error.status === 412) ? save.error : null);
  const actionError = splitProblem(frontdesk.error).message;

  const facts: [string, React.ReactNode][] = [
    [r.arrival, f.longDate(d.arrivalDate)],
    [r.departure, f.longDate(d.departureDate)],
    [r.stay, `${r.nightsCount(d.nights)}, ${t.boards[d.board]}`],
    [t.roomType, `${d.roomType.name} (${d.roomType.code})`],
    [r.room, d.room ? d.room.number : <span className="text-ink-soft">{r.notAssigned}</span>],
    [t.guests, `${d.adults} ${r.adults.toLowerCase()}${d.children ? `, ${d.children} ${r.children.toLowerCase()}` : ''}`],
    [r.channel, r.channels[d.channel]],
    [r.createdAt, f.instantDate(d.createdAt, tz)],
  ];

  return (
    <div className="max-w-5xl space-y-8">
      <header className="space-y-3">
        <Link href="/reservations" className="text-[14px] text-ink-soft hover:text-ink">{r.back}</Link>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">{name}</h1>
          <StatusBadge status={d.status} />
        </div>
        <p className="text-ink-soft">
          {r.reference} <span dir="ltr" className="font-medium text-ink">{d.reference}</span>
        </p>
      </header>

      {conflict && <ErrorNote>{r.conflict}</ErrorNote>}

      {!editing && (
        <div className="flex flex-wrap gap-3">
          {d.status === 'confirmed' && can('frontdesk:operate') && (
            <Button onClick={() => frontdesk.mutate('check-in')} disabled={frontdesk.isPending}>{t.checkIn}</Button>
          )}
          {d.status === 'checked_in' && can('frontdesk:operate') && (
            <Button onClick={() => frontdesk.mutate('check-out')} disabled={frontdesk.isPending}>{t.checkOut}</Button>
          )}
          {canEdit && <Button variant="secondary" onClick={startEdit}>{r.modify}</Button>}
          {canEdit && (
            <Button variant="ghost" className="text-maintenance" onClick={() => { cancel.reset(); setReason(''); cancelDialog.current?.showModal(); }}>
              {r.cancelReservation}
            </Button>
          )}
        </div>
      )}
      <ErrorNote>{actionError}</ErrorNote>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-8">
          {editing && draft ? (
            <section className="space-y-6 rounded-lg bg-surface p-5 ring-1 ring-line">
              <StayFields
                value={draft}
                onChange={(v) => setDraft({ ...draft, ...v })}
                excludeReservationId={d.id}
                currentRoomTypeId={d.roomType.id}
                errors={saveErrors.fields}
              />
              <Field label={r.notes} hint={r.notesHint}>
                <textarea className={fieldClass} rows={2} maxLength={2000} value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
              </Field>
              <ErrorNote>{saveErrors.message}</ErrorNote>
              <div className="flex flex-wrap gap-3">
                <Button onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? r.saving : r.saveChanges}</Button>
                <Button variant="ghost" onClick={() => setEditing(false)}>{r.discard}</Button>
              </div>
            </section>
          ) : (
            <section className="rounded-lg bg-surface ring-1 ring-line">
              <dl className="grid sm:grid-cols-2">
                {facts.map(([label, value]) => (
                  <div key={label} className="border-b border-line px-5 py-3.5 sm:odd:border-e">
                    <dt className="text-[13px] text-ink-faint">{label}</dt>
                    <dd className="mt-0.5 first-letter:uppercase">{value}</dd>
                  </div>
                ))}
              </dl>
              <div className="flex flex-wrap items-baseline justify-between gap-2 px-5 py-4">
                <span className="text-ink-soft">{r.total}</span>
                <span className={`text-2xl font-semibold ${d.status === 'cancelled' ? 'text-ink-faint line-through' : ''}`}>{f.money(d.totalAmount)}</span>
              </div>
              {d.notes && <p className="border-t border-line px-5 py-4 whitespace-pre-line">{d.notes}</p>}
              {d.status === 'cancelled' && d.cancelReason && (
                <p className="border-t border-line px-5 py-4 text-maintenance">
                  {r.cancelledOn} {d.cancelledAt ? f.instantDate(d.cancelledAt, tz) : ''} : {d.cancelReason}
                </p>
              )}
            </section>
          )}

          {can('billing:read') && <FolioPanel reservationId={d.id} status={d.status} can={can} />}

          <section aria-labelledby="history-title">
            <h2 id="history-title" className="mb-3 text-lg font-semibold">{r.history}</h2>
            <ol className="space-y-3 border-s border-line ps-5">
              {(history.data ?? []).map((h, i) => (
                <li key={i} className="relative">
                  <span className="absolute -start-[25px] top-2 size-2 rounded-full bg-ink" aria-hidden />
                  <p>{r.historyActions[h.action] ?? h.action}</p>
                  <p className="text-[13px] text-ink-faint">
                    {f.instant(h.at, tz)}
                    {h.actor?.name ? ` ${r.by} ${h.actor.name}` : ''}
                    {typeof h.data.reason === 'string' ? ` : ${h.data.reason}` : ''}
                  </p>
                </li>
              ))}
            </ol>
          </section>
        </div>

        {can('guests:read') && (
          <aside aria-labelledby="contact-title" className="h-fit rounded-lg bg-surface p-5 ring-1 ring-line">
            <h2 id="contact-title" className="font-semibold">{r.guestContact}</h2>
            {guest.data && (guest.data.email || guest.data.phone) ? (
              <ul className="mt-2 space-y-1 text-[14px]" dir="ltr">
                {guest.data.email && <li><a className="underline underline-offset-4" href={`mailto:${guest.data.email}`}>{guest.data.email}</a></li>}
                {guest.data.phone && <li><a className="underline underline-offset-4" href={`tel:${guest.data.phone}`}>{guest.data.phone}</a></li>}
              </ul>
            ) : (
              <p className="mt-2 text-[14px] text-ink-soft">{r.noContact}</p>
            )}
            <Link href={`/guests/${d.guest.id}`} className="mt-3 inline-block text-[14px] font-medium text-brass underline underline-offset-4">
              {GUESTS[lang].openFile}
            </Link>
          </aside>
        )}
      </div>

      <dialog ref={cancelDialog} className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-lg p-0 backdrop:bg-ink/40">
        <form
          method="dialog"
          className="space-y-4 p-6"
          onSubmit={(e) => {
            e.preventDefault();
            if (reason.trim()) cancel.mutate();
          }}
        >
          <h2 className="text-lg font-semibold">{r.cancelReservation}</h2>
          <p className="text-ink-soft">{name}, {f.shortDate(d.arrivalDate)} – {f.shortDate(d.departureDate)}</p>
          <Field label={r.cancelReason}>
            <textarea className={fieldClass} rows={3} required maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
          </Field>
          <ErrorNote>{splitProblem(cancel.error).message}</ErrorNote>
          <div className="flex flex-wrap justify-end gap-3">
            <Button variant="ghost" onClick={() => cancelDialog.current?.close()}>{r.keepReservation}</Button>
            <Button type="submit" variant="danger" disabled={!reason.trim() || cancel.isPending}>{r.confirmCancel}</Button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
