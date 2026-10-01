import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { hotelToday, nightsBetween } from '../../common/dates';
import { ProblemException } from '../../common/problem';

export const MAX_PLANNING_DAYS = 31;

export interface PlanningRoom {
  id: string;
  number: string;
  floor: number | null;
  roomTypeId: string;
  roomTypeCode: string;
  status: string;
}

export interface PlanningStay {
  id: string;
  reference: string;
  guestName: string;
  roomId: string | null;
  roomTypeId: string;
  arrivalDate: string;
  departureDate: string;
  status: 'confirmed' | 'checked_in' | 'checked_out';
  adults: number;
  children: number;
  version: number;
  /** Client présent alors que sa date de départ est passée : la chambre reste occupée. */
  overdue: boolean;
}

@Injectable()
export class PlanningService {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  /** Planning visuel des chambres (section 5) : chambres et séjours qui recoupent la période. */
  async get(from: string, to: string) {
    const days = nightsBetween(from, to);
    if (!Number.isFinite(days) || days < 1 || days > MAX_PLANNING_DAYS) {
      throw new ProblemException(422, 'VALIDATION_FAILED', `Période de 1 à ${MAX_PLANNING_DAYS} jours.`);
    }
    const today = hotelToday();

    const roomTypes: { id: string; code: string; name: string; capacity: number }[] = await this.ds.query(
      `SELECT id, code, name, capacity FROM room_types ORDER BY code`,
    );
    const rooms: PlanningRoom[] = (
      await this.ds.query(
        `SELECT r.id, r.number, r.floor, r.room_type_id, rt.code AS room_type_code, r.status
         FROM rooms r JOIN room_types rt ON rt.id = r.room_type_id
         ORDER BY rt.code, r.number`,
      )
    ).map((r: Record<string, unknown>) => ({
      id: r.id,
      number: r.number,
      floor: r.floor,
      roomTypeId: r.room_type_id,
      roomTypeCode: r.room_type_code,
      status: r.status,
    }));

    const stays: PlanningStay[] = (
      await this.ds.query(
        `SELECT r.id, r.reference, g.first_name || ' ' || g.last_name AS guest_name, r.room_id, r.room_type_id,
                to_char(r.arrival_date, 'YYYY-MM-DD') AS arrival_date, to_char(r.departure_date, 'YYYY-MM-DD') AS departure_date,
                r.status, r.adults, r.children, r.version
         FROM reservations r JOIN guests g ON g.id = r.guest_id
         WHERE r.status IN ('confirmed', 'checked_in', 'checked_out')
           AND r.arrival_date < $2
           AND (r.departure_date > $1 OR (r.status = 'checked_in' AND r.departure_date < $3))
         ORDER BY r.arrival_date, r.reference`,
        [from, to, today],
      )
    ).map((r: Record<string, unknown>) => ({
      id: r.id,
      reference: r.reference,
      guestName: r.guest_name,
      roomId: r.room_id ?? null,
      roomTypeId: r.room_type_id,
      arrivalDate: r.arrival_date,
      departureDate: r.departure_date,
      status: r.status,
      adults: r.adults,
      children: r.children,
      version: r.version,
      // Partir le jour prévu est normal : le retard commence le lendemain.
      overdue: r.status === 'checked_in' && (r.departure_date as string) < today,
    }));

    return { from, to, today, roomTypes, rooms, stays };
  }
}
