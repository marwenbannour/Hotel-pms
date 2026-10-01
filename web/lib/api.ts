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

export const newIdempotencyKey = () => crypto.randomUUID();
