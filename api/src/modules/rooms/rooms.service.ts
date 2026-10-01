import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, In } from 'typeorm';
import { AuditService } from '../../common/audit.service';
import { AuthUser } from '../../common/auth.decorators';
import { assertIfMatch } from '../../common/etag';
import { paginate, resolveSort } from '../../common/pagination';
import { invalidState, notFound, ProblemException } from '../../common/problem';
import { appConfig } from '../../config';
import { Reservation, Room, RoomType } from '../../database/entities';
import { RoomStatus } from '../../database/entities/room.entity';
import { CreateRoomDto, CreateRoomTypeDto, ListRoomsQuery, UpdateRoomDto, UpdateRoomTypeDto } from './rooms.dto';

/**
 * Transitions d'état autorisées à la main. `occupied` n'est posé que par le check-in,
 * et une chambre occupée ne se libère que par le check-out.
 */
const MANUAL_TRANSITIONS: Record<RoomStatus, RoomStatus[]> = {
  available: ['cleaning', 'maintenance'],
  cleaning: ['available', 'maintenance'],
  maintenance: ['available', 'cleaning'],
  occupied: ['maintenance'],
};

@Injectable()
export class RoomsService {
  constructor(@InjectDataSource() private readonly ds: DataSource, private readonly audit: AuditService) {}

  // ---- Types de chambre ----
  listTypes() {
    return this.ds.getRepository(RoomType).find({ order: { code: 'ASC' } });
  }

  async getType(id: string) {
    const t = await this.ds.getRepository(RoomType).findOneBy({ id });
    if (!t) throw notFound('Type de chambre');
    return t;
  }

  createType(dto: CreateRoomTypeDto) {
    const repo = this.ds.getRepository(RoomType);
    return repo.save(repo.create({ ...dto, currency: dto.currency ?? appConfig.hotel.currency }));
  }

  updateType(id: string, dto: UpdateRoomTypeDto, ifMatch?: string) {
    return this.ds.transaction(async (m) => {
      const t = await m.findOne(RoomType, { where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!t) throw notFound('Type de chambre');
      assertIfMatch(ifMatch, t.version);
      Object.assign(t, dto);
      return m.save(t);
    });
  }

  // ---- Chambres ----
  async list(q: ListRoomsQuery) {
    const sort = resolveSort(q.sort, { number: ['r.number', 'number'], floor: ['r.floor', 'floor'] }, 'number');
    const qb = this.ds.getRepository(Room).createQueryBuilder('r');
    if (q.status) qb.andWhere('r.status = :status', { status: q.status });
    if (q.room_type_id) qb.andWhere('r.roomTypeId = :rt', { rt: q.room_type_id });
    return paginate(qb, sort, q);
  }

  async get(id: string) {
    const r = await this.ds.getRepository(Room).findOneBy({ id });
    if (!r) throw notFound('Chambre');
    return r;
  }

  async create(dto: CreateRoomDto) {
    await this.getType(dto.roomTypeId);
    const repo = this.ds.getRepository(Room);
    return repo.save(repo.create({ ...dto, floor: dto.floor ?? null }));
  }

  update(id: string, dto: UpdateRoomDto, ifMatch?: string) {
    return this.ds.transaction(async (m) => {
      const r = await m.findOne(Room, { where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!r) throw notFound('Chambre');
      assertIfMatch(ifMatch, r.version);
      if (dto.roomTypeId && dto.roomTypeId !== r.roomTypeId) {
        const busy = await m.existsBy(Reservation, { roomId: id, status: In(['confirmed', 'checked_in']) });
        if (busy) throw invalidState('Impossible de changer le type d’une chambre attribuée à une réservation active.');
      }
      Object.assign(r, dto);
      return m.save(r);
    });
  }

  /** Changement d'état manuel (ménage, maintenance), tracé dans le journal d'audit. */
  setStatus(id: string, status: RoomStatus, ifMatch: string | undefined, actor: AuthUser) {
    return this.ds.transaction(async (m) => {
      const r = await m.findOne(Room, { where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!r) throw notFound('Chambre');
      assertIfMatch(ifMatch, r.version);
      if (r.status === status) return r;
      if (!MANUAL_TRANSITIONS[r.status].includes(status)) {
        throw new ProblemException(409, 'INVALID_STATE', `Transition ${r.status} → ${status} non autorisée manuellement.`);
      }
      const from = r.status;
      r.status = status;
      const saved = await m.save(r);
      await this.audit.log({ actorId: actor.id, action: 'room.status_changed', entityType: 'room', entityId: id, data: { from, to: status } }, m);
      return saved;
    });
  }
}
