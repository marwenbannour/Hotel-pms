import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, In } from 'typeorm';
import { AuditService } from '../../common/audit.service';
import { AuthUser } from '../../common/auth.decorators';
import { assertIfMatch } from '../../common/etag';
import { CursorQueryDto, paginate, resolveSort } from '../../common/pagination';
import { invalidState, notFound } from '../../common/problem';
import { Guest, Reservation } from '../../database/entities';
import { ACTIVE_STATUSES } from '../../database/entities/reservation.entity';
import { CreateGuestDto, ListGuestsQuery, UpdateGuestDto } from './guests.dto';

export const toGuestDto = (g: Guest) => ({
  id: g.id,
  firstName: g.firstName,
  lastName: g.lastName,
  email: g.email,
  phone: g.phone,
  nationality: g.nationality,
  segment: g.segment,
  preferences: g.preferences,
  erased: !!g.erasedAt,
  createdAt: g.createdAt,
  version: g.version,
});

@Injectable()
export class GuestsService {
  constructor(@InjectDataSource() private readonly ds: DataSource, private readonly audit: AuditService) {}

  async list(q: ListGuestsQuery) {
    const sort = resolveSort(q.sort, { last_name: ['g.lastName', 'lastName'], created_at: ['g.createdAt', 'createdAt'] }, 'last_name');
    const qb = this.ds.getRepository(Guest).createQueryBuilder('g').where('g.erasedAt IS NULL');
    if (q.segment) qb.andWhere('g.segment = :segment', { segment: q.segment });
    if (q.q) {
      const like = `%${q.q.toLowerCase().replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
      qb.andWhere('(lower(g.lastName) LIKE :like OR lower(g.firstName) LIKE :like OR lower(g.email) LIKE :like)', { like });
    }
    const page = await paginate(qb, sort, q);
    return { ...page, data: page.data.map(toGuestDto) };
  }

  async getEntity(id: string) {
    const g = await this.ds.getRepository(Guest).findOneBy({ id });
    if (!g) throw notFound('Client');
    return g;
  }

  async get(id: string) {
    return toGuestDto(await this.getEntity(id));
  }

  async create(dto: CreateGuestDto) {
    const repo = this.ds.getRepository(Guest);
    return toGuestDto(await repo.save(repo.create({ ...dto, preferences: dto.preferences ?? {} })));
  }

  update(id: string, dto: UpdateGuestDto, ifMatch?: string) {
    return this.ds.transaction(async (m) => {
      const g = await m.findOne(Guest, { where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!g) throw notFound('Client');
      if (g.erasedAt) throw invalidState('Ce client a été anonymisé.');
      assertIfMatch(ifMatch, g.version);
      Object.assign(g, dto);
      return toGuestDto(await m.save(g));
    });
  }

  async stays(id: string, q: CursorQueryDto) {
    await this.getEntity(id);
    const sort = resolveSort('-arrival_date', { arrival_date: ['r.arrivalDate', 'arrivalDate'] }, '-arrival_date');
    const qb = this.ds.getRepository(Reservation).createQueryBuilder('r').where('r.guestId = :id', { id });
    const page = await paginate(qb, sort, q);
    return {
      ...page,
      data: page.data.map((r) => ({
        id: r.id,
        reference: r.reference,
        status: r.status,
        arrivalDate: r.arrivalDate,
        departureDate: r.departureDate,
        totalAmount: r.totalAmount,
        currency: r.currency,
      })),
    };
  }

  /** Droit à l'effacement (RGPD) : anonymisation, l'historique comptable est conservé. */
  erase(id: string, actor: AuthUser) {
    return this.ds.transaction(async (m) => {
      const g = await m.findOne(Guest, { where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!g) throw notFound('Client');
      if (g.erasedAt) return toGuestDto(g);
      const active = await m.existsBy(Reservation, { guestId: id, status: In(ACTIVE_STATUSES) });
      if (active) throw invalidState('Le client a une réservation en cours ou à venir : annulez-la ou attendez le départ.');
      Object.assign(g, {
        firstName: 'ANONYMISÉ',
        lastName: 'ANONYMISÉ',
        email: null,
        phone: null,
        nationality: null,
        preferences: {},
        erasedAt: new Date(),
      });
      const saved = await m.save(g);
      await this.audit.log({ actorId: actor.id, action: 'guest.erased', entityType: 'guest', entityId: id }, m);
      return toGuestDto(saved);
    });
  }
}
