'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BedDouble, CalendarDays, ReceiptText, ChartColumn, ConciergeBell, House, LayoutGrid, LogIn, LogOut, Menu, Settings, Sparkles, UserCog, Users, Utensils, X,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import logo from '@/components/hotelia-logo.jpg';
import { api } from '@/lib/api';
import { ADMIN } from '@/lib/i18n-admin';
import { localToday } from '@/lib/dates';
import { Lang, LANGS } from '@/lib/i18n';
import { useI18n } from '@/lib/lang-context';
import { persistLang } from '@/lib/lang-switch';
import { useLiveUpdates, useOffline } from '@/lib/live';
import { CHANGE_SERVER_URL, useInAndroidApp, useInNativeShell } from '@/lib/native-app';
import { useServiceWorker } from '@/lib/pwa';
import type { Me, MenuEntry } from '@/lib/types';

const ICONS: Record<string, React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>> = {
  home: House, concierge: ConciergeBell, calendar: CalendarDays, grid: LayoutGrid, users: Users, sparkles: Sparkles,
  utensils: Utensils, chart: ChartColumn, receipt: ReceiptText, settings: Settings, bed: BedDouble, menu: Menu, 'user-cog': UserCog, 'log-in': LogIn, 'log-out': LogOut,
};

export function useMe() {
  return useQuery({ queryKey: ['me'], queryFn: async () => (await api<Me>('/me')).data, staleTime: 5 * 60_000 });
}

/** Menu du profil (filtré par l'API selon les droits), partagé par le menu latéral et les liens des écrans. */
export function useNavigation() {
  const { lang } = useI18n();
  return useQuery({
    queryKey: ['navigation', lang],
    queryFn: async () => (await api<{ items: MenuEntry[] }>('/me/navigation')).data,
    staleTime: 5 * 60_000,
  });
}

/** Écrans auxquels le profil a accès : un lien n'est affiché que s'il mène quelque part. */
export function useAllowedPaths(): Set<string> {
  const nav = useNavigation();
  return new Set(leaves(nav.data?.items ?? []).map((i) => i.path!));
}

/**
 * Date du jour de l'établissement (fuseau de l'hôtel), fournie par l'API.
 * L'horloge du poste ne sert qu'en attendant la réponse.
 */
export function useHotelToday(): string {
  const me = useMe();
  return me.data?.hotel.today ?? localToday();
}

