import { CallHandler, ExecutionContext, Injectable, NestInterceptor, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { Observable, tap } from 'rxjs';
import { EventsService, Topic } from './events.service';

const EMITS = 'emits';

/**
 * Signale la modification aux écrans connectés une fois l'opération réussie (transaction validée).
 * L'identifiant publié est le paramètre :id de la route, à défaut celui de la ressource renvoyée.
 */
export const Emits = (...topics: [Topic, ...Topic[]]) => SetMetadata(EMITS, topics);

@Injectable()
export class ChangeEventsInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector, private readonly events: EventsService) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const topics = this.reflector.get<Topic[]>(EMITS, ctx.getHandler());
    if (!topics) return next.handle();
    const req = ctx.switchToHttp().getRequest<Request>();
    return next.handle().pipe(
      tap((body) => {
        const fromBody = body && typeof body === 'object' ? (body as { id?: unknown }).id : undefined;
        const param = req.params.id;
        const id = typeof param === 'string' ? param : typeof fromBody === 'string' ? fromBody : undefined;
        this.events.publish({ topics, id });
      }),
    );
  }
}
