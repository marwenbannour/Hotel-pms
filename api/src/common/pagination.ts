import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import { appConfig } from '../config';
import { ProblemException } from './problem';

export class CursorQueryDto {
  @ApiPropertyOptional({ minimum: 1, maximum: appConfig.pagination.maxLimit, default: appConfig.pagination.defaultLimit })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(appConfig.pagination.maxLimit)
  limit?: number;

  @ApiPropertyOptional({ description: 'Jeton `nextCursor` de la page précédente' })
  @IsOptional() @IsString()
  cursor?: string;

  @ApiPropertyOptional({ description: 'Champs à renvoyer, séparés par des virgules (ex. id,status,guest)' })
  @IsOptional() @IsString()
  fields?: string;
}

export interface Page<T> {
  data: T[];
  nextCursor: string | null;
}

interface Cursor { s: string; v: string | number; id: string }

const encode = (c: Cursor) => Buffer.from(JSON.stringify(c)).toString('base64url');
function decode(raw: string, sort: string): Cursor {
  try {
    const c = JSON.parse(Buffer.from(raw, 'base64url').toString()) as Cursor;
    if (c.s !== sort || typeof c.id !== 'string') throw new Error();
    return c;
  } catch {
    throw new ProblemException(400, 'BAD_REQUEST', 'Curseur invalide ou incompatible avec le tri demandé.');
  }
}

export interface SortSpec {
  /** Valeur publique du paramètre sort, ex. "-arrival_date". */
  key: string;
  /** Expression SQL de la colonne, ex. "r.arrival_date". */
  column: string;
  /** Propriété de l'entité correspondante. */
  prop: string;
  desc: boolean;
}

/** Résout ?sort= à partir d'une liste blanche { arrival_date: ['r.arrival_date','arrivalDate'] }. */
export function resolveSort(
  raw: string | undefined,
  allowed: Record<string, [column: string, prop: string]>,
  fallback: string,
): SortSpec {
  const key = raw ?? fallback;
  const desc = key.startsWith('-');
  const name = desc ? key.slice(1) : key;
  const hit = allowed[name];
  if (!hit) throw new ProblemException(422, 'VALIDATION_FAILED', `Tri non supporté : ${name}. Valeurs : ${Object.keys(allowed).join(', ')}.`);
  return { key, column: hit[0], prop: hit[1], desc };
}

/** Pagination par curseur (keyset) stable : tri + id en départage. */
export async function paginate<T extends ObjectLiteral & { id: string }>(
  qb: SelectQueryBuilder<T>,
  sort: SortSpec,
  q: CursorQueryDto,
): Promise<Page<T>> {
  const limit = q.limit ?? appConfig.pagination.defaultLimit;
  const alias = qb.alias;
  if (q.cursor) {
    const c = decode(q.cursor, sort.key);
    qb.andWhere(`(${sort.column}, ${alias}.id) ${sort.desc ? '<' : '>'} (:__cv, :__cid)`, { __cv: c.v, __cid: c.id });
  }
  const dir = sort.desc ? 'DESC' : 'ASC';
  qb.orderBy(sort.column, dir).addOrderBy(`${alias}.id`, dir).limit(limit + 1);
  const rows = await qb.getMany();
  const hasMore = rows.length > limit;
  if (hasMore) rows.pop();
  const last = rows[rows.length - 1];
  let nextCursor: string | null = null;
  if (hasMore && last) {
    const v = (last as Record<string, unknown>)[sort.prop];
    nextCursor = encode({ s: sort.key, v: v instanceof Date ? v.toISOString() : (v as string | number), id: last.id });
  }
  return { data: rows, nextCursor };
}
