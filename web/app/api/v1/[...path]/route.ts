import { NextRequest, NextResponse } from 'next/server';
import { API_URL, AT_COOKIE, clearSession, forwardedHeaders, refreshOnce, RT_COOKIE, setSession, TokenPair } from '@/lib/server/session';

export const dynamic = 'force-dynamic';

const REQUEST_HEADERS = ['content-type', 'if-match', 'idempotency-key'];
const RESPONSE_HEADERS = ['content-type', 'content-disposition', 'etag', 'idempotent-replayed', 'retry-after', 'x-request-id', 'api-version'];

/** Proxy authentifié vers l'API : ajoute le jeton d'accès depuis le cookie httpOnly. */
async function forward(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const url = `${API_URL}/v1/${path.map(encodeURIComponent).join('/')}${req.nextUrl.search}`;
  const body = req.method === 'GET' || req.method === 'HEAD' ? undefined : await req.arrayBuffer();
  const base = forwardedHeaders(req);
  for (const name of REQUEST_HEADERS) {
    const v = req.headers.get(name);
    if (v) base[name] = v;
  }

  const send = (token?: string) =>
    fetch(url, {
      method: req.method,
      headers: token ? { ...base, Authorization: `Bearer ${token}` } : base,
      body,
      cache: 'no-store',
      redirect: 'manual',
    });

  let res = await send(req.cookies.get(AT_COOKIE)?.value);
  const refreshToken = req.cookies.get(RT_COOKIE)?.value;
  let refreshed: TokenPair | null = null;
  let sessionLost = false;

  if (res.status === 401 && refreshToken) {
    refreshed = await refreshOnce(refreshToken, forwardedHeaders(req));
    if (refreshed) res = await send(refreshed.accessToken);
    else sessionLost = true;
  }

  const headers = new Headers();
  for (const name of RESPONSE_HEADERS) {
    const v = res.headers.get(name);
    if (v) headers.set(name, v);
  }
  const out = new NextResponse(res.status === 204 ? null : res.body, { status: res.status, headers });
  if (refreshed) setSession(out.cookies, refreshed);
  if (sessionLost || (res.status === 401 && !refreshed)) clearSession(out.cookies);
  return out;
}

export { forward as GET, forward as POST, forward as PATCH, forward as PUT, forward as DELETE };
