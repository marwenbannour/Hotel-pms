'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { nightsBetween } from '@/lib/dates';
import { useI18n, useRes } from '@/lib/lang-context';
import type { AvailabilityType, Board, Quote } from '@/lib/types';
import { Field, fieldClass, useDebounced } from '../ui';

export interface StayValue {
  arrivalDate: string;
  departureDate: string;
  adults: number;
  children: number;
  board: Board;
  roomTypeId: string | null;
}

interface Props {
  value: StayValue;
  onChange: (v: StayValue) => void;
  /** En modification : la réservation ne se compte pas dans le stock. */
  excludeReservationId?: string;
  /** Type actuel en modification, sélectionnable même s'il paraît complet. */
  currentRoomTypeId?: string;
  errors?: Partial<Record<keyof StayValue, string>>;
  onQuote?: (q: Quote | null) => void;
}

const BOARDS: Board[] = ['room_only', 'half_board', 'full_board'];

export function StayFields({ value, onChange, excludeReservationId, currentRoomTypeId, errors = {}, onQuote }: Props) {
  const { t, f } = useI18n();
  const r = useRes();
  const set = <K extends keyof StayValue>(k: K, v: StayValue[K]) => onChange({ ...value, [k]: v });
  const debounced = useDebounced(value, 250);
  const datesValid = nightsBetween(debounced.arrivalDate, debounced.departureDate) >= 1;
  const pax = value.adults + value.children;

  const availability = useQuery({
    queryKey: ['availability', debounced.arrivalDate, debounced.departureDate],
    queryFn: async () =>
      (await api<{ roomTypes: AvailabilityType[] }>(`/availability?from=${debounced.arrivalDate}&to=${debounced.departureDate}`)).data.roomTypes,
    enabled: datesValid,
  });

  const quote = useQuery({
    queryKey: ['quote', debounced, excludeReservationId],
    queryFn: async () => {
      const p = new URLSearchParams({
        room_type_id: debounced.roomTypeId!,
        arrival_date: debounced.arrivalDate,
        departure_date: debounced.departureDate,
        adults: String(debounced.adults),
        children: String(debounced.children),
        board: debounced.board,
      });
      if (excludeReservationId) p.set('exclude_reservation_id', excludeReservationId);
      const q = (await api<Quote>(`/reservations/quote?${p}`)).data;
      onQuote?.(q);
      return q;
    },
    enabled: datesValid && !!debounced.roomTypeId && debounced.adults >= 1,
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Field label={r.arrival} error={errors.arrivalDate}>
          <input type="date" className={fieldClass} value={value.arrivalDate} onChange={(e) => set('arrivalDate', e.target.value)} required />
        </Field>
        <Field label={r.departure} error={errors.departureDate ?? (datesValid || !value.departureDate ? undefined : r.datesInvalid)}>
          <input
            type="date"
            className={fieldClass}
            min={value.arrivalDate}
            value={value.departureDate}
            onChange={(e) => set('departureDate', e.target.value)}
            required
          />
        </Field>
        <Field label={r.adults} error={errors.adults}>
          <input type="number" min={1} max={20} className={fieldClass} value={value.adults} onChange={(e) => set('adults', Math.max(1, Number(e.target.value) || 1))} />
        </Field>
        <Field label={r.children} error={errors.children}>
          <input type="number" min={0} max={20} className={fieldClass} value={value.children} onChange={(e) => set('children', Math.max(0, Number(e.target.value) || 0))} />
        </Field>
      </div>

      <fieldset>
        <legend className="text-[14px] text-ink-soft">{r.board}</legend>
        <div className="mt-1 inline-flex flex-wrap rounded-md ring-1 ring-line">
          {BOARDS.map((b) => (
            <label
              key={b}
              className={`cursor-pointer px-4 py-2 text-[14px] first:rounded-s-md last:rounded-e-md has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-brass ${
                value.board === b ? 'bg-ink text-white' : 'bg-surface hover:bg-paper'
              }`}
            >
              <input type="radio" name="board" value={b} checked={value.board === b} onChange={() => set('board', b)} className="sr-only" />
              {t.boards[b]}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-[14px] text-ink-soft">{r.roomChoice}</legend>
        {errors.roomTypeId && <p className="mt-1 text-[13px] text-maintenance">{errors.roomTypeId}</p>}
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {(availability.data ?? []).map((rt) => {
            const selected = value.roomTypeId === rt.roomTypeId;
            const soldOut = rt.available < 1 && rt.roomTypeId !== currentRoomTypeId;
            const tooSmall = pax > rt.capacity;
            return (
              <label
                key={rt.roomTypeId}
                className={`relative block rounded-md p-3 ring-1 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-brass ${
                  soldOut ? 'cursor-not-allowed bg-paper opacity-60 ring-line' : 'cursor-pointer bg-surface'
                } ${selected ? 'ring-2 ring-ink' : 'ring-line hover:ring-ink/40'}`}
              >
                <input
                  type="radio"
                  name="roomType"
                  className="sr-only"
                  disabled={soldOut}
                  checked={selected}
                  onChange={() => set('roomTypeId', rt.roomTypeId)}
                />
                <span className="flex items-baseline justify-between gap-2">
                  <span className="font-medium">{rt.name}</span>
                  <span className="text-[12px] text-ink-faint">{rt.code}</span>
                </span>
                <span className="mt-1 block text-[14px]">
                  {f.money(rt.nightlyRate)} <span className="text-ink-soft">{r.perNight}</span>
                </span>
                <span className="mt-1 flex justify-between text-[12px]">
                  <span className={rt.available < 1 ? 'text-maintenance' : rt.available <= 1 ? 'text-brass' : 'text-available'}>
                    {r.roomsLeft(rt.available)}
                  </span>
                  <span className={tooSmall ? 'text-maintenance' : 'text-ink-faint'}>{r.capacity(rt.capacity)}</span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      {quote.data && value.roomTypeId && (
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-t border-line pt-4" aria-live="polite">
          <div>
            <span className="text-ink-soft">{r.total}</span>
            <span className="block text-[13px] text-ink-faint" dir="ltr">
              {r.totalDetail(
                quote.data.nights,
                f.money(quote.data.nightlyRate),
                quote.data.boardSupplementPerPerson ? f.money(quote.data.boardSupplementPerPerson) : '',
                pax,
              )}
            </span>
          </div>
          <span className="text-2xl font-semibold">{f.money(quote.data.totalAmount)}</span>
          {!quote.data.fitsCapacity && <p className="w-full text-[13px] text-maintenance">{r.tooMany}</p>}
          {quote.data.unavailableNights.length > 0 && (
            <p className="w-full text-[13px] text-maintenance">
              {r.roomsLeft(0)} : {quote.data.unavailableNights.map((d) => f.shortDate(d)).join(', ')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
