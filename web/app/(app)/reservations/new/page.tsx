'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { emptyGuestChoice, GuestChoice, GuestPicker } from '@/components/reservations/GuestPicker';
import { StayFields, StayValue } from '@/components/reservations/StayFields';
import { Button, ErrorNote, Field, fieldClass } from '@/components/ui';
import { api, newIdempotencyKey } from '@/lib/api';
import { addDays, nightsBetween } from '@/lib/dates';
import { useRes } from '@/lib/lang-context';
import { splitProblem } from '@/lib/problem';
import type { Channel, Guest, Reservation } from '@/lib/types';
import { useMe } from '../../shell';

const CHANNELS: Channel[] = ['direct', 'phone', 'web', 'agency', 'ota'];

export default function NewReservationPage() {
  const r = useRes();
  const router = useRouter();
  const qc = useQueryClient();
  const me = useMe();
  const today = me.data?.hotel.today;
  const [stay, setStay] = useState<StayValue | null>(null);
  // Dates par défaut : aujourd'hui et demain, selon le calendrier de l'hôtel.
  useEffect(() => {
    if (today && !stay) {
      setStay({ arrivalDate: today, departureDate: addDays(today, 1), adults: 2, children: 0, board: 'room_only', roomTypeId: null });
    }
  }, [today, stay]);
  const [guest, setGuest] = useState<GuestChoice>(emptyGuestChoice);
  // Depuis la fiche client (?guestId=…) : le client est présélectionné.
  useEffect(() => {
    const guestId = new URLSearchParams(window.location.search).get('guestId');
    if (!guestId) return;
    api<Guest>(`/guests/${guestId}`)
      .then(({ data }) => { if (!data.erased) setGuest((cur) => (cur.existing ? cur : { ...cur, existing: data })); })
      .catch(() => {});
  }, []);
  const [channel, setChannel] = useState<Channel>('phone');
  const [notes, setNotes] = useState('');
  // Une clé par formulaire : un double envoi ne crée jamais deux réservations.
  const [idemKey] = useState(newIdempotencyKey);
  const [localErrors, setLocalErrors] = useState<Record<string, string>>({});

  const create = useMutation({
    mutationFn: () => {
      if (!stay) throw new Error('stay');
      const body: Record<string, unknown> = {
        roomTypeId: stay.roomTypeId,
        arrivalDate: stay.arrivalDate,
        departureDate: stay.departureDate,
        adults: stay.adults,
        children: stay.children,
        board: stay.board,
        channel,
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      };
      if (guest.existing) body.guestId = guest.existing.id;
      else {
        const d = guest.draft;
        body.guest = {
          firstName: d.firstName.trim(),
          lastName: d.lastName.trim(),
          ...(d.email.trim() ? { email: d.email.trim() } : {}),
          ...(d.phone.trim() ? { phone: d.phone.trim() } : {}),
        };
      }
      return api<Reservation>('/reservations', { method: 'POST', json: body, headers: { 'Idempotency-Key': idemKey } });
    },
    onSuccess: ({ data }) => {
      qc.invalidateQueries({ queryKey: ['reservations'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      router.push(`/reservations/${data.id}`);
    },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!stay) return;
    const errs: Record<string, string> = {};
    if (nightsBetween(stay.arrivalDate, stay.departureDate) < 1) errs.departureDate = r.datesInvalid;
    if (!stay.roomTypeId) errs.roomTypeId = r.pickRoomType;
    if (!guest.existing && (!guest.draft.firstName.trim() || !guest.draft.lastName.trim())) errs.guest = r.pickGuest;
    setLocalErrors(errs);
    if (Object.keys(errs).length === 0) create.mutate();
  };

  const server = splitProblem(create.error);
  const errors = { ...server.fields, ...localErrors };

  return (
    <form onSubmit={submit} className="max-w-3xl space-y-10" noValidate>
      <header>
        <Link href="/reservations" className="text-[14px] text-ink-soft hover:text-ink">{r.back}</Link>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">{r.newReservation}</h1>
      </header>

      <section aria-labelledby="stay-title" className="space-y-4">
        <h2 id="stay-title" className="text-lg font-semibold">{r.stayDetails}</h2>
        {stay ? <StayFields value={stay} onChange={setStay} errors={errors} /> : <div className="h-40 animate-pulse rounded-lg bg-line/40" />}
      </section>

      <section aria-labelledby="guest-title" className="space-y-4">
        <h2 id="guest-title" className="text-lg font-semibold">{r.guest}</h2>
        {errors.guest && <p className="text-[13px] text-maintenance">{errors.guest}</p>}
        <GuestPicker value={guest} onChange={setGuest} errors={errors} />
      </section>

      <section className="grid gap-4 sm:grid-cols-[14rem_1fr]">
        <Field label={r.channel}>
          <select className={fieldClass} value={channel} onChange={(e) => setChannel(e.target.value as Channel)}>
            {CHANNELS.map((c) => (
              <option key={c} value={c}>{r.channels[c]}</option>
            ))}
          </select>
        </Field>
        <Field label={r.notes} hint={r.notesHint} error={errors.notes}>
          <textarea className={`${fieldClass} min-h-[2.75rem]`} rows={2} maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </section>

      <ErrorNote>{server.message}</ErrorNote>

      <div className="flex flex-wrap gap-3 border-t border-line pt-6">
        <Button type="submit" disabled={create.isPending}>{create.isPending ? r.creating : r.create}</Button>
        <Link href="/reservations" className="inline-flex items-center px-4 py-2 text-ink-soft hover:text-ink">{r.discard}</Link>
      </div>
    </form>
  );
}
