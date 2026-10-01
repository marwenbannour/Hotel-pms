'use client';

import { createContext, useContext } from 'react';
import { DICTS, Dict, formatters, Lang } from './i18n';
import { RES } from './i18n-res';

const LangContext = createContext<Lang>('fr');

export function LangProvider({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  return <LangContext.Provider value={lang}>{children}</LangContext.Provider>;
}

export function useI18n(currency?: string): { lang: Lang; t: Dict; f: ReturnType<typeof formatters> } {
  const lang = useContext(LangContext);
  return { lang, t: DICTS[lang], f: formatters(lang, currency) };
}

export function useRes() {
  const lang = useContext(LangContext);
  return RES[lang];
}
