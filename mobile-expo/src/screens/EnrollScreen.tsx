import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '../i18n';
import { NATIVE_USER_AGENT } from '../server';
import { space, useTheme } from '../theme';
import { Button, Text } from '../ui';
import { WebView } from '../ui/WebView';

/**
 * Activation de la double authentification (direction, comptabilité, informatique) : elle
 * demande de scanner un code QR, ce que fait déjà l'écran web de connexion.
 */
export function EnrollScreen({ origin, onDone }: { origin: string; onDone: () => void }) {
  const { c } = useTheme();
  const { m } = useI18n();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.flex, { backgroundColor: c.bg, paddingTop: insets.top }]}>
      <Text style={styles.note} color="textMuted">{m.enrollOnWeb}</Text>
      <WebView source={{ uri: `${origin}/login` }} applicationNameForUserAgent={NATIVE_USER_AGENT} sharedCookiesEnabled domStorageEnabled style={styles.flex} />
      <View style={[styles.footer, { paddingBottom: insets.bottom + space[3], backgroundColor: c.surface, borderTopColor: c.line }]}>
        <Button label={m.continue} onPress={onDone} size="lg" fullWidth />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  note: { padding: space[4] },
  footer: { padding: space[4], borderTopWidth: StyleSheet.hairlineWidth },
});