function NavItems({ items, pathname, depth = 0, onNavigate }: { items: MenuEntry[]; pathname: string; depth?: number; onNavigate: () => void }) {
  return (
    <ul className={depth ? 'ms-7 mt-1 space-y-0.5 border-s border-white/15 ps-3' : 'space-y-1'}>
      {items.map((item) => {
        const Icon = item.icon ? ICONS[item.icon] : undefined;
        const active = item.path === pathname;
        const content = (
          <>
            {Icon && depth === 0 && <Icon className="size-[18px] shrink-0" aria-hidden />}
            <span>{item.label}</span>
          </>
        );
        return (
          <li key={item.key}>
            {item.path ? (
              <Link
                href={item.path}
                onClick={onNavigate}
                aria-current={active ? 'page' : undefined}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors ${
                  active ? 'bg-gold font-medium text-navy' : 'text-white/75 hover:bg-white/8 hover:text-white'
                }`}
              >
                {content}
              </Link>
            ) : (
              <span className="flex items-center gap-3 px-3 pt-3 pb-1 text-[13px] text-white/55">{content}</span>
            )}
            {item.children.length > 0 && <NavItems items={item.children} pathname={pathname} depth={depth + 1} onNavigate={onNavigate} />}
          </li>
        );
      })}
    </ul>
  );
}

/** Entrées du menu qui mènent à un écran, dans l'ordre du menu (les groupes sont dépliés). */
function leaves(items: MenuEntry[]): MenuEntry[] {
  return items.flatMap((i) => [...(i.path ? [i] : []), ...leaves(i.children)]);
}

/** Onglets affichés en bas de l'écran sur téléphone ; le reste du menu est sous « Plus ». */
const TABS = 4;

/**
 * Barre d'onglets du téléphone : les premiers écrans du menu du profil (ménage : tableau de bord
 * et ménage ; réception : arrivées, départs…), au pouce, comme une application installée.
 */
function TabBar({ items, pathname, onMore }: { items: MenuEntry[]; pathname: string; onMore: () => void }) {
  const { t } = useI18n();
  const tabs = leaves(items).slice(0, TABS);
  const tabClass = 'flex min-w-0 flex-1 flex-col items-center justify-start gap-0.5 px-1 pt-2 pb-1.5 text-[11px] leading-tight';
  return (
    <nav
      aria-label={t.quickNav}
      className="fixed inset-x-0 bottom-0 z-[15] flex border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden print:hidden"
    >
      {tabs.map((item) => {
        const Icon = (item.icon && ICONS[item.icon]) || LayoutGrid;
        const active = item.path === '/' ? pathname === '/' : pathname === item.path || pathname.startsWith(`${item.path}/`);
        return (
          <Link
            key={item.key}
            href={item.path!}
            aria-current={active ? 'page' : undefined}
            className={`${tabClass} ${active ? 'font-medium text-ink' : 'text-ink-soft'}`}
          >
            <Icon className={`size-[22px] ${active ? 'text-brass' : ''}`} aria-hidden />
            <span className="line-clamp-2 w-full text-center break-words">{item.label}</span>
          </Link>
        );
      })}
      <button onClick={onMore} className={`${tabClass} text-ink-soft`}>
        <Menu className="size-[22px]" aria-hidden />
        <span>{t.more}</span>
      </button>
    </nav>
  );
}

export function Shell({ langChosen, children }: { langChosen: boolean; children: React.ReactNode }) {
  const { lang, t } = useI18n();
  const pathname = usePathname();
  const router = useRouter();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const me = useMe();
  const nav = useNavigation();
  useLiveUpdates();
  useServiceWorker();
  const inNativeShell = useInNativeShell();
  // Dans l'application native, le changement de serveur se fait depuis son profil.
  const inApp = useInAndroidApp() && !inNativeShell;
  const offline = useOffline();

  // Première visite : la langue suit le profil de l'utilisateur (ex. arabe pour l'équipe ménage).
  useEffect(() => {
    if (!langChosen && me.data) {
      persistLang(me.data.locale);
      if (me.data.locale !== lang) router.refresh();
      else qc.invalidateQueries({ queryKey: ['dashboard'] });
    }
  }, [langChosen, me.data, lang, router, qc]);

  const changeLang = (next: Lang) => {
    persistLang(next);
    qc.invalidateQueries();
    router.refresh();
  };

  const signOut = async () => {
    await fetch('/api/session/logout', { method: 'POST' });
    qc.clear();
    router.replace('/login');
  };

  // Écran de l'application native : elle fournit l'en-tête, les onglets et le bandeau hors ligne.
  if (inNativeShell) {
    return <main className="px-4 py-4 print:p-0">{children}</main>;
  }

  return (
    // --tabbar : hauteur de la barre d'onglets du téléphone, pour ce qui est fixé en bas de l'écran.
    <div className="min-h-screen max-lg:[--tabbar:calc(4.25rem+env(safe-area-inset-bottom))] lg:grid lg:grid-cols-[256px_1fr] print:block">
      <aside
        className={`print:hidden fixed inset-y-0 start-0 z-30 w-[256px] bg-navy text-white transition-transform lg:sticky lg:top-0 lg:h-screen ${
          open ? '' : 'max-lg:ltr:-translate-x-full max-lg:rtl:translate-x-full'
        }`}
      >
        <div className="flex h-full flex-col px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <div className="relative mb-6 flex justify-center">
            {/* Logo HOTELIA (cloche, nom, étoiles), toujours sur fond marine ; « lighten » fond son cadre dans le menu. */}
            <img src={logo.src} width={logo.width} height={logo.height} alt="HOTELIA Management" className="h-auto w-[150px] mix-blend-lighten" />
            <button className="absolute end-0 top-0 rounded p-1 lg:hidden" onClick={() => setOpen(false)} aria-label={t.back}>
              <X className="size-5" aria-hidden />
            </button>
          </div>
          <nav aria-label={t.menu} className="-mx-1 flex-1 overflow-y-auto px-1">
            {nav.data && <NavItems items={nav.data.items} pathname={pathname} onNavigate={() => setOpen(false)} />}
          </nav>
          <div className="mt-4 rounded-xl bg-navy-700 p-3 text-[13px]">
            {me.data && (
              <div className="flex items-center gap-3">
                <span
                  className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gold/15 font-display text-[15px] font-semibold text-gold ring-1 ring-gold"
                  aria-hidden
                >
                  {me.data.fullName.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[14px] font-medium text-white">{me.data.fullName}</span>
                  <span className="block truncate text-white/60">
                    {ADMIN[lang].roles[me.data.role as keyof (typeof ADMIN)['fr']['roles']] ?? me.data.role}
                  </span>
                </span>
              </div>
            )}
            <label className="mt-3 flex items-center justify-between gap-2 text-white/60">
              {t.language}
              <select
                value={lang}
                onChange={(e) => changeLang(e.target.value as Lang)}
                className="rounded border border-white/20 bg-transparent px-2 py-1 text-white"
              >
                {LANGS.map((l) => (
                  <option key={l} value={l} className="text-ink">
                    {t.languageNames[l]}
                  </option>
                ))}
              </select>
            </label>
            <button onClick={signOut} className="mt-3 flex items-center gap-2 text-white/70 hover:text-white">
              <LogOut className="size-4 rtl:rotate-180" aria-hidden />
              {t.signOut}
            </button>
            {inApp && (
              <a href={CHANGE_SERVER_URL} className="mt-3 block text-white/60 underline-offset-4 hover:text-white hover:underline">
                {t.changeServer}
              </a>
            )}
          </div>
        </div>
      </aside>
      {open && <div className="fixed inset-0 z-20 bg-ink/40 lg:hidden" onClick={() => setOpen(false)} aria-hidden />}

      <div className="min-w-0">
        <div className="flex items-center gap-3 border-b border-line bg-surface px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 lg:hidden print:hidden">
          <button onClick={() => setOpen(true)} aria-label={t.openMenu} className="rounded p-1">
            <Menu className="size-5" aria-hidden />
          </button>
          <span className="font-semibold">{t.appName}</span>
        </div>
        {offline && (
          <p role="status" className="sticky top-0 z-10 border-b border-brass bg-brass-soft px-4 py-2 text-[14px] print:hidden">
            {t.offline}
          </p>
        )}
        <main className="mx-auto max-w-[1360px] px-4 py-6 max-lg:pb-[calc(var(--tabbar)+1.5rem)] sm:px-6 lg:px-10 lg:py-8 print:max-w-none print:p-0">{children}</main>
      </div>
      {nav.data && <TabBar items={nav.data.items} pathname={pathname} onMore={() => setOpen(true)} />}
    </div>
  );
}
