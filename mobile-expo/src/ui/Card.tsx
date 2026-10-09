import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { radius, space, useTheme } from '../theme';

interface Props {
  children: React.ReactNode;
  onPress?: () => void;
  /** Résumé lu par le lecteur d'écran quand toute la carte est tactile. */
  accessibilityLabel?: string;
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Carte blanche à contour léger et ombre de niveau 1. */
export function Card({ children, onPress, accessibilityLabel, padded = true, style }: Props) {
  const { c, shadow } = useTheme();
  const box = [styles.card, { backgroundColor: c.surface, borderColor: c.line }, shadow['1'], padded && styles.padded, style];
  if (!onPress) return <View style={box}>{children}</View>;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel} style={({ pressed }) => [box, pressed && { opacity: 0.85 }]}>
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth },
  padded: { padding: space[4] },
});
