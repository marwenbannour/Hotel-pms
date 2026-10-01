import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import type { Request, Response } from 'express';
import { map, Observable } from 'rxjs';
import { etagOf } from './etag';

function pick(obj: unknown, fields: string[]): unknown {
  if (!obj || typeof obj !== 'object') return obj;
  const src = obj as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const f of ['id', ...fields]) if (f in src) out[f] = src[f];
  return out;
}

/**
 * - pose l'ETag des ressources unitaires versionnées ;
 * - applique la sélection de champs ?fields= (section 22.5).
 */
@Injectable()
export class ResponseShapingInterceptor implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = ctx.switchToHttp().getRequest<Request>();
    const res = ctx.switchToHttp().getResponse<Response>();
    const fieldsParam = typeof req.query.fields === 'string' ? req.query.fields : undefined;
    const fields = fieldsParam?.split(',').map((f) => f.trim()).filter(Boolean);

    return next.handle().pipe(
      map((body) => {
        if (!body || typeof body !== 'object') return body;
        const b = body as Record<string, unknown>;
        if (Array.isArray(b.data)) {
          return fields ? { ...b, data: b.data.map((row) => pick(row, fields)) } : body;
        }
        if (typeof b.version === 'number' && !res.headersSent) res.setHeader('ETag', etagOf(b.version));
        return fields ? pick(body, fields) : body;
      }),
    );
  }
}
