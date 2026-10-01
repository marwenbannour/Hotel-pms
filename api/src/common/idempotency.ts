import { CallHandler, ExecutionContext, Injectable, NestInterceptor, SetMetadata } from '@nestjs/common';
import { HTTP_CODE_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { InjectDataSource } from '@nestjs/typeorm';
import { createHash } from 'crypto';
import type { Request, Response } from 'express';
import { catchError, from, mergeMap, Observable, of, throwError } from 'rxjs';
import { DataSource, QueryFailedError } from 'typeorm';
import { appConfig } from '../config';
import { IdempotencyRecord } from '../database/entities';
import { ProblemException } from './problem';

const IDEMPOTENT = 'idempotent';
/** L'en-tête Idempotency-Key est obligatoire sur la route (section 22.1). */
export const Idempotent = () => SetMetadata(IDEMPOTENT, true);

const isUniqueViolation = (e: unknown) =>
  e instanceof QueryFailedError && (e as QueryFailedError & { driverError?: { code?: string } }).driverError?.code === '23505';

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector, @InjectDataSource() private readonly ds: DataSource) {}

  async intercept(ctx: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    if (!this.reflector.get<boolean>(IDEMPOTENT, ctx.getHandler())) return next.handle();

    const req = ctx.switchToHttp().getRequest<Request>();
    const res = ctx.switchToHttp().getResponse<Response>();
    const key = req.header('idempotency-key');
    if (!key) throw new ProblemException(400, 'IDEMPOTENCY_KEY_MISSING');
    if (key.length > 255) throw new ProblemException(400, 'BAD_REQUEST', 'Idempotency-Key : 255 caractères maximum.');

    const userId = req.user!.id;
    const route = `${req.method} ${req.baseUrl}${req.path}`;
    const requestHash = createHash('sha256').update(JSON.stringify(req.body ?? {})).digest('hex');
    const repo = this.ds.getRepository(IdempotencyRecord);
    const defaultStatus =
      this.reflector.get<number>(HTTP_CODE_METADATA, ctx.getHandler()) ?? (req.method === 'POST' ? 201 : 200);

    // Purge paresseuse des clés expirées.
    await repo
      .createQueryBuilder()
      .delete()
      .where(`created_at < now() - make_interval(hours => :h)`, { h: appConfig.idempotencyTtlHours })
      .execute();

    try {
      await repo.insert({ userId, key, route, requestHash, state: 'processing' });
    } catch (e) {
      if (!isUniqueViolation(e)) throw e;
      const existing = await repo.findOneByOrFail({ userId, key });
      if (existing.route !== route || existing.requestHash !== requestHash) {
        throw new ProblemException(422, 'IDEMPOTENCY_KEY_REUSED');
      }
      if (existing.state === 'processing') throw new ProblemException(409, 'IDEMPOTENCY_IN_PROGRESS');
      res.status(existing.responseStatus ?? defaultStatus);
      res.setHeader('Idempotent-Replayed', 'true');
      return of(existing.responseBody);
    }

    return next.handle().pipe(
      mergeMap(async (body) => {
        await repo.update({ userId, key }, { state: 'completed', responseStatus: defaultStatus, responseBody: body as object });
        return body;
      }),
      catchError((err) => from(repo.delete({ userId, key })).pipe(mergeMap(() => throwError(() => err)))),
    );
  }
}
