import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import { colors, duration, radius, shadows, size, space, type, typeArabic, type Palette, type ThemeName } from './tokens';

export { duration, radius, size, space, type, typeArabic };
export type { Palette, ThemeName };

export type ThemePreference = 'system' | ThemeName;
const KEY = 'theme';

interface ThemeState {
  name: ThemeName;
  c: Palette;
  shadow: (typeof shadows)[ThemeName];
  preference: ThemePreference;
  setPreference: (p: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeState | null>(null);

/** Thème clair ou sombre : suit le téléphone, sauf choix « Clair » ou « Sombre » dans le profil. */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [preference, setPref] = useState<ThemePreference>('system');

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .catch(() => null)
      .then((v) => {
        if (v === 'light' || v === 'dark' || v === 'system') setPref(v);
      });
  }, []);

  const setPreference = useCallback((p: ThemePreference) => {
    setPref(p);
    AsyncStorage.setItem(KEY, p).catch(() => undefined);
  }, []);

  const name: ThemeName = preference === 'system' ? (system === 'dark' ? 'dark' : 'light') : preference;
  const value = useMemo(() => ({ name, c: colors[name], shadow: shadows[name], preference, setPreference }), [name, preference, setPreference]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeState {
  const v = useContext(ThemeContext);
  if (!v) throw new Error('useTheme hors de ThemeProvider');
  return v;
}
