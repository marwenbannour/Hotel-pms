'use client';

import { useRouter } from 'next/navigation';
import QRCode from 'qrcode';
import { FormEvent, useEffect, useState } from 'react';
import { Lang, LANGS } from '@/lib/i18n';
import { useI18n } from '@/lib/lang-context';
import { persistLang } from '@/lib/lang-switch';

type Step = 'credentials' | 'mfa' | 'enroll';
interface Problem { title?: string; detail?: string }

const field = 'mt-1 block w-full rounded-md border border-line bg-surface px-3 py-2.5 text-ink outline-none focus:border-brass';
const primary =
  'w-full rounded-md bg-ink px-4 py-2.5 font-medium text-white transition-colors hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-60';

async function post(url: string, body: unknown) {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}

export default function LoginPage() {
  const { lang, t } = useI18n();
  const router = useRouter();
  const [step, setStep] = useState<Step>('credentials');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [enroll, setEnroll] = useState<{ secret: string; svg: string } | null>(null);

  const fail = (p: Problem) => setError(p.detail ?? p.title ?? t.loadError);

  const next = (s: string) => {
    setCode('');
    if (s === 'done') router.replace('/');
    else setStep(s as Step);
  };

  async function submitCredentials(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    const { ok, data } = await post('/api/session/login', { email, password });
    setBusy(false);
    ok ? next(data.step) : fail(data);
  }

  async function submitMfa(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { ok, data } = await post('/api/session/mfa', { code });
    setBusy(false);
    ok ? next(data.step) : fail(data);
  }

  // Enrôlement : secret TOTP généré par l'API, affiché en QR code.
  useEffect(() => {
    if (step !== 'enroll' || enroll) return;
    (async () => {
      const { ok, data } = await post('/api/v1/me/mfa/setup', {});
      if (!ok) return fail(data);
      const svg = await QRCode.toString(data.otpauthUrl, { type: 'svg', margin: 0, color: { dark: '#16324f', light: '#ffffff' } });
      setEnroll({ secret: data.secret, svg });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  async function submitEnroll(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { ok, data } = await post('/api/v1/me/mfa/enable', { code });
    if (!ok) {
      setBusy(false);
      return fail(data);
    }
    await fetch('/api/session/logout', { method: 'POST' });
    setBusy(false);
    setEnroll(null);
    setPassword('');
    setCode('');
    setStep('credentials');
    setNotice(t.enrollDone);
  }

  const codeInput = (
    <label className="block">
      <span className="text-ink-soft">{t.mfaTitle}</span>
      <input
        className={`${field} text-center text-xl tracking-[0.4em]`}
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]{6}"
        maxLength={6}
        required
        autoFocus
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
      />
    </label>
  );

  return (
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">{t.appName}</h1>
          <select
            aria-label={t.language}
            value={lang}
            onChange={(e) => {
              persistLang(e.target.value as Lang);
              router.refresh();
            }}
            className="rounded border border-line bg-surface px-2 py-1 text-[13px]"
          >
            {LANGS.map((l) => (
              <option key={l} value={l}>
                {t.languageNames[l]}
              </option>
            ))}
          </select>
        </div>

        {notice && <p className="mb-4 rounded-md bg-available/10 px-3 py-2 text-available">{notice}</p>}
        {error && (
          <p role="alert" className="mb-4 rounded-md bg-maintenance/10 px-3 py-2 text-maintenance">
            {error}
          </p>
        )}

        {step === 'credentials' && (
          <form onSubmit={submitCredentials} className="space-y-4">
            <h2 className="text-[17px] font-medium">{t.signInTitle}</h2>
            <label className="block">
              <span className="text-ink-soft">{t.email}</span>
              <input className={field} type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" />
            </label>
            <label className="block">
              <span className="text-ink-soft">{t.password}</span>
              <input className={field} type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} dir="ltr" />
            </label>
            <button className={primary} disabled={busy}>{busy ? t.signingIn : t.signIn}</button>
          </form>
        )}

        {step === 'mfa' && (
          <form onSubmit={submitMfa} className="space-y-4">
            <p className="text-ink-soft">{t.mfaHelp}</p>
            {codeInput}
            <button className={primary} disabled={busy || code.length !== 6}>{t.mfaVerify}</button>
            <button type="button" className="w-full text-ink-soft underline underline-offset-4" onClick={() => setStep('credentials')}>
              {t.back}
            </button>
          </form>
        )}

        {step === 'enroll' && (
          <form onSubmit={submitEnroll} className="space-y-4">
            <h2 className="text-[17px] font-medium">{t.enrollTitle}</h2>
            <p className="text-ink-soft">{t.enrollHelp}</p>
            {enroll && (
              <>
                <div className="mx-auto w-44 rounded-md border border-line bg-white p-3" dangerouslySetInnerHTML={{ __html: enroll.svg }} />
                <p className="text-center text-[13px] text-ink-soft">
                  {t.enrollSecret}
                  <br />
                  <code dir="ltr" className="select-all break-all text-ink">{enroll.secret}</code>
                </p>
              </>
            )}
            {codeInput}
            <button className={primary} disabled={busy || code.length !== 6 || !enroll}>{t.enrollConfirm}</button>
          </form>
        )}
      </div>
    </main>
  );
}
