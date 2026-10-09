import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';
import {
  NotoKufiArabic_400Regular, NotoKufiArabic_500Medium, NotoKufiArabic_600SemiBold, NotoKufiArabic_700Bold,
} from '@expo-google-fonts/noto-kufi-arabic';
import { Poppins_400Regular, Poppins_500Medium, Poppins_600SemiBold, Poppins_700Bold } from '@expo-google-fonts/poppins';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ApiError, session, setOrigin, setUnauthorizedHandler } from './src/api/client';
import { useMe } from './src/api/queries';
import { LangProvider, useI18n } from './src/i18n';
import { AppNavigator } from './src/navigation/AppNavigator';
import { SessionContext } from './src/navigation/session';
import { EnrollScreen } from './src/screens/EnrollScreen';
import { SignInScreen } from './src/screens/SignInScreen';
import { loadServer } from './src/server';
import { SetupScreen } from './src/SetupScreen';
import { ThemeProvider, useTheme } from './src/theme';
import { Loading } from './src/ui';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 15_000, retry: (count, err) => count < 2 && !(err instanceof ApiError && [401, 403, 404].includes(err.status)) },
  },
});

type Step = { step: 'loading' } | { step: 'setup'; current: string | null } | { step: 'ready'; origin: string };

/**
 * Application mobile HOTELIA : adresse du serveur au premier lancement, connexion, puis écrans
 * natifs (tableau de bord, chambres, scan, réservations, profil). Les écrans pas encore natifs
 * s'ouvrent en version web, avec la même session.
 */
export default function App() {
  const [fontsLoaded] = useFonts({
    Poppins_400Regular, Poppins_500Medium, Poppins_600SemiBold, Poppins_700Bold,
    Inter_400Regular, Inter_500Medium, Inter_600SemiBold,
    NotoKufiArabic_400Regular, NotoKufiArabic_500Medium, NotoKufiArabic_600SemiBold, NotoKufiArabic_700Bold,
  });
  const [state, setState] = useState<Step>({ step: 'loading' });

  useEffect(() => {
    loadServer().then((origin) => setState(origin ? { step: 'ready', origin } : { step: 'setup', current: null }));
  }, []);

  useEffect(() => {
    if (fontsLoaded && state.step !== 'loading') SplashScreen.hideAsync().catch(() => undefined);
  }, [fontsLoaded, state.step]);

  if (!fontsLoaded || state.step === 'loading') return null;

  return (
    <SafeAreaProvider>
      <LangProvider>
        <ThemeProvider>
          <QueryClientProvider client={queryClient}>
            <Themed>
              {state.step === 'setup' ? (
                <SetupScreen
                  initial={state.current}
                  onDone={(origin) => {
                    queryClient.clear();
                    setState({ step: 'ready', origin });
                  }}
                  onCancel={state.current ? () => setState({ step: 'ready', origin: state.current! }) : undefined}
                />
              ) : (
                <Session key={state.origin} origin={state.origin} onChangeServer={() => setState({ step: 'setup', current: state.origin })} />
              )}
            </Themed>
          </QueryClientProvider>
        </ThemeProvider>
      </LangProvider>
    </SafeAreaProvider>
  );
}

/** Barre d'état assortie au thème. */
function Themed({ children }: { children: React.ReactNode }) {
  const { name } = useTheme();
  return (
    <>
      <StatusBar style={name === 'dark' ? 'light' : 'dark'} />
      {children}
    </>
  );
}

/** Session sur un serveur : connexion si nécessaire, puis l'application. */
function Session({ origin, onChangeServer }: { origin: string; onChangeServer: () => void }) {
  setOrigin(origin);
  const qc = useQueryClient();
  const { lang, setLang } = useI18n();
  const me = useMe();
  const [enroll, setEnroll] = useState(false);

  const signedOut = me.isError && me.error instanceof ApiError && me.error.status === 401;
  useEffect(() => {
    // Session perdue pendant l'utilisation : retour à la connexion.
    // Pas pendant la lecture du profil lui-même : son 401 suffit, et la relancer bouclerait.
    setUnauthorizedHandler(() => {
      if (!qc.isFetching({ queryKey: ['me'] })) qc.invalidateQueries({ queryKey: ['me'] });
    });
  }, [qc]);

  // La langue de l'application suit celle du profil (comme le web au premier passage).
  useEffect(() => {
    if (me.data && me.data.locale !== lang) setLang(me.data.locale);
  }, [me.data, lang, setLang]);

  const signOut = useCallback(async () => {
    await session.logout();
    // Données de l'ancien profil effacées ; le profil repart de zéro, répond 401 : écran de connexion.
    // (Un simple clear() laisserait l'écran sur l'ancien profil, sans requête à relancer.)
    qc.removeQueries({ predicate: (q) => q.queryKey[0] !== 'me' });
    await qc.resetQueries({ queryKey: ['me'] });
  }, [qc]);

  const actions = useMemo(() => ({ origin, signOut, changeServer: onChangeServer }), [origin, signOut, onChangeServer]);
  const refreshMe = () => qc.invalidateQueries({ queryKey: ['me'] });

  if (enroll) return <EnrollScreen origin={origin} onDone={() => { setEnroll(false); refreshMe(); }} />;
  if (signedOut || (me.isError && !me.data)) {
    return <SignInScreen onSignedIn={refreshMe} onEnroll={() => setEnroll(true)} onChangeServer={onChangeServer} />;
  }
  if (!me.data) return <Loading />;
  return (
    <SessionContext.Provider value={actions}>
      <AppNavigator />
    </SessionContext.Provider>
  );
}
