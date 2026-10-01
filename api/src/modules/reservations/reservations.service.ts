import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { randomInt } from 'crypto';
import { DataSource, EntityManager, IsNull } from 'typeorm';
import { AuditService } from '../../common/audit.service';
import { AuthUser } from '../../common/auth.decorators';
import { hotelToday, nightsBetween } from '../../common/dates';
import { assertIfMatch } from '../../common/etag';
import { paginate, resolveSort } from '../../common/pagination';
import { invalidState, notFound, ProblemException } from '../../common/problem';
import { appConfig } from '../../config';
import { Guest, Reservation, Room, RoomType } from '../../database/entities';
import { Board, RESERVATION_STATUSES, ReservationStatus } from '../../database/entities/reservation.entity';
import { FolioService } from '../billing/folio.service';
import { assertStayRange, AvailabilityService } from './availability.service';
import {
  CancelReservationDto, CheckInDto, CreateReservationDto, ListReservationsQuery, QuoteQuery, UpdateReservationDto,
} from './reservations.dto';

const REF_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const newReference = () => 'R' + Array.from({ length: 7 }, () => REF_ALPHABET[randomInt(REF_ALPHABET.length)]).join('');

export function computeTotal(roomType: RoomType, nights: number, board: Board, pax: number): number {
  const supplement = appConfig.hotel.boardSupplement[board] ?? 0;
  return nights * (roomType.basePrice + supplement * pax);
}

export const toReservationDto = (r: Reservation) => ({
  id: r.id,
  reference: r.reference,
  status: r.status,
  guest: r.guest ? { id: r.guest.id, firstName: r.guest.firstName, lastName: r.guest.lastName } : { id: r.guestId },
  roomType: r.roomType ? { id: r.roomType.id, code: r.roomType.code, name: r.roomType.name } : { id: r.roomTypeId },
  room: r.room ? { id: r.room.id, number: r.room.number } : null,
  arrivalDate: r.arrivalDate,
  departureDate: r.departureDate,
  nights: nightsBetween(r.arrivalDate, r.departureDate),
  adults: r.adults,
  children: r.children,
  board: r.board,
  channel: r.channel,
  totalAmount: r.totalAmount,
  currency: r.currency.trim(),
  notes: r.notes,
  cancelReason: r.cancelReason,
  cancelledAt: r.cancelledAt,
  checkedInAt: r.checkedInAt,
  checkedOutAt: r.checkedOutAt,
  createdAt: r.createdAt,
  updatedAt: r.updatedAt,
  version: r.version,
});

