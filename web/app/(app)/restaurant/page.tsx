'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { Check, Minus, Plus } from 'lucide-react';
import { useState } from 'react';
import { Button, ErrorNote, Field, fieldClass } from '@/components/ui';
import { api } from '@/lib/api';
import { BILLING } from '@/lib/i18n-billing';
import { RESTAURANT } from '@/lib/i18n-restaurant';
import { useI18n } from '@/lib/lang-context';
import { useRefreshInterval } from '@/lib/live';
import { splitProblem } from '@/lib/problem';
import type { Page, Room } from '@/lib/types';
import { useMe } from '../shell';

/** Catégories proposées au restaurant ; les autres (spa, blanchisserie…) restent à la réception. */
const CATEGORIES = ['restaurant', 'bar', 'minibar'] as const;

/** « 12,50 » → 1250 ; NaN si la saisie n'est pas un montant. */
const toMinor = (v: string) => Math.round(parseFloat(v.replace(',', '.')) * 100);

interface Charged {
  room: string;
  label: string;
  total: number;
}

/**
 * Facturation à la chambre depuis le téléphone du restaurant : choisir une chambre occupée,
 * saisir la consommation, la porter sur le compte du séjour. La liste des chambres occupées suit
 * les arrivées et départs en direct.
 */
export default function RestaurantPage() {
  const { lang } = useI18n();
  const me = useMe();
  const { f } = useI18n(me.data?.hotel.currency);
  const r = RESTAURANT[lang];
  const b = BILLING[lang];
  const canCharge = !!me.data?.permissions.includes('billing:charge');
  const refetchInterval = useRefreshInterval(60_000);

  const [search, setSearch] = useState('');
  const [room, setRoom] = useState<Room | null>(null);
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>('restaurant');
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [price, setPrice] = useState('');
  const [done, setDone] = useState<Charged[]>([]);
  const [priceError, setPriceError] = useState(false);

  const rooms = useQuery({
    queryKey: ['rooms', 'occupied'],
    queryFn: async () => (await api<Page<Room>>('/rooms?status=occupied&limit=200&sort=number')).data.data,
    enabled: canCharge,
    refetchInterval,
  });

  const unit = toMinor(price);
  const total = Number.isFinite(unit) ? unit * quantity : 0;

  const charge = useMutation({
    mutationFn: (target: Room) =>
      api<{ reservationId: string; roomNumber: string }>(`/rooms/${target.id}/charges`, {
        method: 'POST',
        json: { category, description: description.trim() || b.categories[category], quantity, unitAmount: unit },
      }),
    onSuccess: ({ data }) => {
      setDone((list) => [{ room: data.roomNumber, label: `${quantity} × ${description.trim() || b.categories[category]}`, total }, ...list]);
      setRoom(null);
      setSearch('');
      setDescription('');
      setQuantity(1);
      setPrice('');
    },
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!room || charge.isPending) return;
    if (!Number.isFinite(unit) || unit <= 0) {
      setPriceError(true);
      return;
    }
    setPriceError(false);
    charge.mutate(room);
  };

  if (me.data && !canCharge) return <p className="max-w-md py-16 text-[17px]">{r.noAccess}</p>;

  const occupied = (rooms.data ?? []).filter((x) => x.number.toLowerCase().includes(search.trim().toLowerCase()));
  const error = splitProblem(charge.error);
  const last = done[0];

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{r.title}</h1>
        <p className="text-ink-soft">{r.intro}</p>
      </header>

      {last && !room && (
        <p role="status" className="flex items-center gap-2 rounded-md bg-available/10 px-3 py-2 text-available">
          <Check className="size-4 shrink-0" aria-hidden />
          {r.done(last.room, f.amount(last.total))}
        </p>
      )}

      {!room ? (
        <section aria-labelledby="room-step" className="space-y-4">
          <h2 id="room-step" className="text-[17px] font-semibold">{r.roomStep}</h2>
          <Field label={r.findRoom}>
            <input type="search" inputMode="numeric" value={search} onChange={(e) => setSearch(e.target.value)} className={fieldClass} />
          </Field>
          {rooms.isError ? (
            <div className="space-y-3">
              <ErrorNote>{r.loadError}</ErrorNote>
              <Button variant="secondary" onClick={() => rooms.refetch()}>{r.retry}</Button>
            </div>
          ) : rooms.isPending ? (
            <div className="h-32 animate-pulse rounded-lg bg-line/40" aria-busy="true" />
          ) : occupied.length === 0 ? (
            <p className="text-ink-soft">{rooms.data.length === 0 ? r.noOccupied : r.noMatch}</p>
          ) : (
            <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {occupied.map((x) => (
                <li key={x.id}>
                  <button
                    onClick={() => {
                      charge.reset();
                      setRoom(x);
                    }}
                    aria-label={r.room(x.number)}
                    className="flex min-h-16 w-full items-center justify-center rounded-lg bg-surface text-xl font-semibold ring-1 ring-line hover:ring-brass"
                  >
                    {x.number}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : (
        <form onSubmit={submit} className="space-y-5 rounded-lg bg-surface p-4 ring-1 ring-line sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">{r.room(room.number)}</h2>
            <Button variant="ghost" onClick={() => setRoom(null)}>{r.changeRoom}</Button>
          </div>

          <fieldset>
            <legend className="text-[14px] text-ink-soft">{b.category}</legend>
            <div className="mt-1 flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-pressed={category === c}
                  onClick={() => setCategory(c)}
                  className={`min-h-11 rounded-full px-4 ring-1 ${category === c ? 'bg-ink text-white ring-ink' : 'bg-surface ring-line'}`}
                >
                  {b.categories[c]}
                </button>
              ))}
            </div>
          </fieldset>

          <Field label={r.what} error={error.fields.description}>
            <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder={r.descriptionPlaceholder} maxLength={200} className={fieldClass} />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-[14px] text-ink-soft" id="qty-label">{r.quantity}</span>
              <div className="mt-1 flex items-center gap-2" role="group" aria-labelledby="qty-label">
                <Button variant="secondary" className="min-h-11 px-3" onClick={() => setQuantity((q) => Math.max(1, q - 1))} aria-label={r.less}>
                  <Minus className="size-4" aria-hidden />
                </Button>
                <output className="min-w-8 text-center text-lg font-semibold" aria-live="polite">{quantity}</output>
                <Button variant="secondary" className="min-h-11 px-3" onClick={() => setQuantity((q) => Math.min(999, q + 1))} aria-label={r.more}>
                  <Plus className="size-4" aria-hidden />
                </Button>
              </div>
            </div>
            <Field label={b.unitPrice} error={priceError ? r.invalidAmount : error.fields.unitAmount}>
              <input inputMode="decimal" dir="ltr" value={price} onChange={(e) => setPrice(e.target.value)} className={fieldClass} required />
            </Field>
          </div>

          <p className="flex items-baseline justify-between border-t border-line pt-4">
            <span className="text-ink-soft">{r.total}</span>
            <span className="text-2xl font-semibold">{f.amount(total)}</span>
          </p>

          {Object.keys(error.fields).length === 0 && <ErrorNote>{error.message}</ErrorNote>}

          <Button type="submit" className="min-h-12 w-full text-[17px]" disabled={charge.isPending}>
            {charge.isPending ? r.sending : r.submit(room.number)}
          </Button>
        </form>
      )}

      {done.length > 0 && (
        <section aria-labelledby="session-title" className="space-y-2">
          <h2 id="session-title" className="text-[14px] font-medium text-ink-soft">{r.session}</h2>
          <ul className="divide-y divide-line rounded-lg bg-surface ring-1 ring-line">
            {done.map((d, i) => (
              <li key={i} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <span className="min-w-0 truncate">
                  <span className="font-semibold">{d.room}</span> · {d.label}
                </span>
                <span className="shrink-0">{f.amount(d.total)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
