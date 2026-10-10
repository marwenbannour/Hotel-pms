import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Updates from 'expo-updates';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { DevSettings, I18nManager } from 'react-native';
import { deviceLanguage } from './device';
import { BILLING } from './shared/i18n-billing';
import { HOUSEKEEPING } from './shared/i18n-housekeeping';
import { RES } from './shared/i18n-res';
import { DICTS, formatters, isLang, type Lang } from './shared/i18n';
import { MOBILE } from './mobile';

export type { Lang };

const KEY = 'lang';
const deviceLang = (): Lang => {
  const code = deviceLanguage();
  return isLang(code) ? code : 'fr';
};

/**
 * L'arabe se lit de droite à gauche : React Native ne bascule la mise en page qu'au démarrage.
 * Quand la langue change de sens, on l'enregistre puis on relance l'application.
 */
async function applyDirection(lang: Lang) {
  const rtl = lang === 'ar';
  if (I18nManager.isRTL === rtl) return;
  I18nManager.allowRTL(rtl);
  I18nManager.forceRTL(rtl);
  try {
    await Updates.reloadAsync();
  } catch {
    if (__DEV__) DevSettings.reload();
  }
}

interface LangState {
  lang: Lang;
  setLang: (lang: Lang) => void;
}
const LangContext = createContext<LangState>({ lang: 'fr', setLang: () => undefined });

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .catch(() => null)
      .then((saved) => {
        const initial = isLang(saved) ? saved : deviceLang();
        setLangState(initial);
        // Sens resté désaccordé (réglage perdu) : corrigé pour le prochain démarrage, sans relance ici.
        const rtl = initial === 'ar';
        if (I18nManager.isRTL !== rtl) {
          I18nManager.allowRTL(rtl);
          I18nManager.forceRTL(rtl);
        }
      });
  }, []);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    AsyncStorage.setItem(KEY, next).catch(() => undefined);
    void applyDirection(next);
  }, []);

  const value = useMemo(() => ({ lang: lang ?? 'fr', setLang }), [lang, setLang]);
  if (!lang) return null;
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

/** Tous les textes de la langue courante et ses formats (dates, montants). */
export function useI18n(currency?: string) {
  const { lang, setLang } = useContext(LangContext);
  return useMemo(
    () => ({
      lang,
      setLang,
      rtl: lang === 'ar',
      t: DICTS[lang],
      r: RES[lang],
      h: HOUSEKEEPING[lang],
      b: BILLING[lang],
      m: MOBILE[lang],
      f: formatters(lang, currency),
    }),
    [lang, setLang, currency],
  );
}
