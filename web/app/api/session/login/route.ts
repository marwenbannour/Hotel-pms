import { NextRequest, NextResponse } from 'next/server';
import { API_URL, forwardedHeaders, setMfaPending, setSession } from '@/lib/server/session';

export async function POST(req: NextRequest) {
  const res = await fetch(`${API_URL}/v1/auth/login`, {
    method: 'POST',
    headers: { ...forwardedHeaders(req), 'Content-Type': 'application/json' },
    body: await req.text(),
    cache: 'no-store',
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) return NextResponse.json(body, { status: res.status });

  if (body.mfaRequired) {
    const out = NextResponse.json({ step: 'mfa' });
    setMfaPending(out.cookies, body.mfaToken);
    return out;
  }
  const out = NextResponse.json({ step: body.mfaEnrollmentRequired ? 'enroll' : 'done' });
  setSession(out.cookies, body);
  return out;
}
