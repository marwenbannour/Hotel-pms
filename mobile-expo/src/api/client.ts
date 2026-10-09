/**
 * Appels à l'API de l'hôtel, par le serveur web (/api/v1/… et /api/session/…), comme
 * l'application web : les jetons restent dans des cookies httpOnly, gardés par le téléphone et
 * partagés avec les écrans encore affichés en WebView.
 */

/** Erreur au format RFC 9457 renvoyée par l'API. */
export interface Problem {
  title: string;
  status: number;
  detail?: string;
  code: string;
  errors?: { field: string; messages: string[] }[];
}

export class ApiError extends Error {
  constructor(public readonly status: number, public readonly problem: Problem) {
    super(problem.detail ?? problem.title);
  }
}

let origin = '';
let onUnauthorized: () => void = () => undefined;

/** Adresse du serveur choisie au premier lancement (ex. http://192.168.1.10:3001). */
export const setOrigin = (value: string) => {
  origin = value.replace(/\/$/, '');
};
export const getOrigin = () => origin;
/** Session perdue (401) : l'application revient à la connexion. */
export const setUnauthorizedHandler = (fn: () => void) => {
  onUnauthorized = fn;
};

const TIMEOUT_MS = 15_000;

async function request(url: string, init: RequestInit): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, credentials: 'include', signal: ctrl.signal });
  } catch (e) {
    throw new ApiError(0, { title: 'Réseau indisponible', status: 0, code: 'NETWORK', detail: e instanceof Error ? e.message : undefined });
  } finally {
    clearTimeout(timer);
  }
}

async function parse<T>(res: Response): Promise<T> {
  const body = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, body ?? { title: `HTTP ${res.status}`, status: res.status, code: 'INTERNAL' });
  return body as T;
}

export interface ApiResult<T> {
  data: T;
  etag: string | null;
}

export async function api<T>(
  path: string,
  init: { method?: string; json?: unknown; headers?: Record<string, string> } = {},
): Promise<ApiResult<T>> {
  const res = await request(`${origin}/api/v1${path}`, {
    method: init.method ?? 'GET',
    headers: { Accept: 'application/json', ...(init.json !== undefined ? { 'Content-Type': 'application/json' } : {}), ...init.headers },
    body: init.json !== undefined ? JSON.stringify(init.json) : undefined,
  });
  if (res.status === 401) {
    onUnauthorized();
    throw new ApiError(401, { title: 'Session expirée', status: 401, code: 'UNAUTHENTICATED' });
  }
  return { data: await parse<T>(res), etag: res.headers.get('etag') };
}

export type SignInStep = 'done' | 'mfa' | 'enroll';

/** Connexion : mot de passe, puis code à 6 chiffres si le profil l'exige. */
export const session = {
  login: async (email: string, password: string) =>
    parse<{ step: SignInStep }>(
      await request(`${origin}/api/session/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) }),
    ),
  mfa: async (code: string) =>
    parse<{ step: 'done' }>(
      await request(`${origin}/api/session/mfa`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }) }),
    ),
  logout: async () => {
    await request(`${origin}/api/session/logout`, { method: 'POST' }).catch(() => undefined);
  },
};

/** Message lisible pour une erreur de l'API (le détail est déjà traduit par le serveur). */
export const errorMessage = (e: unknown) => (e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e));
