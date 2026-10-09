import type { LucideIcon } from 'lucide-react-native';
import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { type Palette, radius, size as sizes, space, useTheme } from '../theme';
import { Icon } from './Icon';
import { Text } from './Text';

type Variant = 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';

const STYLE: Record<Variant, { bg: keyof Palette | null; fg: keyof Palette; border?: keyof Palette }> = {
  primary: { bg: 'accent', fg: 'onAccent' },
  secondary: { bg: 'secondary', fg: 'onSecondary' },
  outline: { bg: 'surface', fg: 'text', border: 'lineControl' },
  danger: { bg: 'errorSoft', fg: 'errorText', border: 'errorText' },
  ghost: { bg: null, fg: 'textMuted' },
};

interface Props {
  label: string;
  onPress: () => void;
  variant?: Variant;
  size?: 'md' | 'lg';
  icon?: LucideIcon;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  /** Icône seule : le libellé sert alors au lecteur d'écran. */
  iconOnly?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * Bouton de la charte : principal or (texte marine, lisible), secondaire marine, contour,
 * danger, discret. Hauteur 44 au moins, 48 pour l'action principale du bas d'écran.
 */
export function Button({ label, onPress, variant = 'primary', size = 'md', icon, loading, disabled, fullWidth, iconOnly, style }: Props) {
  const { c } = useTheme();
  const s = STYLE[variant];
  const inactive = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      style={({ pressed }) => [
        styles.base,
        {
          minHeight: size === 'lg' ? sizes.touchTargetLg : sizes.touchTarget,
          backgroundColor: s.bg ? c[s.bg] : 'transparent',
          borderColor: s.border ? c[s.border] : 'transparent',
          borderWidth: s.border ? 1 : 0,
          paddingHorizontal: iconOnly ? space[3] : space[4],
          opacity: inactive ? 0.6 : pressed ? 0.85 : 1,
          alignSelf: fullWidth ? 'stretch' : 'auto',
        },
        style,
      ]}
    >
      <View style={styles.row}>
        {loading ? <ActivityIndicator size="small" color={c[s.fg]} /> : icon ? <Icon icon={icon} size={sizes.iconSm + 2} color={s.fg} /> : null}
        {!iconOnly && <Text variant="button" color={s.fg} align="center" style={[styles.label, variant === 'ghost' && styles.ghost]}>{label}</Text>}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space[2], maxWidth: '100%' },
  label: { flexShrink: 1 },
  ghost: { textDecorationLine: 'underline' },
});
