import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { nightsBetween } from '../../common/dates';
import { ProblemException } from '../../common/problem';

export const MAX_STAY_NIGHTS = 90;

interface Row {
  room_type_id: string;
  code: string;
  name: string;
  capacity: number;
  base_price: number;
  currency: string;
  night: string;
  sellable: number;
  booked: number;
}

export interface NightAvailability {
  date: string;
  available: number;
}

export interface TypeAvailability {
  roomTypeId: string;
  code: string;
  name: string;
  capacity: number;
  nightlyRate: number;
  currency: string;
  /** Minimum sur la période : nombre de chambres réservables pour tout le séjour. */
  available: number;
  nights: NightAvailability[];
}

const SQL = `
WITH nights AS (
  SELECT d::date AS night FROM generate_series($1::date, $2::date - 1, interval '1 day') AS d
), types AS (
  SELECT rt.id, rt.code, rt.name, rt.capacity, rt.base_price, rt.currency,
         (SELECT count(*) FROM rooms r WHERE r.room_type_id = rt.id AND r.status <> 'maintenance')::int AS sellable
  FROM room_types rt
  WHERE ($3::uuid IS NULL OR rt.id = $3::uuid)
)
SELECT t.id AS room_type_id, t.code, t.name, t.capacity, t.base_price, t.currency,
       to_char(n.night, 'YYYY-MM-DD') AS night, t.sellable,
       (SELECT count(*) FROM reservations res
         WHERE res.room_type_id = t.id
           AND res.status IN ('confirmed', 'checked_in')
           AND res.arrival_date <= n.night AND res.departure_date > n.night
           AND ($4::uuid IS NULL OR res.id <> $4::uuid))::int AS booked
FROM types t CROSS JOIN nights n
ORDER BY t.code, n.night`;

export function assertStayRange(from: string, to: string): number {
  const nights = nightsBetween(from, to);
  if (!Number.isFinite(nights) || nights < 1) {
    throw new ProblemException(422, 'VALIDATION_FAILED', 'La date de départ doit être postérieure à la date d’arrivée.');
  }
  if (nights > MAX_STAY_NIGHTS) {
    throw new ProblemException(422, 'VALIDATION_FAILED', `Période limitée à ${MAX_STAY_NIGHTS} nuits.`);
  }
  return nights;
}

@Injectable()
export class AvailabilityService {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  /** Disponibilité nuit par nuit : chambres vendables (hors maintenance) − réservations actives. */
  async compute(
    from: string,
    to: string,
    opts: { roomTypeId?: string; excludeReservationId?: string } = {},
    m: EntityManager = this.ds.manager,
  ): Promise<TypeAvailability[]> {
    assertStayRange(from, to);
    const rows: Row[] = await m.query(SQL, [from, to, opts.roomTypeId ?? null, opts.excludeReservationId ?? null]);
    const byType = new Map<string, TypeAvailability>();
    for (const r of rows) {
      let t = byType.get(r.room_type_id);
      if (!t) {
        t = {
          roomTypeId: r.room_type_id,
          code: r.code,
          name: r.name,
          capacity: r.capacity,
          nightlyRate: r.base_price,
          currency: r.currency.trim(),
          available: Number.MAX_SAFE_INTEGER,
          nights: [],
        };
        byType.set(r.room_type_id, t);
      }
      const available = Math.max(0, r.sellable - r.booked);
      t.nights.push({ date: r.night, available });
      t.available = Math.min(t.available, available);
    }
    return [...byType.values()];
  }
}
