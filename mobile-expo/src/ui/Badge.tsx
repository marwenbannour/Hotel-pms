import type { LucideIcon } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import type { ReservationStatus, RoomStatus } from '../api/types';
import { type Palette, radius, space, useTheme } from '../theme';
import { Icon } from './Icon';
import { Text } from './Text';

export type Tone = 'success' | 'info' | 'warning' | 'error' | 'pending' | 'neutral' | 'accent';

const TONES: Record<Tone, { bg: keyof Palette; fg: keyof Palette; border: keyof Palette }> = {
  success: { bg: 'successSoft', fg: 'successText', border: 'success500' },
  info: { bg: 'infoSoft', fg: 'infoText', border: 'info500' },
  warning: { bg: 'warningSoft', fg: 'warningText', border: 'warning500' },
  error: { bg: 'errorSoft', fg: 'errorText', border: 'error500' },
  pending: { bg: 'pendingSoft', fg: 'pendingText', border: 'pending500' },
  neutral: { bg: 'neutralSoft', fg: 'neutralText', border: 'gray400' },
  accent: { bg: 'accentSoft', fg: 'accentText', border: 'accent' },
};

/** États des chambres (charte : Disponible vert, Occupée bleu, En nettoyage orange, Maintenance rouge). */
export const ROOM_TONE: Record<RoomStatus, Tone> = { available: 'success', occupied: 'info', cleaning: 'warning', maintenance: 'error' };

export const RESERVATION_TONE: Record<ReservationStatus, Tone> = {
  confirmed: 'info',
  checked_in: 'success',
  checked_out: 'neutral',
  cancelled: 'error',
  no_show: 'warning',
};

/** Badge arrondi : fond pâle, contour et texte de la même teinte, toujours avec un mot. */
export function Badge({ label, tone = 'neutral', icon, strike }: { label: string; tone?: Tone; icon?: LucideIcon; strike?: boolean }) {
  const { c } = useTheme();
  const t = TONES[tone];
  return (
    <View style={[styles.badge, { backgroundColor: c[t.bg], borderColor: c[t.border] }]}>
      {icon && <Icon icon={icon} size={14} color={t.fg} />}
      <Text variant="badge" color={t.fg} numberOfLines={1} style={strike ? styles.strike : undefined}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', gap: space[1], alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.full, borderWidth: 1 },
  strike: { textDecorationLine: 'line-through' },
});
