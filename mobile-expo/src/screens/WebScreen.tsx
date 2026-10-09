import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, Linking, StyleSheet, View } from 'react-native';
import type { ShouldStartLoadRequest, WebViewNavigation } from 'react-native-webview/lib/WebViewTypes';
import { getOrigin } from '../api/client';
import { useI18n } from '../i18n';
import type { RootScreenProps } from '../navigation/types';
import { NATIVE_USER_AGENT } from '../server';
import { useTheme } from '../theme';
import { LoadError } from '../ui';
import { WebView, type WebViewHandle } from '../ui/WebView';

/**
 * Écran pas encore natif : la page web correspondante, sans son menu (l'application web le
 * masque quand elle reconnaît la marque HotelPMSNative dans l'agent utilisateur). La session
 * est la même : les cookies sont partagés avec les appels natifs.
 */
export function WebScreen({ route, navigation }: RootScreenProps<'Web'>) {
  const { c } = useTheme();
  const { t } = useI18n();
  const web = useRef<WebViewHandle>(null);
  const canGoBack = useRef(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    navigation.setOptions({ title: route.params.title });
  }, [navigation, route.params.title]);

  // Retour Android : page précédente dans la WebView, puis écran précédent de l'application.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!canGoBack.current) return false;
      web.current?.goBack();
      return true;
    });
    return () => sub.remove();
  }, []);

  const onNavigate = (req: ShouldStartLoadRequest) => {
    if (!/^(https?|about|data|blob):/i.test(req.url)) {
      Linking.openURL(req.url).catch(() => undefined);
      return false;
    }
    return true;
  };

  if (failed) return <LoadError message={t.offline} onRetry={() => setFailed(false)} />;
  return (
    <WebView
      ref={web}
      source={{ uri: `${getOrigin()}${route.params.path}` }}
      style={{ backgroundColor: c.bg }}
      applicationNameForUserAgent={NATIVE_USER_AGENT}
      onShouldStartLoadWithRequest={onNavigate}
      onNavigationStateChange={(nav: WebViewNavigation) => {
        canGoBack.current = nav.canGoBack;
      }}
      onError={() => setFailed(true)}
      startInLoadingState
      renderLoading={() => (
        <View style={[StyleSheet.absoluteFill, styles.center, { backgroundColor: c.bg }]}>
          <ActivityIndicator size="large" color={c.accent} />
        </View>
      )}
      sharedCookiesEnabled
      domStorageEnabled
      setSupportMultipleWindows={false}
      textZoom={100}
    />
  );
}

const styles = StyleSheet.create({ center: { alignItems: 'center', justifyContent: 'center' } });
