import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { nightsBetween } from '../../common/dates';
import { ProblemException } from '../../common/problem';
import { appConfig } from '../../config';

export const MAX_KPI_DAYS = 366;

export interface DailyKpi {
  date: string;
  roomsAvailable: number;
  roomsSold: number;
  /** Taux d'occupation en pourcentage, une décimale. */
  occupancyRate: number;
  /** Chiffre d'affaires hébergement du jour, en unités mineures. */
  revenue: number;
  /** Prix moyen par chambre vendue (ADR), en unités mineures. */
  adr: number;
  /** Revenu par chambre disponible (RevPAR), en unités mineures. */
  revpar: number;
}

export interface KpiSummary {
  from: string;
  to: string;
  currency: string;
  totals: Omit<DailyKpi, 'date'> & { averageLengthOfStay: number; staysCount: number };
  daily: DailyKpi[];
}

/** Séjours comptés dans les indicateurs : réalisés, en cours ou à venir (prévisionnel). */
const COUNTED = `('confirmed','checked_in','checked_out')`;

const DAILY_SQL = `
WITH days AS (
  SELECT d::date AS day FROM generate_series($1::date, $2::date - 1, interval '1 day') AS d
), inventory AS (
  SELECT count(*)::int AS rooms FROM rooms WHERE status <> 'maintenance'
)
SELECT to_char(days.day, 'YYYY-MM-DD') AS date,
       inventory.rooms AS rooms_available,
       count(r.id)::int AS rooms_sold,
       coalesce(round(sum(r.total_amount::numeric / (r.departure_date - r.arrival_date))), 0)::bigint AS revenue
FROM days
CROSS JOIN inventory
LEFT JOIN reservations r
  ON r.arrival_date <= days.day AND r.departure_date > days.day AND r.status IN ${COUNTED}
GROUP BY days.day, inventory.rooms
ORDER BY days.day`;

const ALOS_SQL = `
SELECT count(*)::int AS stays, coalesce(avg(departure_date - arrival_date), 0)::float AS alos
FROM reservations
WHERE arrival_date >= $1::date AND arrival_date < $2::date AND status IN ${COUNTED}`;

const pct = (num: number, den: number) => (den > 0 ? Math.round((num / den) * 1000) / 10 : 0);
const avg = (num: number, den: number) => (den > 0 ? Math.round(num / den) : 0);

@Injectable()
export class KpiService {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  /**
   * Indicateurs de la section 3.8. Conventions :
   * - chambres disponibles = chambres hors maintenance (état actuel) ;
   * - chiffre d'affaires = montant du séjour réparti à parts égales sur ses nuits ;
   * - les séjours confirmés à venir sont inclus (vue prévisionnelle).
   */
  async summary(from: string, to: string, m: EntityManager = this.ds.manager): Promise<KpiSummary> {
    const days = nightsBetween(from, to);
    if (!Number.isFinite(days) || days < 1) {
      throw new ProblemException(422, 'VALIDATION_FAILED', 'La date de fin doit être postérieure à la date de début.');
    }
    if (days > MAX_KPI_DAYS) throw new ProblemException(422, 'VALIDATION_FAILED', `Période limitée à ${MAX_KPI_DAYS} jours.`);

    const rows: { date: string; rooms_available: number; rooms_sold: number; revenue: string }[] = await m.query(DAILY_SQL, [from, to]);
    const daily: DailyKpi[] = rows.map((r) => {
      const revenue = Number(r.revenue);
      return {
        date: r.date,
        roomsAvailable: r.rooms_available,
        roomsSold: r.rooms_sold,
        occupancyRate: pct(r.rooms_sold, r.rooms_available),
        revenue,
        adr: avg(revenue, r.rooms_sold),
        revpar: avg(revenue, r.rooms_available),
      };
    });

    const sum = (k: 'roomsAvailable' | 'roomsSold' | 'revenue') => daily.reduce((s, d) => s + d[k], 0);
    const roomsAvailable = sum('roomsAvailable');
    const roomsSold = sum('roomsSold');
    const revenue = sum('revenue');
    const [{ stays, alos }] = await m.query(ALOS_SQL, [from, to]);

    return {
      from,
      to,
      currency: appConfig.hotel.currency,
      totals: {
        roomsAvailable,
        roomsSold,
        occupancyRate: pct(roomsSold, roomsAvailable),
        revenue,
        adr: avg(revenue, roomsSold),
        revpar: avg(revenue, roomsAvailable),
        averageLengthOfStay: Math.round(alos * 10) / 10,
        staysCount: stays,
      },
      daily,
    };
  }
}
