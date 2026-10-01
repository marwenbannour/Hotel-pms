/** Codes d'erreur stables exposés dans le champ `code` (RFC 9457 + extension). */
export type ErrorCode =
  | 'VALIDATION_FAILED'
  | 'BAD_REQUEST'
  | 'UNAUTHENTICATED'
  | 'INVALID_CREDENTIALS'
  | 'INVALID_TOKEN'
  | 'MFA_REQUIRED'
  | 'MFA_INVALID_CODE'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'NO_AVAILABILITY'
  | 'ROOM_UNAVAILABLE'
  | 'INVALID_STATE'
  | 'CONFLICT'
  | 'PRECONDITION_REQUIRED'
  | 'PRECONDITION_FAILED'
  | 'IDEMPOTENCY_KEY_MISSING'
  | 'IDEMPOTENCY_KEY_REUSED'
  | 'IDEMPOTENCY_IN_PROGRESS'
  | 'BALANCE_DUE'
  | 'INVOICE_LOCKED'
  | 'RATE_LIMITED'
  | 'INTERNAL';

export class ProblemException extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ErrorCode,
    public readonly detail?: string,
    public readonly extra?: Record<string, unknown>,
  ) {
    super(detail ?? code);
  }
}

export const notFound = (what: string) => new ProblemException(404, 'NOT_FOUND', `${what} introuvable.`);
export const invalidState = (detail: string) => new ProblemException(409, 'INVALID_STATE', detail);
