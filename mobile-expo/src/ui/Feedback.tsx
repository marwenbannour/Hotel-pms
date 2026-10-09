import { CircleAlert, Info, TriangleAlert, type LucideIcon } from 'lucide-react-native';
import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { type Palette, duration, radius, space, useTheme } from '../theme';
import { Icon } from './Icon';
import { Text } from './Text';

const SEVERITY: Record<'critical' | 'warning' | 'info', { icon: LucideIcon; color: keyof Palette }> = {
  critical: { icon: CircleAlert, color: 'errorText' },
  warning: { icon: TriangleAlert, color: 'warningText' },
  info: { icon: Info, color: 'infoText' },
};

/** Alerte du jour : carte blanche, icône colorée selon la gravité, texte en couleur principale. */
export function AlertCard({ severity, message }: { severity: 'critical' | 'warning' | 'info'; message: string }) {
  const { c } = useTheme();
  const s = SEVERITY[severity];
  return (
    <View style={[styles.alert, { backgroundColor: c.surface, borderColor: c.line }]}>
      <Icon icon={s.icon} color={s.color} />
      <Text style={styles.flex}>{message}</Text>
    </View>
  );
}

/** Erreur près de sa cause (formulaire, action refusée). */
export function ErrorNote({ message, action }: { message: string | null | undefined; action?: { label: string; onPress: () => void } }) {
  const { c } = useTheme();
  if (!message) return null;
  return (
    <View accessibilityRole="alert" style={[styles.error, { backgroundColor: c.errorSoft }]}>
      <Text color="errorText">{message}</Text>
      {action && (
        <Pressable onPress={action.onPress} accessibilityRole="button" style={styles.errorAction}>
          <Text variant="button" color="errorText" style={styles.underline}>{action.label}</Text>
        </Pressable>
      )}
    </View>
  );
}

/** Bandeau doré collé en haut (connexion perdue, information importante). */
export function Banner({ message }: { message: string }) {
  const { c } = useTheme();
  return (
    <View accessibilityLiveRegion="polite" style={[styles.banner, { backgroundColor: c.accentSoft, borderBottomColor: c.accent }]}>
      <Text variant="caption">{message}</Text>
    </View>
  );
}

/** Message bref en bas d'écran, avec une action (annuler) ; fondu d'entrée. */
export function Toast({ message, action }: { message: string; action?: { label: string; onPress: () => void; disabled?: boolean } }) {
  const { c, shadow } = useTheme();
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(opacity, { toValue: 1, duration: duration.fade, useNativeDriver: true }).start();
  }, [opacity, message]);
  return (
    <Animated.View accessibilityLiveRegion="polite" style={[styles.toast, shadow['3'], { backgroundColor: c.navy900, opacity }]}>
      <Text color="onDark" style={styles.flex}>{message}</Text>
      {action && (
        <Pressable onPress={action.onPress} disabled={action.disabled} accessibilityRole="button" style={styles.toastAction}>
          <Text variant="button" color="gold300" style={styles.underline}>{action.label}</Text>
        </Pressable>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  alert: { flexDirection: 'row', gap: space[3], alignItems: 'flex-start', padding: space[3], borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth },
  error: { padding: space[3], borderRadius: radius.md, gap: space[1] },
  errorAction: { minHeight: 32, justifyContent: 'center', alignSelf: 'flex-start' },
  underline: { textDecorationLine: 'underline' },
  banner: { paddingHorizontal: space[4], paddingVertical: space[2], borderBottomWidth: 1 },
  toast: { position: 'absolute', left: space[4], right: space[4], bottom: space[4], flexDirection: 'row', alignItems: 'center', gap: space[3], paddingHorizontal: space[4], paddingVertical: space[2], borderRadius: radius.lg, minHeight: 52 },
  toastAction: { minHeight: 44, justifyContent: 'center', paddingHorizontal: space[2] },
});
