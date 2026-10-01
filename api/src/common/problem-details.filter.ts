import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { QueryFailedError } from 'typeorm';
import { appConfig } from '../config';
import { errorTitle, pickLang } from './i18n';
import { ErrorCode, ProblemException } from './problem';

const STATUS_CODES: Record<number, ErrorCode> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHENTICATED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  412: 'PRECONDITION_FAILED',
  422: 'VALIDATION_FAILED',
  428: 'PRECONDITION_REQUIRED',
  429: 'RATE_LIMITED',
};

/** Convertit toute erreur au format Problem Details (RFC 9457), section 22.4. */
@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Errors');

  catch(ex: unknown, host: ArgumentsHost) {
    const req = host.switchToHttp().getRequest<Request>();
    const res = host.switchToHttp().getResponse<Response>();
    const lang = pickLang(req.headers['accept-language']);

    let status = 500;
    let code: ErrorCode = 'INTERNAL';
    let detail: string | undefined;
    let extra: Record<string, unknown> | undefined;

    if (ex instanceof ProblemException) {
      ({ status, code, detail, extra } = ex);
    } else if (ex instanceof ThrottlerException) {
      status = 429;
      code = 'RATE_LIMITED';
    } else if (ex instanceof HttpException) {
      status = ex.getStatus();
      code = STATUS_CODES[status] ?? (status >= 500 ? 'INTERNAL' : 'BAD_REQUEST');
      const body = ex.getResponse();
      const message = typeof body === 'object' ? (body as { message?: unknown }).message : body;
      if (typeof message === 'string' && status < 500) detail = message;
    } else if (ex instanceof QueryFailedError) {
      const pgCode = (ex as QueryFailedError & { driverError?: { code?: string } }).driverError?.code;
      if (pgCode === '23P01') {
        status = 409;
        code = 'ROOM_UNAVAILABLE';
        detail = 'La chambre est déjà attribuée sur tout ou partie de ces dates.';
      } else if (pgCode === '23505') {
        status = 409;
        code = 'CONFLICT';
        detail = 'Une ressource avec cet identifiant métier existe déjà.';
      } else if (pgCode === 'P0001') {
        // Déclencheur d'inaltérabilité (factures, encaissements).
        status = 409;
        code = 'INVOICE_LOCKED';
        detail = (ex as QueryFailedError).message;
      } else if (pgCode === '23503') {
        status = 422;
        code = 'VALIDATION_FAILED';
        detail = 'Une ressource référencée n’existe pas.';
      }
    }

    if (status >= 500) {
      this.logger.error({ traceId: req.requestId, path: req.path, err: String(ex), stack: (ex as Error)?.stack });
    }

    res
      .status(status)
      .type('application/problem+json')
      .json({
        type: `${appConfig.publicBaseUrl}/errors/${code.toLowerCase().replace(/_/g, '-')}`,
        title: errorTitle(code, lang),
        status,
        ...(detail ? { detail } : {}),
        code,
        traceId: req.requestId,
        ...(extra ?? {}),
      });
  }
}
