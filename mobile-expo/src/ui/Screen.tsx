import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useOffline } from '../api/live';
import { useI18n } from '../i18n';
import { space, useTheme } from '../theme';
import { Button } from './Button';
import { Banner } from './Feedback';
import { Text } from './Text';

interface Props {
  children: React.ReactNode;
  /** Tirer pour actualiser. */
  onRefresh?: () => void;
  refreshing?: boolean;
  /** Élément posé au-dessus du contenu, hors défilement (toast). */
  overlay?: React.ReactNode;
  scroll?: boolean;
  /** Écran sans en-tête (onglets) : marge de la barre d'état. */
  safeTop?: boolean;
}

/** Fond d'écran, marges de la grille (16), bandeau hors ligne, tirer pour actualiser. */
export function Screen({ children, onRefresh, refreshing = false, overlay, scroll = true, safeTop = false }: Props) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const offline = useOffline();
  return (
    <View style={[styles.flex, { backgroundColor: c.bg, paddingTop: safeTop ? insets.top : 0 }]}>
      {offline && <Banner message={t.offline} />}
      {scroll ? (
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.accent} colors={[c.accent]} /> : undefined}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.flex, styles.content]}>{children}</View>
      )}
      {overlay}
    </View>
  );
}

/** Chargement d'un écran. */
export function Loading() {
  const { c } = useTheme();
  return (
    <View style={[styles.center, { backgroundColor: c.bg }]} accessibilityLabel="…">
      <ActivityIndicator size="large" color={c.accent} />
    </View>
  );
}

/** Écran en erreur avec « Réessayer ». */
export function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  const { c } = useTheme();
  const { t } = useI18n();
  return (
    <View style={[styles.center, { backgroundColor: c.bg }]}>
      <Text variant="bodyLg" align="center" accessibilityRole="alert">{message}</Text>
      <Button label={t.retry} onPress={onRetry} />
    </View>
  );
}

/** Titre de section avec action optionnelle à droite. */
export function SectionTitle({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text variant="title2" accessibilityRole="header" style={styles.flex}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: space[4], paddingBottom: space[12], gap: space[4] },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space[4], padding: space[6] },
  section: { flexDirection: 'row', alignItems: 'center', gap: space[2], marginTop: space[2] },
});
