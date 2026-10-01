import 'server-only';
import type { NextRequest, NextResponse } from 'next/server';
import { LANG_COOKIE } from '../i18n';

type ResponseCookies = NextResponse['cookies'];

export const API_URL = (process.env.API_URL ?? 'http://localhost:3000').replace(/\/$/, '');
export const AT_COOKIE = 'pms_at';
export const RT_COOKIE = 'pms_rt';
export const MFA_COOKIE = 'pms_mfa';

const secure = process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === 'true' : process.env.NODE_ENV === 'production';
const base = { httpOnly: true, secure, sameSite: 'lax' as const, path: '/' };

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  mfaEnrollmentRequired: boolean;
}

export function setSession(cookies: ResponseCookies, t: TokenPair) {
  cookies.set(AT_COOKIE, t.accessToken, { ...base, maxAge: t.expiresIn });
  cookies.set(RT_COOKIE, t.refreshToken, { ...base, maxAge: 30 * 86400 });
}

export function clearSession(cookies: ResponseCookies) {
  for (const name of [AT_COOKIE, RT_COOKIE, MFA_COOKIE]) cookies.set(name, '', { ...base, maxAge: 0 });
}

export function setMfaPending(cookies: ResponseCookies, mfaToken: string) {
  cookies.set(MFA_COOKIE, mfaToken, { ...base, maxAge: 300 });
}

/** En-têtes transmis à l'API : adresse du client (limitation de débit) et langue. */
export function forwardedHeaders(req: NextRequest): Record<string, string> {
  const h: Record<string, string> = {};
  const xff = req.headers.get('x-forwarded-for');
  if (xff) h['X-Forwarded-For'] = xff;
  // Langue de l'interface ; à défaut, l'API applique la langue du profil (pas celle du navigateur).
  const lang = req.cookies.get(LANG_COOKIE)?.value;
  if (lang) h['Accept-Language'] = lang;
  const requestId = req.headers.get('x-request-id');
  if (requestId) h['X-Request-Id'] = requestId;
  return h;
}

/**
 * Rafraîchissement dédoublonné : les requêtes simultanées qui présentent le même jeton
 * partagent un seul appel à /auth/refresh. Sans cela, l'API détecterait une réutilisation
 * du jeton et révoquerait la session. Le résultat est conservé 30 s pour les retardataires.
 * Portée : une instance du serveur web ; en multi-instances, activer l'affinité de session.
 */
const inflight = new Map<string, Promise<TokenPair | null>>();

export function refreshOnce(refreshToken: string, headers: Record<string, string>): Promise<TokenPair | null> {
  const existing = inflight.get(refreshToken);
  if (existing) return existing;
  const p = fetch(`${API_URL}/v1/auth/refresh`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
    cache: 'no-store',
  })
    .then(async (res) => (res.ok ? ((await res.json()) as TokenPair) : null))
    .catch(() => null);
  inflight.set(refreshToken, p);
  setTimeout(() => inflight.delete(refreshToken), 30_000).unref?.();
  return p;
}
