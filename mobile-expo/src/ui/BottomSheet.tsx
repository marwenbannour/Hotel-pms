import type { LucideIcon } from 'lucide-react-native';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { type Palette, radius, size, space, useTheme } from '../theme';
import { Icon } from './Icon';
import { Text } from './Text';

export interface SheetAction {
  icon: LucideIcon;
  label: string;
  onPress: () => void;
  tone?: keyof Palette;
}

interface Props {
  visible: boolean;
  title: string;
  /** Élément à côté du titre (un badge d'état). */
  aside?: React.ReactNode;
  actions?: SheetAction[];
  children?: React.ReactNode;
  closeLabel: string;
  onClose: () => void;
}

/**
 * Feuille d'actions qui monte du bas, à portée de pouce. Fermeture : toucher le voile, bouton
 * retour Android, ligne « Fermer ».
 */
export function BottomSheet({ visible, title, aside, actions = [], children, closeLabel, onClose }: Props) {
  const { c, shadow } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel={closeLabel} />
      <View style={[styles.sheet, shadow['3'], { backgroundColor: c.surfaceRaised, paddingBottom: insets.bottom + space[4] }]} accessibilityViewIsModal>
        <View style={[styles.grip, { backgroundColor: c.lineControl }]} />
        <View style={styles.head}>
          <Text variant="title2" style={styles.flex} accessibilityRole="header">{title}</Text>
          {aside}
        </View>
        {children}
        {actions.map((a) => (
          <Pressable
            key={a.label}
            onPress={a.onPress}
            accessibilityRole="button"
            style={({ pressed }) => [styles.item, pressed && { backgroundColor: c.line }]}
          >
            <Icon icon={a.icon} color={a.tone ?? 'text'} />
            <Text variant="bodyLg" color={a.tone ?? 'text'}>{a.label}</Text>
          </Pressable>
        ))}
        <Pressable onPress={onClose} accessibilityRole="button" style={styles.item}>
          <Text variant="bodyLg" color="textMuted">{closeLabel}</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrim: { flex: 1, backgroundColor: 'rgba(13, 24, 42, 0.45)' },
  sheet: { borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, paddingHorizontal: space[4], paddingTop: space[2], gap: space[1] },
  grip: { width: 36, height: 4, borderRadius: radius.full, alignSelf: 'center', marginBottom: space[2] },
  head: { flexDirection: 'row', alignItems: 'center', gap: space[2], marginBottom: space[2] },
  item: { flexDirection: 'row', alignItems: 'center', gap: space[3], minHeight: size.touchTargetLg, paddingHorizontal: space[2], borderRadius: radius.md },
});
