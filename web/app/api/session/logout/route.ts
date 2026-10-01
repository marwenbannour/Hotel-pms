import { NextRequest, NextResponse } from 'next/server';
import { API_URL, clearSession, forwardedHeaders, RT_COOKIE } from '@/lib/server/session';

export async function POST(req: NextRequest) {
  const refreshToken = req.cookies.get(RT_COOKIE)?.value;
  if (refreshToken) {
    await fetch(`${API_URL}/v1/auth/logout`, {
      method: 'POST',
      headers: { ...forwardedHeaders(req), 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
      cache: 'no-store',
    }).catch(() => undefined);
  }
  const out = new NextResponse(null, { status: 204 });
  clearSession(out.cookies);
  return out;
}
