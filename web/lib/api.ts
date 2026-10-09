'use client';

/** Erreur au format RFC 9457 renvoyée par l'API. */
export interface Problem {
  type?: string;
  title: string;
  status: number;
  detail?: string;
  code: string;
  traceId?: string;
}

export class ApiError extends Error {
  constructor(public readonly status: number, public readonly problem: Problem) {
    super(problem.detail ?? problem.title);
  }
}

export interface ApiResult<T> {
  data: T;
  etag: string | null;
}

/**
 * Appelle l'API via le proxy du serveur web (/api/v1/…) : les jetons restent dans
 * des cookies httpOnly et ne sont jamais accessibles au JavaScript du navigateur.
 */
export async function api<T>(
  path: string,
  init: { method?: string; json?: unknown; headers?: Record<string, string> } = {},
): Promise<ApiResult<T>> {
  const res = await fetch(`/api/v1${path}`, {
    method: init.method ?? 'GET',
    headers: { ...(init.json !== undefined ? { 'Content-Type': 'application/json' } : {}), ...init.headers },
    body: init.json !== undefined ? JSON.stringify(init.json) : undefined,
    cache: 'no-store',
  });
  if (res.status === 401) {
    window.location.assign('/login');
    throw new ApiError(401, { title: 'Session expirée', status: 401, code: 'UNAUTHENTICATED' });
  }
  const body = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(res.status, body ?? { title: res.statusText, status: res.status, code: 'INTERNAL' });
  }
  return { data: body as T, etag: res.headers.get('etag') };
}

/**
 * UUID v4. crypto.randomUUID n'existe qu'en contexte sécurisé (HTTPS ou localhost) : servie en
 * http:// sur le réseau de l'hôtel (application Android), l'application le construit à partir de
 * crypto.getRandomValues, disponible partout.
 */
export function newIdempotencyKey(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