@Injectable()
export class ReservationsService {
  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly availability: AvailabilityService,
    private readonly audit: AuditService,
    private readonly folio: FolioService,
  ) {}

  private withRelations(m: EntityManager = this.ds.manager) {
    return m
      .getRepository(Reservation)
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.guest', 'guest')
      .leftJoinAndSelect('r.roomType', 'roomType')
      .leftJoinAndSelect('r.room', 'room');
  }

  private async load(id: string, m?: EntityManager) {
    const r = await this.withRelations(m).where('r.id = :id', { id }).getOne();
    if (!r) throw notFound('Réservation');
    return r;
  }

  private async lockReservation(m: EntityManager, id: string) {
    const r = await m.findOne(Reservation, { where: { id }, lock: { mode: 'pessimistic_write' } });
    if (!r) throw notFound('Réservation');
    return r;
  }

  /**
   * Verrouille le type de chambre (sérialise les ventes concurrentes sur ce type)
   * puis vérifie qu'une chambre reste disponible chaque nuit du séjour.
   */
  private async reserveStock(
    m: EntityManager,
    roomTypeId: string,
    arrival: string,
    departure: string,
    pax: number,
    excludeReservationId?: string,
  ): Promise<RoomType> {
    const roomType = await m.findOne(RoomType, { where: { id: roomTypeId }, lock: { mode: 'pessimistic_write' } });
    if (!roomType) throw new ProblemException(422, 'VALIDATION_FAILED', 'Type de chambre inconnu.');
    if (pax > roomType.capacity) {
      throw new ProblemException(422, 'VALIDATION_FAILED', `Capacité du type ${roomType.code} : ${roomType.capacity} personne(s).`);
    }
    const [avail] = await this.availability.compute(arrival, departure, { roomTypeId, excludeReservationId }, m);
    const full = avail?.nights.filter((n) => n.available < 1).map((n) => n.date) ?? [];
    if (!avail || full.length) {
      throw new ProblemException(409, 'NO_AVAILABILITY', `Plus de chambre ${roomType.code} disponible pour ${full.length} nuit(s).`, {
        unavailableNights: full,
      });
    }
    return roomType;
  }

  async list(q: ListReservationsQuery) {
    const sort = resolveSort(q.sort, { arrival_date: ['r.arrivalDate', 'arrivalDate'], created_at: ['r.createdAt', 'createdAt'] }, 'arrival_date');
    const qb = this.withRelations();
    if (q.status) {
      const statuses = q.status.split(',').map((s) => s.trim());
      const bad = statuses.filter((s) => !(RESERVATION_STATUSES as readonly string[]).includes(s));
      if (bad.length) throw new ProblemException(422, 'VALIDATION_FAILED', `Statut inconnu : ${bad.join(', ')}.`);
      qb.andWhere('r.status IN (:...statuses)', { statuses });
    }
    if (q.arrival_from) qb.andWhere('r.arrivalDate >= :af', { af: q.arrival_from });
    if (q.arrival_to) qb.andWhere('r.arrivalDate <= :at', { at: q.arrival_to });
    if (q.guest_id) qb.andWhere('r.guestId = :gid', { gid: q.guest_id });
    if (q.reference) qb.andWhere('r.reference = :ref', { ref: q.reference.toUpperCase() });
    if (q.departure_from) qb.andWhere('r.departureDate >= :df', { df: q.departure_from });
    if (q.departure_to) qb.andWhere('r.departureDate <= :dt', { dt: q.departure_to });
    if (q.q) {
      const term = q.q.trim().toLowerCase();
      const like = `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
      qb.andWhere(
        `(r.reference = :refq OR lower(guest.lastName) LIKE :like OR lower(guest.firstName) LIKE :like
          OR lower(guest.firstName || ' ' || guest.lastName) LIKE :like OR lower(guest.email) LIKE :like)`,
        { refq: term.toUpperCase(), like },
      );
    }
    const page = await paginate(qb, sort, q);
    return { ...page, data: page.data.map(toReservationDto) };
  }

  async get(id: string) {
    return toReservationDto(await this.load(id));
  }

  /** Prix et disponibilité d'un séjour envisagé, avec les mêmes règles que la création. */
  async quote(q: QuoteQuery) {
    const nights = assertStayRange(q.arrival_date, q.departure_date);
    const roomType = await this.ds.getRepository(RoomType).findOneBy({ id: q.room_type_id });
    if (!roomType) throw notFound('Type de chambre');
    const pax = q.adults + (q.children ?? 0);
    const [avail] = await this.availability.compute(q.arrival_date, q.departure_date, {
      roomTypeId: roomType.id,
      excludeReservationId: q.exclude_reservation_id,
    });
    return {
      roomTypeId: roomType.id,
      nights,
      nightlyRate: roomType.basePrice,
      boardSupplementPerPerson: appConfig.hotel.boardSupplement[q.board] ?? 0,
      totalAmount: computeTotal(roomType, nights, q.board, pax),
      currency: roomType.currency.trim(),
      capacity: roomType.capacity,
      fitsCapacity: pax <= roomType.capacity,
      available: avail?.available ?? 0,
      unavailableNights: avail?.nights.filter((n) => n.available < 1).map((n) => n.date) ?? [],
    };
  }

  /** Historique de la réservation, reconstitué depuis le journal d'audit. */
  async history(id: string) {
    await this.load(id);
    const rows: { action: string; created_at: Date; actor_id: string | null; full_name: string | null; data: Record<string, unknown> }[] =
      await this.ds.query(
        `SELECT a.action, a.created_at, a.actor_id, u.full_name, a.data
         FROM audit_logs a LEFT JOIN users u ON u.id = a.actor_id
         WHERE a.entity_type = 'reservation' AND a.entity_id = $1
         ORDER BY a.created_at, a.id`,
        [id],
      );
    return {
      data: rows.map((r) => ({
        action: r.action,
        at: r.created_at,
        actor: r.actor_id ? { id: r.actor_id, name: r.full_name } : null,
        data: r.data,
      })),
      nextCursor: null,
    };
  }

  async create(dto: CreateReservationDto, actor: AuthUser) {
    if (!!dto.guestId === !!dto.guest) {
      throw new ProblemException(422, 'VALIDATION_FAILED', 'Fournir soit guestId, soit guest.');
    }
    const nights = assertStayRange(dto.arrivalDate, dto.departureDate);
    if (dto.arrivalDate < hotelToday()) {
      throw new ProblemException(422, 'VALIDATION_FAILED', 'La date d’arrivée est déjà passée.');
    }
    const pax = dto.adults + (dto.children ?? 0);

    const id = await this.ds.transaction(async (m) => {
      const roomType = await this.reserveStock(m, dto.roomTypeId, dto.arrivalDate, dto.departureDate, pax);

      let guestId = dto.guestId;
      if (guestId) {
        const g = await m.findOneBy(Guest, { id: guestId, erasedAt: IsNull() });
        if (!g) throw new ProblemException(422, 'VALIDATION_FAILED', 'Client inconnu.');
      } else {
        const g = await m.save(m.create(Guest, { ...dto.guest!, preferences: dto.guest!.preferences ?? {} }));
        guestId = g.id;
      }

      const r = await m.save(
        m.create(Reservation, {
          reference: newReference(),
          guestId,
          roomTypeId: roomType.id,
          arrivalDate: dto.arrivalDate,
          departureDate: dto.departureDate,
          adults: dto.adults,
          children: dto.children ?? 0,
          board: dto.board,
          channel: dto.channel,
          totalAmount: computeTotal(roomType, nights, dto.board, pax),
          currency: roomType.currency,
          notes: dto.notes ?? null,
        }),
      );
      await this.audit.log(
        { actorId: actor.id, action: 'reservation.created', entityType: 'reservation', entityId: r.id, data: { reference: r.reference, channel: r.channel } },
        m,
      );
      return r.id;
    });
    return this.get(id);
  }

  async update(id: string, dto: UpdateReservationDto, ifMatch: string | undefined, actor: AuthUser) {
    await this.ds.transaction(async (m) => {
      const r = await this.lockReservation(m, id);
      assertIfMatch(ifMatch, r.version);
      if (r.status !== 'confirmed') throw invalidState(`Réservation au statut ${r.status} : modification impossible.`);
      await this.folio.assertNotInvoiced(m, id);

      const next = {
        roomTypeId: dto.roomTypeId ?? r.roomTypeId,
        arrivalDate: dto.arrivalDate ?? r.arrivalDate,
        departureDate: dto.departureDate ?? r.departureDate,
        adults: dto.adults ?? r.adults,
        children: dto.children ?? r.children,
        board: dto.board ?? r.board,
      };
      const nights = assertStayRange(next.arrivalDate, next.departureDate);
      if (dto.arrivalDate && dto.arrivalDate !== r.arrivalDate && dto.arrivalDate < hotelToday()) {
        throw new ProblemException(422, 'VALIDATION_FAILED', 'La nouvelle date d’arrivée est déjà passée.');
      }
      const pax = next.adults + next.children;
      const stockChanged =
        next.roomTypeId !== r.roomTypeId || next.arrivalDate !== r.arrivalDate || next.departureDate !== r.departureDate;

      const roomType = stockChanged
        ? await this.reserveStock(m, next.roomTypeId, next.arrivalDate, next.departureDate, pax, r.id)
        : await m.findOneByOrFail(RoomType, { id: r.roomTypeId });
      if (!stockChanged && pax > roomType.capacity) {
        throw new ProblemException(422, 'VALIDATION_FAILED', `Capacité du type ${roomType.code} : ${roomType.capacity} personne(s).`);
      }

      const before = Object.fromEntries(Object.keys(next).map((k) => [k, r[k as keyof typeof next]]));
      if (r.roomId && next.roomTypeId !== r.roomTypeId) r.roomId = null; // la chambre pré-attribuée n'est plus du bon type
      Object.assign(r, next, { notes: dto.notes ?? r.notes, totalAmount: computeTotal(roomType, nights, next.board, pax) });
      await m.save(r);
      await this.audit.log({ actorId: actor.id, action: 'reservation.modified', entityType: 'reservation', entityId: id, data: { before, after: next } }, m);
    });
    return this.get(id);
  }

  /**
   * Pré-attribue (ou retire) une chambre à une réservation confirmée. La contrainte
   * d'exclusion garantit qu'une chambre n'est jamais promise deux fois sur les mêmes nuits.
   */
  async assignRoom(id: string, roomId: string | null, ifMatch: string | undefined, actor: AuthUser) {
    await this.ds.transaction(async (m) => {
      const r = await this.lockReservation(m, id);
      assertIfMatch(ifMatch, r.version);
      if (r.status !== 'confirmed') throw invalidState(`Réservation au statut ${r.status} : attribution impossible.`);
      if (r.roomId === roomId) return;

      let room: Room | null = null;
      if (roomId) {
        room = await m.findOneBy(Room, { id: roomId });
        if (!room) throw new ProblemException(422, 'VALIDATION_FAILED', 'Chambre inconnue.');
        if (room.roomTypeId !== r.roomTypeId) throw new ProblemException(422, 'VALIDATION_FAILED', 'La chambre n’est pas du type réservé.');
        const clash: { reference: string }[] = await m.query(
          `SELECT reference FROM reservations WHERE room_id = $1 AND id <> $2 AND status IN ('confirmed','checked_in')
             AND arrival_date < $4 AND departure_date > $3 LIMIT 1`,
          [roomId, r.id, r.arrivalDate, r.departureDate],
        );
        if (clash.length) {
          throw new ProblemException(409, 'ROOM_UNAVAILABLE', `Chambre ${room.number} déjà attribuée à la réservation ${clash[0].reference} sur ces dates.`);
        }
      }
      const previous = r.roomId;
      r.roomId = roomId;
      await m.save(r);
      await this.audit.log(
        {
          actorId: actor.id,
          action: roomId ? 'reservation.room_assigned' : 'reservation.room_unassigned',
          entityType: 'reservation',
          entityId: id,
          data: { roomId, roomNumber: room?.number ?? null, previousRoomId: previous },
        },
        m,
      );
    });
    return this.get(id);
  }

  async cancel(id: string, dto: CancelReservationDto, actor: AuthUser) {
    await this.ds.transaction(async (m) => {
      const r = await this.lockReservation(m, id);
      if (r.status === 'cancelled') return;
      if (r.status !== 'confirmed') throw invalidState(`Réservation au statut ${r.status} : annulation impossible.`);
      await this.folio.assertNotInvoiced(m, id);
      Object.assign(r, { status: 'cancelled' as ReservationStatus, cancelReason: dto.reason, cancelledAt: new Date() });
      await m.save(r);
      await this.audit.log({ actorId: actor.id, action: 'reservation.cancelled', entityType: 'reservation', entityId: id, data: { reason: dto.reason } }, m);
    });
    return this.get(id);
  }

  async checkIn(id: string, dto: CheckInDto, actor: AuthUser) {
    await this.ds.transaction(async (m) => {
      const r = await this.lockReservation(m, id);
      if (r.status !== 'confirmed') throw invalidState(`Réservation au statut ${r.status} : arrivée impossible.`);
      const today = hotelToday();
      if (today < r.arrivalDate || today >= r.departureDate) {
        throw invalidState(`Arrivée possible du ${r.arrivalDate} au ${r.departureDate} exclu (aujourd’hui : ${today}).`);
      }

      let room: Room | null;
      const chosenId = dto.roomId ?? r.roomId;
      if (chosenId) {
        room = await m.findOne(Room, { where: { id: chosenId }, lock: { mode: 'pessimistic_write' } });
        if (!room) throw new ProblemException(422, 'VALIDATION_FAILED', 'Chambre inconnue.');
        if (room.roomTypeId !== r.roomTypeId) throw new ProblemException(422, 'VALIDATION_FAILED', 'La chambre n’est pas du type réservé.');
        if (room.status !== 'available') {
          const pre = !dto.roomId ? ' (pré-attribuée ; choisissez une autre chambre ou attendez qu’elle soit prête)' : '';
          throw new ProblemException(409, 'ROOM_UNAVAILABLE', `Chambre ${room.number} : état ${room.status}${pre}.`);
        }
      } else {
        // Attribution automatique : première chambre propre et libre du type, sans attendre les verrous concurrents.
        room = await m
          .getRepository(Room)
          .createQueryBuilder('room')
          .setLock('pessimistic_write')
          .setOnLocked('skip_locked')
          .where('room.roomTypeId = :t AND room.status = :s', { t: r.roomTypeId, s: 'available' })
          // Ne pas prendre une chambre déjà promise à un autre séjour sur ces nuits.
          .andWhere(
            `NOT EXISTS (SELECT 1 FROM reservations o WHERE o.room_id = room.id AND o.id <> :rid
               AND o.status IN ('confirmed','checked_in') AND o.arrival_date < :dep AND o.departure_date > :arr)`,
            { rid: r.id, arr: r.arrivalDate, dep: r.departureDate },
          )
          .orderBy('room.number', 'ASC')
          .getOne();
        if (!room) throw new ProblemException(409, 'ROOM_UNAVAILABLE', 'Aucune chambre propre et libre de ce type pour le moment.');
      }

      Object.assign(r, { roomId: room.id, status: 'checked_in' as ReservationStatus, checkedInAt: new Date() });
      await m.save(r); // la contrainte d'exclusion protège contre une double attribution
      room.status = 'occupied';
      await m.save(room);
      await this.audit.log(
        { actorId: actor.id, action: 'reservation.checked_in', entityType: 'reservation', entityId: id, data: { roomId: room.id, roomNumber: room.number } },
        m,
      );
    });
    return this.get(id);
  }

  /**
   * Départ (section 3.4) : en cas de départ anticipé, les nuits restantes sont libérées et
   * le prix ramené au prorata des nuits passées (tant que le séjour n'est pas facturé).
   * Le compte doit être soldé, sauf dérogation motivée d'un profil habilité.
   */
  async checkOut(id: string, actor: AuthUser, overrideBalanceReason?: string) {
    if (overrideBalanceReason && !actor.permissions.includes('billing:override')) {
      throw new ProblemException(403, 'FORBIDDEN', 'Seuls la direction et la comptabilité peuvent valider un départ avec un solde non nul.');
    }
    await this.ds.transaction(async (m) => {
      const r = await this.lockReservation(m, id);
      if (r.status !== 'checked_in') throw invalidState(`Réservation au statut ${r.status} : départ impossible.`);
      const today = hotelToday();
      const data: Record<string, unknown> = {};
      const invoiced = await this.folio.activeInvoice(m, id);
      if (!invoiced && today > r.arrivalDate && today < r.departureDate) {
        const planned = nightsBetween(r.arrivalDate, r.departureDate);
        const actual = nightsBetween(r.arrivalDate, today);
        Object.assign(data, { plannedDeparture: r.departureDate, plannedTotal: r.totalAmount });
        r.totalAmount = Math.round((r.totalAmount * actual) / planned);
        r.departureDate = today;
      }
      Object.assign(r, { status: 'checked_out' as ReservationStatus, checkedOutAt: new Date() });
      await m.save(r);

      const { balance, currency } = await this.folio.folio(id, 'fr', m);
      if (balance !== 0) {
        if (!overrideBalanceReason) {
          const due = balance > 0;
          throw new ProblemException(
            409,
            'BALANCE_DUE',
            due
              ? `Solde à régler avant le départ : ${(balance / 100).toFixed(2)} ${currency}.`
              : `Trop-perçu à rembourser avant le départ : ${(-balance / 100).toFixed(2)} ${currency}.`,
            { balance, currency },
          );
        }
        Object.assign(data, { balanceOverride: { balance, reason: overrideBalanceReason } });
      }

      if (r.roomId) {
        const room = await m.findOne(Room, { where: { id: r.roomId }, lock: { mode: 'pessimistic_write' } });
        if (room && room.status === 'occupied') {
          room.status = 'cleaning';
          await m.save(room);
        }
      }
      await this.audit.log({ actorId: actor.id, action: 'reservation.checked_out', entityType: 'reservation', entityId: id, data }, m);
    });
    return this.get(id);
  }

}
