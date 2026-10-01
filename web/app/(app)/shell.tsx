'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BedDouble, CalendarDays, ReceiptText, ChartColumn, ConciergeBell, House, LayoutGrid, LogIn, LogOut, Menu, Settings, Sparkles, Users, Utensils, X,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { localToday } from '@/lib/dates';
import { Lang, LANGS } from '@/lib/i18n';
import { useI18n } from '@/lib/lang-context';
import { persistLang } from '@/lib/lang-switch';
import type { Me, MenuEntry } from '@/lib/types';

const ICONS: Record<string, React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>> = {
  home: House, concierge: ConciergeBell, calendar: CalendarDays, grid: LayoutGrid, users: Users, sparkles: Sparkles,
  utensils: Utensils, chart: ChartColumn, receipt: ReceiptText, settings: Settings, bed: BedDouble, menu: Menu, 'log-in': LogIn, 'log-out': LogOut,
};

export function useMe() {
  return useQuery({ queryKey: ['me'], queryFn: async () => (await api<Me>('/me')).data, staleTime: 5 * 60_000 });
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
            {Icon && depth === 0 && <Icon className="size-[18px] shrink-0 opacity-80" aria-hidden />}
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
                className={`flex items-center gap-3 rounded-md px-3 py-2 transition-colors ${
                  active ? 'bg-white/12 font-medium text-white' : 'text-white/75 hover:bg-white/6 hover:text-white'
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

export function Shell({ langChosen, children }: { langChosen: boolean; children: React.ReactNode }) {
  const { lang, t } = useI18n();
  const pathname = usePathname();
  const router = useRouter();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const me = useMe();
  const nav = useQuery({
    queryKey: ['navigation', lang],
    queryFn: async () => (await api<{ items: MenuEntry[] }>('/me/navigation')).data,
    staleTime: 5 * 60_000,
  });

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

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[248px_1fr] print:block">
      <aside
        className={`print:hidden fixed inset-y-0 start-0 z-30 w-[248px] bg-ink text-white transition-transform lg:sticky lg:top-0 lg:h-screen ${
          open ? '' : 'max-lg:ltr:-translate-x-full max-lg:rtl:translate-x-full'
        }`}
      >
        <div className="flex h-full flex-col px-3 py-5">
          <div className="mb-6 flex items-center justify-between px-3">
            <span className="text-[17px] font-semibold tracking-tight">{t.appName}</span>
            <button className="rounded p-1 lg:hidden" onClick={() => setOpen(false)} aria-label={t.back}>
              <X className="size-5" aria-hidden />
            </button>
          </div>
          <nav aria-label={t.menu} className="flex-1 overflow-y-auto">
            {nav.data && <NavItems items={nav.data.items} pathname={pathname} onNavigate={() => setOpen(false)} />}
          </nav>
          <div className="mt-4 border-t border-white/15 px-3 pt-4 text-[13px]">
            {me.data && <p className="truncate text-white/80">{me.data.fullName}</p>}
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
          </div>
        </div>
      </aside>
      {open && <div className="fixed inset-0 z-20 bg-ink/40 lg:hidden" onClick={() => setOpen(false)} aria-hidden />}

      <div className="min-w-0">
        <div className="flex items-center gap-3 border-b border-line bg-surface px-4 py-3 lg:hidden print:hidden">
          <button onClick={() => setOpen(true)} aria-label={t.openMenu} className="rounded p-1">
            <Menu className="size-5" aria-hidden />
          </button>
          <span className="font-semibold">{t.appName}</span>
        </div>
        <main className="mx-auto max-w-[1360px] px-4 py-6 sm:px-6 lg:px-10 lg:py-8 print:max-w-none print:p-0">{children}</main>
      </div>
    </div>
  );
}
