'use client';

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useRef, useState } from 'react';
import { draftFromGuest, GuestDraft, GuestForm, guestBody, useGuestsDict } from '@/components/guests/GuestForm';
import { StatusBadge } from '@/components/reservations/StatusBadge';
import { Button, ErrorNote, Field, fieldClass } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useI18n } from '@/lib/lang-context';
import { splitProblem } from '@/lib/problem';
import type { Guest, GuestStay, Page } from '@/lib/types';
import { useMe } from '../../shell';

export default function GuestPage() {
  const { id } = useParams<{ id: string }>();
  const g = useGuestsDict();
  const me = useMe();
  const { f } = useI18n(me.data?.hotel.currency);
  const qc = useQueryClient();
  const can = (p: string) => !!me.data?.permissions.includes(p);
  const tz = me.data?.hotel.timezone;
  const [draft, setDraft] = useState<GuestDraft | null>(null);
  const [conflict, setConflict] = useState(false);
  const [confirmName, setConfirmName] = useState('');
  const eraseDialog = useRef<HTMLDialogElement>(null);

  const guest = useQuery({ queryKey: ['guest', id], queryFn: async () => (await api<Guest>(`/guests/${id}`)).data });
  const stays = useInfiniteQuery({
    queryKey: ['guest', id, 'stays'],
    queryFn: async ({ pageParam }) =>
      (await api<Page<GuestStay>>(`/guests/${id}/stays?limit=20${pageParam ? `&cursor=${pageParam}` : ''}`)).data,
    initialPageParam: '',
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: can('reservations:read'),
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['guest', id] });
    qc.invalidateQueries({ queryKey: ['guests'] });
  };

  const save = useMutation({
    mutationFn: () => {
      const cur = guest.data!;
      return api<Guest>(`/guests/${id}`, { method: 'PATCH', json: guestBody(draft!, cur), headers: { 'If-Match': `"${cur.version}"` } });
    },
    onSuccess: ({ data }) => {
      qc.setQueryData(['guest', id], data);
      setConflict(false);
      setDraft(null);
      refresh();
    },
    onError: (e) => {
      if (e instanceof ApiError && e.status === 412) {
        setConflict(true);
        setDraft(null);
        refresh();
      }
    },
  });

  const erase = useMutation({
    mutationFn: () => api<Guest>(`/guests/${id}/erase`, { method: 'POST', json: {} }),
    onSuccess: ({ data }) => {
      eraseDialog.current?.close();
      qc.setQueryData(['guest', id], data);
      refresh();
    },
  });

  if (guest.isError) {
    return <p role="alert" className="py-16 text-[17px]">{guest.error instanceof ApiError && guest.error.status === 404 ? g.notFound : g.loadError}</p>;
  }
  if (!guest.data) return <div className="h-96 animate-pulse rounded-lg bg-line/40" aria-busy="true" />;

  const d = guest.data;
  const name = `${d.firstName} ${d.lastName}`;
  const editable = !d.erased && can('guests:write');
  const saveErrors = splitProblem(save.isError && !(save.error instanceof ApiError && save.error.status === 412) ? save.error : null);
  const stayRows = stays.data?.pages.flatMap((p) => p.data) ?? [];

  const facts: [string, React.ReactNode][] = [
    [g.email, d.email ? <a dir="ltr" className="underline underline-offset-4" href={`mailto:${d.email}`}>{d.email}</a> : null],
    [g.phone, d.phone ? <a dir="ltr" className="underline underline-offset-4" href={`tel:${d.phone}`}>{d.phone}</a> : null],
    [g.nationality, d.nationality],
    [g.segment, g.segments[d.segment] ?? d.segment],
    [g.createdAt, d.createdAt ? f.instantDate(d.createdAt, tz) : null],
  ];

  return (
    <div className="max-w-5xl space-y-8">
      <header className="space-y-3">
        <Link href="/guests" className="text-[14px] text-ink-soft hover:text-ink">{g.back}</Link>
        <h1 className="text-3xl font-semibold tracking-tight">{name}</h1>
      </header>

      {conflict && <ErrorNote>{g.conflict}</ErrorNote>}
      {d.erased && <p className="rounded-md bg-line/50 px-3 py-2 text-ink-soft">{g.erased}</p>}

      {!draft && !d.erased && (
        <div className="flex flex-wrap gap-3">
          {can('reservations:write') && (
            <Link href={`/reservations/new?guestId=${d.id}`} className="inline-flex items-center gap-2 rounded-md bg-ink px-4 py-2 font-medium text-white hover:bg-ink/90">
              <Plus className="size-4" aria-hidden />
              {g.newReservation}
            </Link>
          )}
          {editable && (
            <Button variant="secondary" onClick={() => { setConflict(false); save.reset(); setDraft(draftFromGuest(d)); }}>
              {g.modify}
            </Button>
          )}
          {can('guests:erase') && (
            <Button variant="ghost" className="text-maintenance" onClick={() => { erase.reset(); setConfirmName(''); eraseDialog.current?.showModal(); }}>
              {g.erase}
            </Button>
          )}
        </div>
      )}

      {draft ? (
        <section className="space-y-6 rounded-lg bg-surface p-5 ring-1 ring-line">
          <GuestForm value={draft} onChange={setDraft} errors={saveErrors.fields} />
          <ErrorNote>{saveErrors.message}</ErrorNote>
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => save.mutate()} disabled={save.isPending || !draft.firstName.trim() || !draft.lastName.trim()}>
              {save.isPending ? g.saving : g.save}
            </Button>
            <Button variant="ghost" onClick={() => setDraft(null)}>{g.discard}</Button>
          </div>
        </section>
      ) : (
        !d.erased && (
          <section className="rounded-lg bg-surface ring-1 ring-line">
            <dl className="grid sm:grid-cols-2">
              {facts.map(([label, value]) => (
                <div key={label} className="border-b border-line px-5 py-3.5 last:border-0 sm:odd:border-e">
                  <dt className="text-[13px] text-ink-faint">{label}</dt>
                  <dd className="mt-0.5">{value ?? <span className="text-ink-soft">{g.none}</span>}</dd>
                </div>
              ))}
            </dl>
          </section>
        )
      )}

      {can('reservations:read') && (
        <section aria-labelledby="stays-title" className="space-y-3">
          <h2 id="stays-title" className="text-lg font-semibold">{g.stays}</h2>
          {stays.isError ? (
            <p role="alert" className="text-maintenance">{g.loadError}</p>
          ) : stays.isPending ? (
            <div className="h-32 animate-pulse rounded-lg bg-line/40" aria-busy="true" />
          ) : stayRows.length === 0 ? (
            <p className="text-ink-soft">{g.noStays}</p>
          ) : (
            <div className="overflow-x-auto rounded-lg bg-surface ring-1 ring-line">
              <table className="w-full min-w-[560px]">
                <thead>
                  <tr className="border-b border-line text-[13px] text-ink-faint">
                    <th scope="col" className="px-4 py-2.5 text-start font-normal">{g.reference}</th>
                    <th scope="col" className="px-3 py-2.5 text-start font-normal">{g.stay}</th>
                    <th scope="col" className="px-3 py-2.5 text-end font-normal">{g.amount}</th>
                    <th scope="col" className="px-4 py-2.5 text-start font-normal">{g.status}</th>
                  </tr>
                </thead>
                <tbody>
                  {stayRows.map((s) => (
                    <tr key={s.id} className="relative border-b border-line last:border-0 hover:bg-paper/70">
                      <td className="px-4 py-3">
                        <Link href={`/reservations/${s.id}`} dir="ltr" className="font-medium after:absolute after:inset-0 focus-visible:outline-none">
                          {s.reference}
                        </Link>
                      </td>
                      <td className="px-3 py-3">{f.shortDate(s.arrivalDate)} – {f.shortDate(s.departureDate)}</td>
                      <td className="px-3 py-3 text-end">{f.money(s.totalAmount)}</td>
                      <td className="px-4 py-3"><StatusBadge status={s.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {stays.hasNextPage && (
            <Button variant="secondary" onClick={() => stays.fetchNextPage()} disabled={stays.isFetchingNextPage}>{g.loadMore}</Button>
          )}
        </section>
      )}

      <dialog ref={eraseDialog} className="m-auto w-[min(30rem,calc(100vw-2rem))] rounded-lg p-0 backdrop:bg-ink/40">
        <form
          method="dialog"
          className="space-y-4 p-6"
          onSubmit={(e) => {
            e.preventDefault();
            if (confirmName.trim() === name) erase.mutate();
          }}
        >
          <h2 className="text-lg font-semibold">{g.eraseTitle}</h2>
          <p className="text-ink-soft">{g.eraseHelp}</p>
          <Field label={g.eraseConfirmLabel(name)}>
            <input className={fieldClass} value={confirmName} onChange={(e) => setConfirmName(e.target.value)} autoComplete="off" autoFocus />
          </Field>
          <ErrorNote>{splitProblem(erase.error).message}</ErrorNote>
          <div className="flex flex-wrap justify-end gap-3">
            <Button variant="ghost" onClick={() => eraseDialog.current?.close()}>{g.keep}</Button>
            <Button type="submit" variant="danger" disabled={confirmName.trim() !== name || erase.isPending}>{g.eraseConfirm}</Button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
