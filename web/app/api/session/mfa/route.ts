import { NextRequest, NextResponse } from 'next/server';
import { API_URL, forwardedHeaders, MFA_COOKIE, setSession } from '@/lib/server/session';

export async function POST(req: NextRequest) {
  const { code } = await req.json().catch(() => ({ code: '' }));
  const res = await fetch(`${API_URL}/v1/auth/mfa/verify`, {
    method: 'POST',
    headers: { ...forwardedHeaders(req), 'Content-Type': 'application/json' },
    body: JSON.stringify({ mfaToken: req.cookies.get(MFA_COOKIE)?.value ?? '', code }),
    cache: 'no-store',
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) return NextResponse.json(body, { status: res.status });
  const out = NextResponse.json({ step: 'done' });
  setSession(out.cookies, body);
  out.cookies.delete(MFA_COOKIE);
  return out;
}
