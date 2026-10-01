import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AuthUser } from '../../common/auth.decorators';
import { addDays, hotelToday } from '../../common/dates';
import { Lang } from '../../common/i18n';
import { Permission } from '../../common/permissions';
import { KpiService } from './kpi.service';

export type AlertType = 'overdue_departure' | 'pending_no_show' | 'arrival_room_shortage' | 'rooms_in_maintenance';
export interface DashboardAlert {
  type: AlertType;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  count: number;
  reservationIds?: string[];
  roomTypeCode?: string;
}

export interface MovementRow {
  id: string;
  reference: string;
  status: string;
  guestName: string;
  roomType: string;
  roomNumber: string | null;
  arrivalDate: string;
  departureDate: string;
  adults: number;
  children: number;
  board: string;
  notes: string | null;
}

const MSG: Record<AlertType, Record<Lang, (n: number, extra?: string) => string>> = {
  overdue_departure: {
    fr: (n) => `${n} client(s) auraient dû partir : départ à enregistrer.`,
    en: (n) => `${n} guest(s) past their departure date: check-out pending.`,
    ar: (n) => `${n} نزيل تجاوز تاريخ المغادرة: يجب تسجيل المغادرة.`,
  },
  pending_no_show: {
    fr: (n) => `${n} arrivée(s) passée(s) non enregistrée(s) : no-show à traiter.`,
    en: (n) => `${n} past arrival(s) not checked in: possible no-show.`,
    ar: (n) => `${n} وصول سابق غير مسجل: حالة عدم حضور محتملة.`,
  },
  arrival_room_shortage: {
    fr: (n, t) => `${t} : ${n} arrivée(s) en attente de plus que de chambres prêtes.`,
    en: (n, t) => `${t}: ${n} more pending arrival(s) than ready rooms.`,
    ar: (n, t) => `${t}: ${n} وصول منتظر أكثر من الغرف الجاهزة.`,
  },
  rooms_in_maintenance: {
    fr: (n) => `${n} chambre(s) en maintenance, retirée(s) de la vente.`,
    en: (n) => `${n} room(s) out of order, removed from sale.`,
    ar: (n) => `${n} غرفة قيد الصيانة وخارج البيع.`,
  },
};

const MOVEMENT_SQL = (where: string) => `
SELECT r.id, r.reference, r.status, g.first_name || ' ' || g.last_name AS guest_name,
       rt.code AS room_type, rm.number AS room_number,
       to_char(r.arrival_date, 'YYYY-MM-DD') AS arrival_date, to_char(r.departure_date, 'YYYY-MM-DD') AS departure_date,
       r.adults, r.children, r.board, r.notes
FROM reservations r
JOIN guests g ON g.id = r.guest_id
JOIN room_types rt ON rt.id = r.room_type_id
LEFT JOIN rooms rm ON rm.id = r.room_id
WHERE ${where}
ORDER BY r.status DESC, g.last_name, r.reference`;

const toMovement = (r: Record<string, unknown>): MovementRow => ({
  id: r.id as string,
  reference: r.reference as string,
  status: r.status as string,
  guestName: r.guest_name as string,
  roomType: r.room_type as string,
  roomNumber: (r.room_number as string) ?? null,
  arrivalDate: r.arrival_date as string,
  departureDate: r.departure_date as string,
  adults: r.adults as number,
  children: r.children as number,
  board: r.board as string,
  notes: (r.notes as string) ?? null,
});

@Injectable()
export class DashboardService {
  constructor(@InjectDataSource() private readonly ds: DataSource, private readonly kpis: KpiService) {}

