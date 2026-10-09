'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import logo from '@/components/hotelia-logo.jpg';
import { Lang, LANGS } from '@/lib/i18n';
import { useI18n } from '@/lib/lang-context';
import { persistLang } from '@/lib/lang-switch';
import { CHANGE_SERVER_URL, useInAndroidApp, useInNativeShell } from '@/lib/native-app';

type Step = 'credentials' | 'mfa' | 'enroll';
interface Problem { title?: string; detail?: string }

const field =
  'mt-1.5 block w-full rounded-lg border border-line bg-surface px-3.5 py-3 text-ink outline-none focus:border-gold focus:ring-2 focus:ring-gold/30';
/** Bouton principal de la charte HOTELIA : or, texte marine. */
const primary =
  'w-full rounded-lg bg-gold px-4 py-3 font-semibold text-navy transition-colors hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60';

/** Réseau coupé : réponse d'échec au lieu d'une exception, sinon le bouton resterait sur « Connexion… ». */
async function post(url: string, body: unknown, networkError: string) {
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, data };
  } catch {
    return { ok: false, data: { detail: networkError } };
  }
}

export default function LoginPage() {
  const { lang, t } = useI18n();
  // Dans l'application native, le changement de serveur se fait depuis son profil.
  const inNativeShell = useInNativeShell();
  const inApp = useInAndroidApp() && !inNativeShell;
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
    const { ok, data } = await post('/api/session/login', { email, password }, t.networkError);
    setBusy(false);
    ok ? next(data.step) : fail(data);
  }

  async function submitMfa(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { ok, data } = await post('/api/session/mfa', { code }, t.networkError);
    setBusy(false);
    ok ? next(data.step) : fail(data);
  }

  // Enrôlement : secret TOTP généré par l'API, affiché en QR code. La bibliothèque QR n'est chargée
  // qu'à cette étape (première connexion d'un profil à double authentification), pas pour chaque connexion.
  useEffect(() => {
    if (step !== 'enroll' || enroll) return;
    (async () => {
      const [{ ok, data }, { default: QRCode }] = await Promise.all([post('/api/v1/me/mfa/setup', {}, t.networkError), import('qrcode')]);
      if (!ok) return fail(data);
      const svg = await QRCode.toString(data.otpauthUrl, { type: 'svg', margin: 0, color: { dark: '#0d182a', light: '#ffffff' } });
      setEnroll({ secret: data.secret, svg });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  async function submitEnroll(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { ok, data } = await post('/api/v1/me/mfa/enable', { code }, t.networkError);
    if (!ok) {
      setBusy(false);
      return fail(data);
    }
    await post('/api/session/logout', {}, t.networkError);
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
    // Charte HOTELIA (comme l'écran de connexion de l'application mobile) : fond marine, logo, carte blanche.
    <main className="relative grid min-h-screen place-items-center bg-navy px-4 pt-[max(2.5rem,env(safe-area-inset-top))] pb-10">
      <select
        aria-label={t.language}
        value={lang}
        onChange={(e) => {
          persistLang(e.target.value as Lang);
          router.refresh();
        }}
        className="absolute end-4 top-[max(1rem,env(safe-area-inset-top))] rounded-lg border border-white/25 bg-navy px-2.5 py-1.5 text-[13px] text-white"
      >
        {LANGS.map((l) => (
          <option key={l} value={l}>
            {t.languageNames[l]}
          </option>
        ))}
      </select>

      <div className="w-full max-w-sm">
        <img src={logo.src} width={logo.width} height={logo.height} alt="HOTELIA Management" className="mx-auto h-auto w-44 mix-blend-lighten" />
        <div className="mt-6 mb-7 text-center">
          <h1 className="text-[28px] leading-9 font-semibold text-white">{t.welcome}</h1>
          <p className="mt-1 text-white/70">{t.signInSubtitle}</p>
        </div>

        <div className="rounded-2xl bg-surface p-6 shadow-xl">
        {notice && <p className="mb-4 rounded-lg bg-available-soft px-3 py-2 text-available-text">{notice}</p>}
        {error && (
          <p role="alert" className="mb-4 rounded-lg bg-maintenance/10 px-3 py-2 text-maintenance">
            {error}
          </p>
        )}

        {step === 'credentials' && (
          <form onSubmit={submitCredentials} className="space-y-4">
            <h2 className="sr-only">{t.signInTitle}</h2>
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

        {inApp && (
          <a href={CHANGE_SERVER_URL} className="mt-6 block text-center text-[14px] text-white/70 underline underline-offset-4 hover:text-white">
            {t.changeServer}
          </a>
        )}
      </div>
    </main>
  );
}