  /**
   * Tableau de bord du jour (sections 3.8 et 5). Chaque bloc n'est renvoyé que si le profil
   * dispose des droits correspondants : le ménage ne voit que les chambres, la réception
   * les mouvements, la direction et la comptabilité les indicateurs financiers.
   */
  async forUser(user: AuthUser, lang: Lang, date = hotelToday()) {
    const can = (p: Permission) => user.permissions.includes(p);
    const today = hotelToday();
    const result: Record<string, unknown> = { date, generatedAt: new Date().toISOString(), sections: [] as string[] };
    const sections = result.sections as string[];

    if (can('rooms:read')) {
      const rows: { status: string; n: number }[] = await this.ds.query(
        `SELECT status, count(*)::int AS n FROM rooms GROUP BY status`,
      );
      const counts = { available: 0, occupied: 0, cleaning: 0, maintenance: 0 } as Record<string, number>;
      for (const r of rows) counts[r.status] = r.n;
      const byType: { code: string; name: string; status: string; n: number }[] = await this.ds.query(
        `SELECT rt.code, rt.name, r.status, count(*)::int AS n
         FROM rooms r JOIN room_types rt ON rt.id = r.room_type_id GROUP BY rt.code, rt.name, r.status ORDER BY rt.code`,
      );
      const types = new Map<string, { code: string; name: string; available: number; occupied: number; cleaning: number; maintenance: number }>();
      for (const r of byType) {
        const t = types.get(r.code) ?? { code: r.code, name: r.name, available: 0, occupied: 0, cleaning: 0, maintenance: 0 };
        (t as Record<string, unknown>)[r.status] = r.n;
        types.set(r.code, t);
      }
      // Chambres qui se libèrent aujourd'hui : utile au ménage, sans exposer les données clients.
      const departing: { number: string }[] = await this.ds.query(
        `SELECT rm.number FROM reservations r JOIN rooms rm ON rm.id = r.room_id
         WHERE r.status = 'checked_in' AND r.departure_date = $1 ORDER BY rm.number`,
        [date],
      );
      result.rooms = {
        ...counts,
        total: Object.values(counts).reduce((a, b) => a + b, 0),
        byType: [...types.values()],
        departingToday: departing.map((d) => d.number),
      };
      sections.push('rooms');
    }

    if (can('reservations:read')) {
      const arrivals = (await this.ds.query(MOVEMENT_SQL(`r.arrival_date = $1 AND r.status IN ('confirmed','checked_in')`), [date])).map(toMovement);
      const departures = (await this.ds.query(MOVEMENT_SQL(`r.departure_date = $1 AND r.status IN ('checked_in','checked_out')`), [date])).map(toMovement);
      const [{ n: inHouse }] = await this.ds.query(
        `SELECT count(*)::int AS n FROM reservations WHERE status = 'checked_in'`,
      );
      result.movements = {
        arrivals,
        departures,
        arrivalsPending: arrivals.filter((a: MovementRow) => a.status === 'confirmed').length,
        departuresPending: departures.filter((d: MovementRow) => d.status === 'checked_in').length,
        inHouse,
      };
      sections.push('movements');
      result.alerts = await this.alerts(lang, today, can);
      sections.push('alerts');
    } else if (can('rooms:read')) {
      result.alerts = await this.alerts(lang, today, can);
      sections.push('alerts');
    }

    if (can('reports:read')) {
      const [day, trend, month] = await Promise.all([
        this.kpis.summary(date, addDays(date, 1)),
        this.kpis.summary(addDays(date, -7), addDays(date, 8)),
        this.kpis.summary(date.slice(0, 8) + '01', addDays(date, 1)),
      ]);
      result.kpis = {
        currency: day.currency,
        today: day.totals,
        monthToDate: month.totals,
        trend: trend.daily.map((d) => ({ date: d.date, occupancyRate: d.occupancyRate, revenue: d.revenue, forecast: d.date > today })),
      };
      sections.push('kpis');
    } else if (can('availability:read')) {
      // La réception voit l'occupation, sans les montants.
      const day = await this.kpis.summary(date, addDays(date, 1));
      result.kpis = {
        today: { occupancyRate: day.totals.occupancyRate, roomsSold: day.totals.roomsSold, roomsAvailable: day.totals.roomsAvailable },
      };
      sections.push('kpis');
    }

    return result;
  }

  private async alerts(lang: Lang, today: string, can: (p: Permission) => boolean): Promise<DashboardAlert[]> {
    const alerts: DashboardAlert[] = [];

    if (can('reservations:read')) {
      const overdue: { id: string }[] = await this.ds.query(
        `SELECT id FROM reservations WHERE status = 'checked_in' AND departure_date < $1`, [today],
      );
      if (overdue.length) {
        alerts.push({ type: 'overdue_departure', severity: 'critical', count: overdue.length, message: MSG.overdue_departure[lang](overdue.length), reservationIds: overdue.map((r) => r.id) });
      }
      const noShow: { id: string }[] = await this.ds.query(
        `SELECT id FROM reservations WHERE status = 'confirmed' AND arrival_date < $1`, [today],
      );
      if (noShow.length) {
        alerts.push({ type: 'pending_no_show', severity: 'warning', count: noShow.length, message: MSG.pending_no_show[lang](noShow.length), reservationIds: noShow.map((r) => r.id) });
      }
      // Arrivées du jour à loger : comparées aux chambres prêtes et à celles en cours de nettoyage.
      const shortage: { code: string; pending: number; ready: number }[] = await this.ds.query(
        `SELECT rt.code,
                (SELECT count(*) FROM reservations r WHERE r.room_type_id = rt.id AND r.status = 'confirmed' AND r.arrival_date = $1)::int AS pending,
                (SELECT count(*) FROM rooms rm WHERE rm.room_type_id = rt.id AND rm.status = 'available')::int AS ready
         FROM room_types rt ORDER BY rt.code`,
        [today],
      );
      for (const s of shortage.filter((x) => x.pending > x.ready)) {
        const gap = s.pending - s.ready;
        alerts.push({ type: 'arrival_room_shortage', severity: 'warning', count: gap, roomTypeCode: s.code, message: MSG.arrival_room_shortage[lang](gap, s.code) });
      }
    }

    if (can('rooms:read')) {
      const [{ n }] = await this.ds.query(`SELECT count(*)::int AS n FROM rooms WHERE status = 'maintenance'`);
      if (n > 0) alerts.push({ type: 'rooms_in_maintenance', severity: 'info', count: n, message: MSG.rooms_in_maintenance[lang](n) });
    }

    const order = { critical: 0, warning: 1, info: 2 };
    return alerts.sort((a, b) => order[a.severity] - order[b.severity]);
  }
}
